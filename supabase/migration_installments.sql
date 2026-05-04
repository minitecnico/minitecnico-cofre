-- ============================================================================
-- Migration: Parcelamento de Compras
-- ============================================================================
-- Idempotente. Execute no SQL Editor do Supabase.
--
-- COMO FUNCIONA:
--   Cada parcela é uma transação INDEPENDENTE em transactions, datada no mês
--   correto da parcela. Todas compartilham um installment_group_id (UUID) que
--   conecta as parcelas da mesma compra.
--
--   Exemplo: tênis R$ 300 em 8x → 8 linhas em transactions, todas com o mesmo
--   installment_group_id e installment_total = 8. Cada uma com seu installment_no.
--
-- VANTAGENS:
--   - Cada parcela cai no mês certo (gráficos e saldos respeitam isso)
--   - Posso editar/excluir TODAS as parcelas de uma compra (via installment_group_id)
--   - Posso editar/excluir UMA parcela específica
-- ============================================================================

-- Já existem as colunas installments e installment_no no schema antigo —
-- vou reaproveitá-las e adicionar installment_group_id pra agrupar.

-- Renomeia installment_no para installment_number (mais legível)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions'
      and column_name = 'installment_no'
  ) then
    alter table public.transactions rename column installment_no to installment_number;
  end if;
end$$;

-- Renomeia installments para installment_total
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'transactions'
      and column_name = 'installments'
  ) then
    alter table public.transactions rename column installments to installment_total;
  end if;
end$$;

-- Adiciona coluna de grupo (nova)
alter table public.transactions
  add column if not exists installment_group_id uuid;

-- Índice pra buscar/excluir todas as parcelas de uma compra
create index if not exists idx_transactions_installment_group
  on public.transactions(installment_group_id)
  where installment_group_id is not null;

-- Garante valores válidos
update public.transactions set installment_total = 1 where installment_total is null;
update public.transactions set installment_number = 1 where installment_number is null;
