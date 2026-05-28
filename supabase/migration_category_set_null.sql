-- ============================================================================
-- Migration: permitir excluir categorias mesmo que existam transações ligadas
-- ============================================================================
-- Execute no SQL Editor do Supabase. Idempotente.
--
-- COMPORTAMENTO ANTES:
--   transactions.category_id e recurring_transactions.category_id estavam
--   declarados como NOT NULL com ON DELETE RESTRICT. Isso impedia o usuário
--   de excluir uma categoria já usada — o Postgres barrava o DELETE com
--   "violates foreign key constraint".
--
-- COMPORTAMENTO AGORA:
--   Ambas as colunas viram NULLABLE com ON DELETE SET NULL. Ao excluir uma
--   categoria, as transações/recorrências históricas SÃO PRESERVADAS — só
--   passam a ficar "sem categoria" (category_id = NULL). O frontend exibe
--   esses registros com label "Sem categoria".
--
-- Filosofia: histórico é sagrado. Categoria é só uma etiqueta; pode sumir
-- sem destruir o registro do gasto/recebimento que ela rotulava.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. transactions.category_id → nullable + ON DELETE SET NULL
-- ─────────────────────────────────────────────────────────────────────────
alter table public.transactions
  alter column category_id drop not null;

-- Remove a FK antiga (nome padrão gerado pelo Postgres)
alter table public.transactions
  drop constraint if exists transactions_category_id_fkey;

-- Recria com ON DELETE SET NULL
alter table public.transactions
  add constraint transactions_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete set null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. recurring_transactions.category_id → nullable + ON DELETE SET NULL
-- ─────────────────────────────────────────────────────────────────────────
alter table public.recurring_transactions
  alter column category_id drop not null;

alter table public.recurring_transactions
  drop constraint if exists recurring_transactions_category_id_fkey;

alter table public.recurring_transactions
  add constraint recurring_transactions_category_id_fkey
  foreign key (category_id)
  references public.categories(id)
  on delete set null;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Ajusta generate_recurring_for_month — agora category_id pode ser NULL
-- ─────────────────────────────────────────────────────────────────────────
-- A função insere category_id direto do modelo. Se o modelo perdeu a categoria
-- (excluída), as transações geradas também ficam sem — comportamento correto.
-- Nenhum ajuste na lógica é necessário; só revalidar que insert aceita null.
