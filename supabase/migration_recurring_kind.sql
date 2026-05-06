-- ============================================================================
-- Migration: adiciona "kind" em recurring_transactions
-- ============================================================================
-- Permite distinguir tipos de recorrência:
--   'recurring'    → contas mensais comuns (aluguel, conta de luz, salário)
--   'subscription' → assinaturas (Netflix, Spotify, iCloud, etc.)
--
-- Empréstimos/financiamentos NÃO usam essa tabela — eles vão pelo sistema
-- de parcelamento longo (installments) que já existe.
-- ============================================================================

alter table public.recurring_transactions
  add column if not exists kind text not null default 'recurring'
  check (kind in ('recurring', 'subscription'));

-- Índice opcional pra filtragem rápida por kind
create index if not exists idx_recurring_kind
  on public.recurring_transactions(user_id, kind) where active = true;
