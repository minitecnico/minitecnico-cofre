import { useEffect, useState, useMemo } from 'react';
import { Repeat, Plus, Pause, Play, Trash2, Pencil, ArrowUpCircle, ArrowDownCircle, CreditCard as CardIcon, Tv, Landmark, CheckSquare, X, Check } from 'lucide-react';
import { recurringService, categoryService, cardService } from '../services';
import { formatCurrency, parseAmount } from '../utils/format';
import Modal from '../components/Modal';
import { useDisclosure } from '../hooks/useDisclosure';

/**
 * Página de gerenciamento de transações recorrentes.
 * --------------------------------------------------------------
 * Lista todas as recorrências (ativas e pausadas), permite:
 *   - Criar nova
 *   - Editar (não muda transações passadas)
 *   - Pausar/retomar
 *   - Excluir (transações já criadas viram avulsas)
 */

function RecurringForm({ initial, kind = 'recurring', onSaved, onCancel }) {
  const isEdit = !!initial;
  const isSubscription = (initial?.kind || kind) === 'subscription';
  // Assinatura é sempre despesa
  const [type, setType] = useState(initial?.type || (isSubscription ? 'expense' : 'expense'));
  const [amount, setAmount] = useState(initial?.amount?.toString().replace('.', ',') || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [dayOfMonth, setDayOfMonth] = useState(initial?.day_of_month || 5);
  const [categoryId, setCategoryId] = useState(initial?.category?.id || '');
  const [creditCardId, setCreditCardId] = useState(initial?.credit_card?.id || '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.credit_card ? 'card' : 'account');

  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    categoryService.list(type).then(setCategories).catch(() => setCategories([]));
  }, [type]);

  useEffect(() => {
    if (type === 'expense') {
      cardService.list().then(setCards).catch(() => setCards([]));
    }
  }, [type]);

  useEffect(() => {
    if (categories.length > 0 && !categories.find((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        type,
        amount: parseAmount(amount),
        description: description.trim(),
        category_id: categoryId,
        credit_card_id: type === 'expense' && paymentMethod === 'card' ? creditCardId : null,
        day_of_month: parseInt(dayOfMonth, 10),
      };
      if (!payload.amount || payload.amount <= 0) throw new Error('Informe um valor válido');
      if (!payload.description) throw new Error('Informe uma descrição');
      if (!payload.category_id) throw new Error('Selecione uma categoria');
      if (payload.day_of_month < 1 || payload.day_of_month > 31) {
        throw new Error('Dia do mês deve ser entre 1 e 31');
      }

      if (isEdit) {
        await recurringService.update(initial.id, payload);
      } else {
        const today = new Date();
        const startMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
        await recurringService.create({ ...payload, start_month: startMonth, kind });
      }
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
      {!isEdit && !isSubscription && (
        <div className="grid grid-cols-2 gap-0 border-2 border-ink-900">
          <button
            type="button"
            onClick={() => setType('income')}
            className={`py-3 min-h-[44px] font-semibold text-sm uppercase tracking-wider transition-colors ${
              type === 'income' ? 'bg-accent text-ink-900' : 'bg-white text-ink-500 hover:bg-ink-50'
            }`}
          >
            ↑ Receita
          </button>
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`py-3 min-h-[44px] font-semibold text-sm uppercase tracking-wider transition-colors border-l-2 border-ink-900 ${
              type === 'expense' ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'
            }`}
          >
            ↓ Despesa
          </button>
        </div>
      )}

      <div>
        <label className="label">Valor</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-ink-500">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="input-field pl-12 text-xl md:text-2xl font-mono font-semibold"
            autoFocus
          />
        </div>
      </div>

      <div>
        <label className="label">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === 'income' ? 'Ex: Salário' : 'Ex: Aluguel'}
          className="input-field"
          maxLength={100}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Dia do mês</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            className="input-field"
            required
          />
          <p className="text-[10px] text-ink-500 mt-1">
            Se o mês não tiver esse dia (ex: 31 em fev), usa o último dia do mês.
          </p>
        </div>
        <div>
          <label className="label">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input-field"
          >
            {categories.length === 0 && <option value="">— Carregando —</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {type === 'expense' && (
        <div>
          <label className="label">Forma de pagamento</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('account')}
              className={`px-3 py-2.5 min-h-[44px] text-sm font-medium border-2 transition-all ${
                paymentMethod === 'account'
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-700 border-ink-300 hover:border-ink-900'
              }`}
            >
              Conta / dinheiro
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`px-3 py-2.5 min-h-[44px] text-sm font-medium border-2 transition-all ${
                paymentMethod === 'card'
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-700 border-ink-300 hover:border-ink-900'
              }`}
            >
              Cartão de crédito
            </button>
          </div>
          {paymentMethod === 'card' && (
            <select
              value={creditCardId}
              onChange={(e) => setCreditCardId(e.target.value)}
              className="input-field mt-3"
            >
              <option value="">Selecione um cartão</option>
              {cards.map(({ card }) => (
                <option key={card.id} value={card.id}>{card.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border-2 border-negative text-negative text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="btn-accent flex-1 disabled:opacity-60">
          {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar recorrência'}
        </button>
      </div>
    </form>
  );
}

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const { isOpen, open, close } = useDisclosure();

  // Aba ativa: 'recurring' | 'subscription' | 'loan'
  const [activeTab, setActiveTab] = useState('recurring');

  // Modal específico de empréstimo (atalho para criar despesa parcelada longa)
  const [loanModalOpen, setLoanModalOpen] = useState(false);

  // ─────────────────────────────────────────────────────────────────────
  // SELEÇÃO MÚLTIPLA — para agir em lote (excluir/pausar/retomar várias)
  // ─────────────────────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await recurringService.list();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleActive(item) {
    await recurringService.toggleActive(item.id, !item.active);
    load();
  }

  async function handleDelete(item) {
    if (!confirm(
      `Excluir "${item.description}"?\n\n` +
      `As transações já criadas em meses anteriores serão preservadas (apenas perdem o vínculo). ` +
      `Mas nenhuma nova será gerada nos próximos meses.`
    )) return;
    await recurringService.remove(item.id);
    load();
  }

  // ─────────────────────────────────────────────────────────────────────
  // Handlers de seleção múltipla
  // ─────────────────────────────────────────────────────────────────────

  function toggleSelection(itemId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll(itemList) {
    setSelectedIds(new Set(itemList.map((it) => it.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  // Auto-clear feedback após 4s
  useEffect(() => {
    if (!bulkFeedback) return;
    const t = setTimeout(() => setBulkFeedback(null), 4500);
    return () => clearTimeout(t);
  }, [bulkFeedback]);

  // Sai do modo seleção ao trocar de aba (UX consistente)
  useEffect(() => {
    if (selectionMode) exitSelectionMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleBulkDelete() {
    setConfirmingBulkDelete(false);
    setBulkProcessing(true);
    const ids = [...selectedIds];
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await recurringService.remove(id);
        success++;
      } catch {
        failed++;
      }
    }
    setBulkProcessing(false);
    exitSelectionMode();
    setBulkFeedback({
      type: failed > 0 ? 'partial' : 'success',
      text: failed > 0
        ? `${success} excluída${success !== 1 ? 's' : ''}, ${failed} falhou.`
        : `✓ ${success} ${success === 1 ? 'excluída' : 'excluídas'} com sucesso.`,
    });
    load();
  }

  async function handleBulkToggleActive(active) {
    setBulkProcessing(true);
    const ids = [...selectedIds];
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await recurringService.toggleActive(id, active);
        success++;
      } catch {
        failed++;
      }
    }
    setBulkProcessing(false);
    exitSelectionMode();
    setBulkFeedback({
      type: failed > 0 ? 'partial' : 'success',
      text: failed > 0
        ? `${success} ${active ? 'retomadas' : 'pausadas'}, ${failed} falhou.`
        : `✓ ${success} ${success === 1 ? (active ? 'retomada' : 'pausada') : (active ? 'retomadas' : 'pausadas')} com sucesso.`,
    });
    load();
  }

  // Filtra itens conforme a aba ativa
  const itemsForTab = useMemo(() => {
    if (activeTab === 'recurring') {
      return items.filter((i) => (i.kind || 'recurring') === 'recurring');
    }
    if (activeTab === 'subscription') {
      return items.filter((i) => i.kind === 'subscription');
    }
    return [];
  }, [items, activeTab]);

  const activeItems = itemsForTab.filter((i) => i.active);
  const pausedItems = itemsForTab.filter((i) => !i.active);

  // Contadores para badges das abas
  const counts = useMemo(() => ({
    recurring: items.filter((i) => (i.kind || 'recurring') === 'recurring').length,
    subscription: items.filter((i) => i.kind === 'subscription').length,
  }), [items]);

  // Total de assinaturas mensais (pra cabeçalho da aba)
  const subscriptionsTotal = useMemo(() => {
    return items
      .filter((i) => i.kind === 'subscription' && i.active)
      .reduce((s, i) => s + Number(i.amount), 0);
  }, [items]);

  const tabConfig = TAB_CONFIG[activeTab];
  const TabIcon = tabConfig.icon;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 md:gap-4">
        <div>
          <p className="text-[10px] md:text-xs uppercase tracking-widest text-ink-500 font-semibold">
            Automação
          </p>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-1 leading-tight tracking-tight flex items-center gap-2 md:gap-3">
            <Repeat className="w-7 h-7 md:w-10 md:h-10 flex-shrink-0" strokeWidth={2.5} />
            <span>Recorrências</span>
          </h1>
        </div>
      </div>

      {/* Abas */}
      <div className="card-flat p-1.5 flex gap-1">
        {[
          { id: 'recurring', label: 'Recorrências', icon: Repeat, count: counts.recurring },
          { id: 'subscription', label: 'Assinaturas', icon: Tv, count: counts.subscription },
          { id: 'loan', label: 'Empréstimos', icon: Landmark, count: null },
        ].map(({ id, label, icon: Icon, count }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 px-3 py-2.5 min-h-[44px] rounded-xl text-xs md:text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5 md:gap-2 ${
                active
                  ? 'bg-gradient-dark text-white shadow-soft'
                  : 'bg-transparent text-ink-600 hover:bg-ink-100'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={2.25} />
              <span className="truncate">{label}</span>
              {count != null && count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${
                  active ? 'bg-accent text-ink-900' : 'bg-ink-200 text-ink-700'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Banner explicativo + CTA principal da aba */}
      <div className={`rounded-2xl p-4 md:p-5 ${tabConfig.bannerBg} ${tabConfig.bannerText}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tabConfig.iconBg}`}>
              <TabIcon className={`w-5 h-5 ${tabConfig.iconColor}`} strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="font-display text-base md:text-lg font-bold leading-tight">
                {tabConfig.title}
              </p>
              <p className="text-xs md:text-sm mt-1 opacity-90 leading-snug">
                {tabConfig.description}
              </p>
              {activeTab === 'subscription' && subscriptionsTotal > 0 && (
                <p className="text-xs md:text-sm mt-2 font-bold">
                  Total mensal:{' '}
                  <span className="font-mono">{formatCurrency(subscriptionsTotal)}</span>
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              if (activeTab === 'loan') {
                setLoanModalOpen(true);
              } else {
                setEditing(null);
                open();
              }
            }}
            className={`flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.98] ${tabConfig.buttonClass}`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>{tabConfig.cta}</span>
          </button>
        </div>
      </div>

      {/* Conteúdo da aba */}
      {activeTab === 'loan' ? (
        <LoanInfoPanel onCreate={() => setLoanModalOpen(true)} />
      ) : loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-ink-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : itemsForTab.length === 0 ? (
        <div className="card-flat p-8 md:p-12 text-center">
          <TabIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-ink-300" strokeWidth={1.75} />
          <p className="font-display text-lg md:text-xl font-bold mb-2">{tabConfig.emptyTitle}</p>
          <p className="text-xs md:text-sm text-ink-500 mb-4">
            {tabConfig.emptyDescription}
          </p>
          <button onClick={() => { setEditing(null); open(); }} className="btn-accent">
            <Plus className="w-5 h-5" /> {tabConfig.cta}
          </button>
        </div>
      ) : (
        <>
          {/* Toolbar de seleção múltipla */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {!selectionMode ? (
              <button
                onClick={() => setSelectionMode(true)}
                className="inline-flex items-center gap-2 px-3 py-2 min-h-[36px] rounded-xl text-xs font-bold uppercase tracking-widest text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-all duration-200"
              >
                <CheckSquare className="w-4 h-4" />
                Selecionar
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={exitSelectionMode}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl text-xs font-bold text-ink-700 hover:bg-ink-100 transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                <button
                  onClick={() => selectAll(itemsForTab)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl text-xs font-bold text-ink-900 bg-ink-100 hover:bg-ink-200 transition-all duration-200"
                >
                  Selecionar todas ({itemsForTab.length})
                </button>
                {selectedIds.size > 0 && (
                  <button
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-xl text-xs font-semibold text-ink-500 hover:text-ink-900 transition-all duration-200"
                  >
                    Desmarcar ({selectedIds.size})
                  </button>
                )}
              </div>
            )}

            {selectionMode && selectedIds.size > 0 && (
              <span className="text-xs font-bold text-ink-900 bg-accent/30 px-3 py-1.5 rounded-full">
                {selectedIds.size} {selectedIds.size === 1 ? 'selecionada' : 'selecionadas'}
              </span>
            )}
          </div>

          {activeItems.length > 0 && (
            <div>
              <h3 className="font-display text-lg md:text-xl font-bold mb-3 md:mb-4 tracking-tight">
                Ativas <span className="text-sm font-mono text-ink-500">({activeItems.length})</span>
              </h3>
              <div className="bg-white rounded-2xl shadow-soft border border-ink-200 divide-y divide-ink-100 overflow-hidden">
                {activeItems.map((item) => (
                  <RecurringRow
                    key={item.id}
                    item={item}
                    onEdit={(it) => { setEditing(it); open(); }}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onToggleSelection={() => toggleSelection(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {pausedItems.length > 0 && (
            <div>
              <h3 className="font-display text-lg md:text-xl font-bold mb-3 md:mb-4 text-ink-500 tracking-tight">
                Pausadas <span className="text-sm font-mono">({pausedItems.length})</span>
              </h3>
              <div className={`bg-white rounded-2xl shadow-soft border border-ink-200 divide-y divide-ink-100 overflow-hidden ${selectionMode ? '' : 'opacity-60'}`}>
                {pausedItems.map((item) => (
                  <RecurringRow
                    key={item.id}
                    item={item}
                    onEdit={(it) => { setEditing(it); open(); }}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(item.id)}
                    onToggleSelection={() => toggleSelection(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Espaço extra no final pra não esconder atrás da barra flutuante mobile */}
          {selectionMode && selectedIds.size > 0 && (
            <div className="h-24 md:h-0" aria-hidden="true" />
          )}
        </>
      )}

      {/* Feedback flutuante (após ações em lote) */}
      {bulkFeedback && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-soft-lg animate-fade-in bg-ink-900 text-ink-50 max-w-md mx-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>{bulkFeedback.text}</span>
            <button
              onClick={() => setBulkFeedback(null)}
              className="ml-2 text-ink-400 hover:text-white"
              aria-label="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Barra de ações flutuante quando há itens selecionados */}
      {selectionMode && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          processing={bulkProcessing}
          onPause={() => handleBulkToggleActive(false)}
          onResume={() => handleBulkToggleActive(true)}
          onDelete={() => setConfirmingBulkDelete(true)}
        />
      )}

      {/* Modal: criar/editar recorrência ou assinatura */}
      <Modal
        isOpen={isOpen}
        onClose={close}
        title={
          editing
            ? `Editar ${(editing.kind || 'recurring') === 'subscription' ? 'assinatura' : 'recorrência'}`
            : activeTab === 'subscription' ? 'Nova assinatura' : 'Nova recorrência'
        }
      >
        <RecurringForm
          initial={editing}
          kind={editing ? (editing.kind || 'recurring') : activeTab === 'subscription' ? 'subscription' : 'recurring'}
          onSaved={() => { close(); load(); }}
          onCancel={close}
        />
      </Modal>

      {/* Modal: empréstimo (atalho para despesa parcelada longa) */}
      <Modal
        isOpen={loanModalOpen}
        onClose={() => setLoanModalOpen(false)}
        title="Novo empréstimo / financiamento"
      >
        <LoanForm
          onSaved={() => {
            setLoanModalOpen(false);
            load();
          }}
          onCancel={() => setLoanModalOpen(false)}
        />
      </Modal>

      {/* Modal: confirmar exclusão em lote */}
      <Modal
        isOpen={confirmingBulkDelete}
        onClose={() => setConfirmingBulkDelete(false)}
        title={`Excluir ${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'itens'}`}
      >
        <div className="space-y-4">
          <div className="px-4 py-3 bg-red-50 border border-negative rounded-xl">
            <p className="text-sm">
              Tem certeza que deseja excluir <strong>{selectedIds.size}</strong>
              {' '}{selectedIds.size === 1 ? 'recorrência' : 'recorrências'}?
            </p>
            <p className="text-xs text-ink-700 mt-2">
              ✓ <strong>Histórico preservado:</strong> as transações já criadas em meses anteriores continuam existindo (só perdem o vínculo com o modelo).
            </p>
            <p className="text-xs text-ink-700 mt-1">
              ⚠ <strong>Não há como desfazer.</strong> Nenhuma transação nova será gerada nos próximos meses para esses itens.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              onClick={() => setConfirmingBulkDelete(false)}
              className="btn-ghost"
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex-1 px-5 py-3 min-h-[44px] bg-negative text-white font-bold rounded-xl shadow-soft-md hover:shadow-soft-lg active:scale-[0.98] transition-all duration-200"
            >
              Sim, excluir {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'itens'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Barra de ações flutuante (modo seleção)
// ─────────────────────────────────────────────────────────────────────────

function BulkActionBar({ count, processing, onPause, onResume, onDelete }) {
  return (
    <div className="fixed left-2 right-2 md:left-auto md:right-4 md:max-w-md bottom-20 md:bottom-4 z-40 animate-fade-in">
      <div className="rounded-2xl shadow-soft-lg bg-gradient-dark text-ink-50 p-3 md:p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent text-ink-900 flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
              {count}
            </div>
            <p className="font-bold text-sm truncate">
              {count === 1 ? 'item selecionado' : 'itens selecionados'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onResume}
            disabled={processing}
            className="px-2 py-2.5 min-h-[44px] bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>Retomar</span>
          </button>
          <button
            onClick={onPause}
            disabled={processing}
            className="px-2 py-2.5 min-h-[44px] bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all disabled:opacity-50"
          >
            <Pause className="w-4 h-4" />
            <span>Pausar</span>
          </button>
          <button
            onClick={onDelete}
            disabled={processing}
            className="px-2 py-2.5 min-h-[44px] bg-negative hover:bg-red-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>Excluir</span>
          </button>
        </div>

        {processing && (
          <p className="text-[10px] text-center text-ink-400 mt-2">Processando…</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Configuração visual de cada aba
// ─────────────────────────────────────────────────────────────────────────

const TAB_CONFIG = {
  recurring: {
    icon: Repeat,
    iconBg: 'bg-accent/30',
    iconColor: 'text-ink-900',
    bannerBg: 'bg-ink-900',
    bannerText: 'text-ink-50',
    title: 'Recorrências mensais',
    description: 'Contas que se repetem todo mês — aluguel, conta de luz, salário. Geradas automaticamente no dia que você definir.',
    cta: 'Nova recorrência',
    buttonClass: 'bg-accent text-ink-900 shadow-soft hover:shadow-soft-md',
    emptyTitle: 'Nenhuma recorrência',
    emptyDescription: 'Crie modelos para receitas e despesas que se repetem — salário, aluguel, etc.',
  },
  subscription: {
    icon: Tv,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
    bannerBg: 'bg-gradient-to-br from-purple-600 to-purple-800',
    bannerText: 'text-white',
    title: 'Assinaturas',
    description: 'Streamings, apps, clouds — pequenos gastos mensais que somam muito no fim do mês. Mantenha controle.',
    cta: 'Nova assinatura',
    buttonClass: 'bg-white text-purple-700 shadow-soft hover:shadow-soft-md',
    emptyTitle: 'Nenhuma assinatura',
    emptyDescription: 'Cadastre Netflix, Spotify, iCloud, ChatGPT, etc. Veja quanto você gasta com isso por mês.',
  },
  loan: {
    icon: Landmark,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    bannerBg: 'bg-gradient-to-br from-blue-600 to-blue-900',
    bannerText: 'text-white',
    title: 'Empréstimos e financiamentos',
    description: 'Compras parceladas em muitas vezes (36x, 60x, 120x...). Cria todas as parcelas de uma vez no calendário.',
    cta: 'Novo empréstimo',
    buttonClass: 'bg-white text-blue-700 shadow-soft hover:shadow-soft-md',
    emptyTitle: '',
    emptyDescription: '',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Painel informativo da aba Empréstimos
// ─────────────────────────────────────────────────────────────────────────

function LoanInfoPanel({ onCreate }) {
  return (
    <div className="space-y-3">
      <div className="card-flat p-5 md:p-6">
        <h3 className="font-display text-lg md:text-xl font-bold tracking-tight mb-3">
          Como funciona um empréstimo aqui no Cofre?
        </h3>
        <ul className="space-y-2.5 text-sm text-ink-700">
          <li className="flex gap-3">
            <span className="font-mono font-bold text-blue-700 flex-shrink-0">1.</span>
            <span>
              Você cadastra <strong>uma despesa parcelada</strong> com a quantidade total de parcelas
              (36x, 48x, 60x, 72x, 84x, 96x, 120x, 180x ou 240x).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-bold text-blue-700 flex-shrink-0">2.</span>
            <span>
              O sistema cria <strong>todas as parcelas de uma vez</strong>, uma por mês, marcadas com badge
              {' '}<span className="inline-block px-1.5 py-0.5 bg-ink-100 rounded text-[10px] font-bold align-middle">3/60</span>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-bold text-blue-700 flex-shrink-0">3.</span>
            <span>
              Cada mês você vê a parcela do mês como uma despesa normal.
              <strong> Marca como paga quando pagar</strong> — o limite do cartão volta automaticamente.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-mono font-bold text-blue-700 flex-shrink-0">4.</span>
            <span>
              Diferente de recorrências e assinaturas, empréstimos têm <strong>fim definido</strong> — terminam
              quando a última parcela é paga.
            </span>
          </li>
        </ul>

        <div className="mt-5 p-3 rounded-xl bg-yellow-50 border border-warn/40">
          <p className="text-xs text-yellow-900">
            💡 <strong>Para empréstimos com juros:</strong> calcule o valor TOTAL que vai pagar (parcela × meses)
            e use isso como valor da despesa. Ex: 60 parcelas de R$ 800 = empréstimo de R$ 48.000.
          </p>
        </div>
      </div>

      <button
        onClick={onCreate}
        className="w-full px-4 py-4 min-h-[56px] bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold rounded-2xl shadow-soft-md hover:shadow-soft-lg active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        Cadastrar novo empréstimo
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Form específico de Empréstimo (atalho para createInstallments)
// ─────────────────────────────────────────────────────────────────────────

function LoanForm({ onSaved, onCancel }) {
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState(36);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [creditCardId, setCreditCardId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('account');

  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    categoryService.list('expense').then(setCategories).catch(() => setCategories([]));
    cardService.list().then(setCards).catch(() => setCards([]));
  }, []);

  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Preview da parcela mensal
  const totalNum = parseAmount(totalAmount);
  const installmentValue = totalNum > 0 && installmentCount > 0
    ? totalNum / installmentCount
    : 0;
  const yearsApprox = Math.round((installmentCount / 12) * 10) / 10;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!description.trim()) throw new Error('Informe uma descrição (ex: Financiamento do carro)');
      if (!totalNum || totalNum <= 0) throw new Error('Informe o valor total do empréstimo');
      if (!categoryId) throw new Error('Selecione uma categoria');
      if (paymentMethod === 'card' && !creditCardId) throw new Error('Selecione um cartão');

      // Importa o transactionService aqui pra evitar dependência circular
      const { transactionService } = await import('../services');
      await transactionService.createInstallments({
        type: 'expense',
        totalAmount: totalNum,
        installmentCount: parseInt(installmentCount, 10),
        startDate,
        description: description.trim(),
        category_id: categoryId,
        credit_card_id: paymentMethod === 'card' ? creditCardId : null,
      });

      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
      <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs md:text-sm text-blue-900">
        <Landmark className="w-4 h-4 inline mr-1" strokeWidth={2.25} />
        <strong>Empréstimo / financiamento.</strong>{' '}
        Vai criar {installmentCount} parcelas mensais a partir da data informada.
      </div>

      <div>
        <label className="label">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Financiamento Honda Civic"
          className="input-field"
          maxLength={120}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Valor total</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500 font-mono pointer-events-none">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="48.000,00"
              className="input-field pl-10 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="label">Total de parcelas</label>
          <select
            value={installmentCount}
            onChange={(e) => setInstallmentCount(parseInt(e.target.value, 10))}
            className="input-field"
          >
            {[36, 48, 60, 72, 84, 96, 120, 180, 240].map((n) => (
              <option key={n} value={n}>
                {n}x · {Math.round((n / 12) * 10) / 10} {n / 12 < 2 ? 'ano' : 'anos'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview */}
      {installmentValue > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white p-4 md:p-5">
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Parcela mensal</p>
          <p className="font-display text-3xl md:text-4xl font-bold mt-1">
            {formatCurrency(installmentValue)}
          </p>
          <p className="text-xs md:text-sm opacity-90 mt-1">
            {installmentCount}x · {yearsApprox} {yearsApprox < 2 ? 'ano' : 'anos'} ·{' '}
            Total {formatCurrency(totalNum)}
          </p>
        </div>
      )}

      <div>
        <label className="label">Data da 1ª parcela</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="input-field"
        />
      </div>

      <div>
        <label className="label">Categoria</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="input-field"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Forma de pagamento</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setPaymentMethod('account'); setCreditCardId(''); }}
            className={`flex-1 px-3 py-2.5 min-h-[44px] text-sm font-bold rounded-xl transition-all duration-200 ${
              paymentMethod === 'account' ? 'bg-gradient-dark text-white shadow-soft' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            Conta
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`flex-1 px-3 py-2.5 min-h-[44px] text-sm font-bold rounded-xl transition-all duration-200 ${
              paymentMethod === 'card' ? 'bg-gradient-dark text-white shadow-soft' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            Cartão
          </button>
        </div>
      </div>

      {paymentMethod === 'card' && (
        <div>
          <label className="label">Cartão</label>
          <select
            value={creditCardId}
            onChange={(e) => setCreditCardId(e.target.value)}
            className="input-field"
          >
            <option value="">Selecione um cartão</option>
            {cards.map(({ card }) => (
              <option key={card.id} value={card.id}>{card.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-negative text-negative text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-5 py-3 min-h-[44px] bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-bold rounded-xl shadow-soft-md disabled:opacity-60 transition-all duration-200"
        >
          {submitting ? 'Criando…' : `Criar ${installmentCount} parcelas`}
        </button>
      </div>
    </form>
  );
}

function RecurringRow({
  item, onEdit, onToggleActive, onDelete,
  selectionMode, selected, onToggleSelection,
}) {
  const isIncome = item.type === 'income';
  const isSubscription = item.kind === 'subscription';
  const Icon = isSubscription ? Tv : (isIncome ? ArrowUpCircle : ArrowDownCircle);
  const colorClass = isIncome ? 'text-positive' : 'text-negative';
  const cat = item.category || {};
  const card = item.credit_card;

  // Em modo seleção, click em qualquer parte da linha alterna a seleção
  function handleRowClick() {
    if (selectionMode) onToggleSelection();
  }

  return (
    <div
      className={`flex items-stretch transition-colors ${
        selected ? 'bg-accent/15' : 'hover:bg-ink-50'
      } ${selectionMode ? 'cursor-pointer' : ''}`}
      onClick={handleRowClick}
    >
      <div className="w-1 flex-shrink-0" style={{ backgroundColor: cat.color || '#64748b' }} />

      {/* Checkbox no modo seleção */}
      {selectionMode && (
        <div className="flex items-center justify-center pl-3 flex-shrink-0">
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
              selected
                ? 'bg-ink-900 border-ink-900'
                : 'bg-white border-ink-300'
            }`}
            aria-hidden="true"
          >
            {selected && <Check className="w-3 h-3 text-accent" strokeWidth={4} />}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Icon className={`w-4 h-4 ${isSubscription ? 'text-purple-700' : colorClass} flex-shrink-0`} strokeWidth={2.25} />
            <h4 className="font-medium text-ink-900 text-sm md:text-base truncate">
              {item.description}
            </h4>
            {isSubscription && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 whitespace-nowrap">
                <Tv className="w-3 h-3" /> Assinatura
              </span>
            )}
            {card && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
                style={{ backgroundColor: card.color || '#1e293b' }}
              >
                <CardIcon className="w-3 h-3" /> {card.name}
              </span>
            )}
            {!item.active && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-ink-200 text-ink-700">
                Pausada
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-500 flex-wrap">
            <span className="font-medium" style={{ color: cat.color }}>{cat.name}</span>
            <span>·</span>
            <span>Todo dia {item.day_of_month}</span>
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 mt-1 md:mt-0">
          <div className={`stat-number text-base md:text-lg font-semibold whitespace-nowrap ${colorClass}`}>
            {isIncome ? '+' : '−'} {formatCurrency(item.amount)}
          </div>

          {/* Ações individuais (escondidas no modo seleção) */}
          {!selectionMode && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onToggleActive(item); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-ink-200 transition-colors"
                aria-label={item.active ? 'Pausar' : 'Retomar'}
                title={item.active ? 'Pausar (não gera mais)' : 'Retomar'}
              >
                {item.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-ink-200 transition-colors"
                aria-label="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-negative hover:bg-red-50 transition-colors"
                aria-label="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
