-- ============================================================================
-- Migration: Limite inteligente do cartão
-- ============================================================================
-- Execute no SQL Editor do Supabase. Idempotente.
--
-- COMO FUNCIONA AGORA:
--   - Limite ocupado = soma de compras NÃO PAGAS (paid = false) do cartão
--     dentro do ciclo atual (entre o último fechamento e o próximo)
--   - Quando o usuário marca uma compra como "paga", ela DEIXA DE OCUPAR
--     o limite e o disponível volta a crescer (como o app do banco)
--   - Compras parceladas: só a parcela do mês ATUAL (dentro do ciclo) ocupa
--     limite. As parcelas futuras ainda não rodaram no cartão
--
-- CICLO DE FATURA:
--   - closing_day: dia do mês que a fatura fecha
--   - O ciclo atual vai do último fechamento até o próximo fechamento
--   - Ex: closing_day = 14, hoje = 04/05 → ciclo: 15/abr a 14/mai
--   - Ex: closing_day = 14, hoje = 20/05 → ciclo: 15/mai a 14/jun
-- ============================================================================

create or replace function public.get_card_summary(p_card_id uuid)
returns table (
  card_limit numeric,
  open_bill numeric,        -- Compras NÃO PAGAS no ciclo atual (ocupam limite)
  paid_in_cycle numeric,    -- Compras JÁ PAGAS no ciclo atual (referência)
  total_used numeric,       -- Soma de open_bill (= limite ocupado)
  available numeric,        -- card_limit - open_bill (limite disponível)
  utilization_percent numeric,
  purchase_count bigint,    -- Quantidade de compras no ciclo (todas)
  unpaid_count bigint,      -- Quantidade de compras NÃO pagas
  cycle_start date,
  cycle_end date
)
language plpgsql
security invoker
stable
as $$
declare
  v_card record;
  v_today date := current_date;
  v_closing_day int;
  v_cycle_start date;
  v_cycle_end date;
  v_limit numeric;
begin
  -- Valida cartão e dono
  select * into v_card
  from public.credit_cards
  where id = p_card_id and user_id = auth.uid();

  if not found then
    return;
  end if;

  v_closing_day := v_card.closing_day;
  v_limit := coalesce(v_card.card_limit, 0);

  -- Calcula ciclo atual baseado no closing_day
  if extract(day from v_today)::int <= v_closing_day then
    -- Estamos antes do fechamento → ciclo começou no fechamento do mês passado
    v_cycle_start := (date_trunc('month', v_today) - interval '1 month')::date
                     + (v_closing_day - 1) * interval '1 day'
                     + interval '1 day';
    v_cycle_end := date_trunc('month', v_today)::date
                   + (v_closing_day - 1) * interval '1 day';
  else
    -- Estamos depois do fechamento → ciclo começou no fechamento deste mês
    v_cycle_start := date_trunc('month', v_today)::date
                     + (v_closing_day - 1) * interval '1 day'
                     + interval '1 day';
    v_cycle_end := (date_trunc('month', v_today) + interval '1 month')::date
                   + (v_closing_day - 1) * interval '1 day';
  end if;

  return query
  with cycle_txs as (
    select amount, paid
    from public.transactions
    where credit_card_id = p_card_id
      and user_id = auth.uid()
      and type = 'expense'
      and date >= v_cycle_start
      and date <= v_cycle_end
  ),
  agg as (
    select
      coalesce(sum(amount) filter (where not paid), 0)::numeric as v_open_bill,
      coalesce(sum(amount) filter (where paid), 0)::numeric     as v_paid_in_cycle,
      count(*)::bigint                                          as v_purchase_count,
      count(*) filter (where not paid)::bigint                  as v_unpaid_count
    from cycle_txs
  )
  select
    v_limit,
    a.v_open_bill,
    a.v_paid_in_cycle,
    a.v_open_bill,                                  -- total_used = só não pagas
    greatest(v_limit - a.v_open_bill, 0)::numeric,  -- available
    case when v_limit > 0
         then round((a.v_open_bill / v_limit) * 100, 2)
         else 0
    end,
    a.v_purchase_count,
    a.v_unpaid_count,
    v_cycle_start,
    v_cycle_end
  from agg a;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Função: pagar a fatura inteira do cartão (todas as compras do ciclo)
-- ─────────────────────────────────────────────────────────────────────────
-- Marca todas as compras NÃO PAGAS do ciclo atual do cartão como pagas.
-- Retorna a quantidade de compras que foram marcadas.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.pay_card_bill(p_card_id uuid)
returns int
language plpgsql
security invoker
volatile
as $$
declare
  v_card record;
  v_today date := current_date;
  v_closing_day int;
  v_cycle_start date;
  v_cycle_end date;
  v_count int;
begin
  -- Valida cartão e dono
  select * into v_card
  from public.credit_cards
  where id = p_card_id and user_id = auth.uid();

  if not found then
    raise exception 'Cartão não encontrado ou sem permissão';
  end if;

  v_closing_day := v_card.closing_day;

  -- Mesma lógica de ciclo da get_card_summary
  if extract(day from v_today)::int <= v_closing_day then
    v_cycle_start := (date_trunc('month', v_today) - interval '1 month')::date
                     + (v_closing_day - 1) * interval '1 day'
                     + interval '1 day';
    v_cycle_end := date_trunc('month', v_today)::date
                   + (v_closing_day - 1) * interval '1 day';
  else
    v_cycle_start := date_trunc('month', v_today)::date
                     + (v_closing_day - 1) * interval '1 day'
                     + interval '1 day';
    v_cycle_end := (date_trunc('month', v_today) + interval '1 month')::date
                   + (v_closing_day - 1) * interval '1 day';
  end if;

  with updated as (
    update public.transactions
    set paid = true
    where credit_card_id = p_card_id
      and user_id = auth.uid()
      and type = 'expense'
      and paid = false
      and date >= v_cycle_start
      and date <= v_cycle_end
    returning 1
  )
  select count(*)::int into v_count from updated;

  return coalesce(v_count, 0);
end;
$$;
