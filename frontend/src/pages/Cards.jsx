import { useEffect, useState } from 'react';
import { CreditCard as CardIcon, Plus, Calendar, AlertTriangle, Trash2, Pencil, CheckCircle2, Wallet, Sparkles } from 'lucide-react';
import { cardService } from '../services';
import { formatCurrency, formatPercent, formatDate } from '../utils/format';
import Modal from '../components/Modal';
import { useDisclosure } from '../hooks/useDisclosure';

const BRAND_OPTIONS = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'elo', label: 'Elo' },
  { value: 'amex', label: 'American Express' },
  { value: 'hipercard', label: 'Hipercard' },
  { value: 'other', label: 'Outro' },
];

const PRESET_COLORS = ['#820ad1', '#ff7a00', '#1e293b', '#dc2626', '#16a34a', '#0ea5e9', '#f59e0b'];

function CardForm({ initial, onSaved, onCancel }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name || '',
    brand: initial?.brand || 'mastercard',
    lastDigits: initial?.last_digits || '',
    limit: initial?.card_limit || '',
    closingDay: initial?.closing_day || 25,
    dueDay: initial?.due_day || 5,
    color: initial?.color || PRESET_COLORS[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        limit: parseFloat(form.limit) || 0,
        closingDay: parseInt(form.closingDay, 10),
        dueDay: parseInt(form.dueDay, 10),
      };
      if (isEdit) await cardService.update(initial.id, payload);
      else await cardService.create(payload);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome do cartão</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="input-field"
          placeholder="Ex: Nubank Roxinho"
          required
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Bandeira</label>
          <select
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            className="input-field"
          >
            {BRAND_OPTIONS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Últimos 4 dígitos</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={form.lastDigits}
            onChange={(e) => setForm({ ...form, lastDigits: e.target.value.replace(/\D/g, '') })}
            className="input-field font-mono"
            placeholder="1234"
          />
        </div>
      </div>

      <div>
        <label className="label">Limite total</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-ink-500">R$</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={form.limit}
            onChange={(e) => setForm({ ...form, limit: e.target.value })}
            className="input-field pl-12"
            placeholder="5000.00"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Fechamento</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={form.closingDay}
            onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="label">Vencimento</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={form.dueDay}
            onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
            className="input-field"
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, color: c })}
              className={`w-11 h-11 rounded-xl transition-all duration-200 shadow-soft ${
                form.color === c ? 'ring-2 ring-ink-900 ring-offset-2 scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

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
          {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Adicionar cartão'}
        </button>
      </div>
    </form>
  );
}

function CardItem({ summary, onEdit, onDelete, onPayBill, onSelect, selected, payingId }) {
  const {
    card,
    available,
    openBill,
    paidInCycle,
    cardLimit,
    utilizationPercent,
    cycleEnd,
    unpaidCount,
    purchaseCount,
  } = summary;
  const isHighUsage = utilizationPercent > 80;
  const hasOpenBill = openBill > 0;
  const isPaying = payingId === card.id;

  return (
    <div
      className={`relative rounded-2xl shadow-soft-md hover:shadow-soft-lg transition-all duration-300 cursor-pointer overflow-hidden ${
        selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink-50' : ''
      }`}
      onClick={() => onSelect(card.id)}
    >
      {/* Fundo gradiente baseado na cor do cartão */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}dd 60%, ${card.color}99 100%)`,
        }}
      />
      {/* Brilho decorativo */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      {/* Conteúdo */}
      <div className="relative p-5 md:p-6 text-white">
        {/* Header: bandeira + nome + ícone */}
        <div className="flex items-start justify-between mb-4 md:mb-5 gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] md:text-xs uppercase tracking-widest opacity-80 font-bold">
              {card.brand}
            </p>
            <h3 className="font-display text-xl md:text-2xl font-bold mt-1 truncate tracking-tight">
              {card.name}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <CardIcon className="w-5 h-5" />
          </div>
        </div>

        {/* Número estilizado */}
        <p className="font-mono text-sm md:text-base tracking-[0.3em] opacity-80 mb-5 md:mb-6">
          •••• •••• •••• {card.last_digits || '----'}
        </p>

        {/* Métricas principais */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1 font-bold">Fatura aberta</p>
            <p className="font-display font-bold text-lg md:text-xl break-all">
              {formatCurrency(openBill)}
            </p>
            {unpaidCount > 0 && (
              <p className="text-[10px] opacity-70 mt-0.5">
                {unpaidCount} {unpaidCount === 1 ? 'compra' : 'compras'}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1 font-bold">Disponível</p>
            <p className="font-display font-bold text-lg md:text-xl break-all">
              {formatCurrency(available)}
            </p>
            <p className="text-[10px] opacity-70 mt-0.5">
              de {formatCurrency(cardLimit)}
            </p>
          </div>
        </div>

        {/* Barra de uso */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs opacity-80 mb-1.5">
            <span className="font-medium">Uso do limite</span>
            <span className="font-mono font-bold">{formatPercent(utilizationPercent)}</span>
          </div>
          <div className="h-2 bg-black/30 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isHighUsage ? 'bg-warn' : 'bg-accent'
              }`}
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Indicador de fatura paga */}
        {paidInCycle > 0 && (
          <div className="flex items-center gap-2 text-[10px] md:text-xs opacity-80 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatCurrency(paidInCycle)} já pagos neste ciclo</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] md:text-xs opacity-80">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Fecha {formatDate(cycleEnd, 'long')}</span>
        </div>

        {isHighUsage && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-warn text-ink-900 text-xs font-bold rounded-xl">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Limite quase no topo</span>
          </div>
        )}

        {/* Botão "Pagar fatura" — destaque quando há fatura aberta */}
        {hasOpenBill && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPayBill(summary);
            }}
            disabled={isPaying}
            className="mt-4 w-full px-4 py-2.5 min-h-[44px] bg-white text-ink-900 font-bold rounded-xl
                       shadow-soft hover:shadow-soft-md active:scale-[0.98]
                       transition-all duration-200 text-sm
                       flex items-center justify-center gap-2
                       disabled:opacity-60"
          >
            {isPaying ? (
              <>Pagando…</>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                Pagar fatura ({formatCurrency(openBill)})
              </>
            )}
          </button>
        )}

        {!hasOpenBill && purchaseCount > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-white/15 backdrop-blur-sm rounded-xl text-sm font-bold">
            <Sparkles className="w-4 h-4" />
            Fatura zerada
          </div>
        )}
      </div>

      {/* Ações editar/excluir — sempre visíveis, posição clara */}
      <div className="absolute top-3 right-3 flex gap-1.5 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(card); }}
          className="w-9 h-9 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200"
          title="Editar cartão"
          aria-label="Editar cartão"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(card); }}
          className="w-9 h-9 rounded-lg bg-white/20 hover:bg-negative backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200"
          title="Excluir cartão"
          aria-label="Excluir cartão"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CardHistory({ cardId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    cardService
      .history(cardId)
      .then((data) => setHistory(data))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) return <div className="h-20 bg-ink-100 animate-pulse" />;
  if (history.length === 0) {
    return (
      <div className="card-flat p-6 md:p-8 text-center">
        <p className="text-ink-500 text-sm">Nenhuma compra registrada neste cartão.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-ink-200/80 divide-y divide-ink-100 overflow-hidden">
      {history.map((t) => {
        const isPaid = !!t.paid;
        const isInstallment = t.installment_total > 1;
        return (
          <div key={t.id} className={`flex items-center justify-between gap-3 p-4 transition-colors hover:bg-ink-50 ${isPaid ? 'opacity-60' : ''}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`font-medium text-sm md:text-base truncate ${isPaid ? 'line-through' : ''}`}>
                  {t.description}
                </p>
                {isInstallment && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-ink-100 text-ink-700 rounded">
                    {t.installment_number}/{t.installment_total}
                  </span>
                )}
                {isPaid && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-positive text-white rounded">
                    <CheckCircle2 className="w-3 h-3" strokeWidth={3} />
                    Pago
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500 mt-0.5 truncate">
                <span style={{ color: t.category?.color }} className="font-medium">{t.category?.name}</span>
                {' · '}{formatDate(t.date, 'long')}
              </p>
            </div>
            <p className={`font-mono font-bold whitespace-nowrap text-sm md:text-base ${isPaid ? 'text-ink-500 line-through' : 'text-negative'}`}>
              − {formatCurrency(t.amount)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function CardsPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null); // { card, openBill }
  const [confirmingPay, setConfirmingPay] = useState(null); // { card, openBill, unpaidCount }
  const [feedback, setFeedback] = useState(null); // { type, text }
  const { isOpen, open, close } = useDisclosure();

  async function load() {
    setLoading(true);
    try {
      const data = await cardService.list();
      setCards(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].card.id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-clear do feedback após 4s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4500);
    return () => clearTimeout(t);
  }, [feedback]);

  function requestDelete(cardSummary) {
    setConfirmingDelete({
      card: cardSummary.card,
      openBill: cardSummary.openBill,
      unpaidCount: cardSummary.unpaidCount,
    });
  }

  async function confirmDelete() {
    const id = confirmingDelete.card.id;
    setConfirmingDelete(null);
    try {
      await cardService.remove(id);
      if (selectedId === id) setSelectedId(null);
      setFeedback({ type: 'success', text: 'Cartão removido. Histórico preservado.' });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Erro ao remover: ' + err.message });
    }
  }

  function requestPayBill(cardSummary) {
    setConfirmingPay({
      card: cardSummary.card,
      openBill: cardSummary.openBill,
      unpaidCount: cardSummary.unpaidCount,
    });
  }

  async function confirmPayBill() {
    const cardId = confirmingPay.card.id;
    const cardName = confirmingPay.card.name;
    setConfirmingPay(null);
    setPayingId(cardId);
    try {
      const count = await cardService.payBill(cardId);
      setFeedback({
        type: 'success',
        text: `✓ Fatura do ${cardName} paga. ${count} ${count === 1 ? 'compra marcada' : 'compras marcadas'} como paga${count === 1 ? '' : 's'}.`,
      });
      load();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Erro ao pagar fatura: ' + err.message });
    } finally {
      setPayingId(null);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 md:gap-4">
        <div>
          <p className="text-[10px] md:text-xs uppercase tracking-widest text-ink-500 font-semibold">
            Pagamentos
          </p>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-1 leading-tight">
            Cartões
          </h1>
        </div>

        <button onClick={() => { setEditing(null); open(); }} className="btn-accent self-start flex-shrink-0">
          <Plus className="w-5 h-5" /> Novo cartão
        </button>
      </div>

      {/* Feedback de ações (sucesso/erro) */}
      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between gap-3 animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-accent/30 text-ink-900 border border-accent'
              : 'bg-red-50 text-negative border border-negative'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline opacity-70 hover:opacity-100 flex-shrink-0"
          >
            ok
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-72 bg-ink-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="card-flat p-8 md:p-12 text-center">
          <CardIcon className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 text-ink-300" />
          <p className="font-display text-lg md:text-xl font-bold mb-2">Nenhum cartão cadastrado</p>
          <p className="text-xs md:text-sm text-ink-500 mb-4">
            Cadastre seu primeiro cartão para acompanhar limite e fatura em tempo real.
          </p>
          <button onClick={() => { setEditing(null); open(); }} className="btn-accent">
            <Plus className="w-5 h-5" /> Adicionar cartão
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            {cards.map((summary) => (
              <CardItem
                key={summary.card.id}
                summary={summary}
                onEdit={(c) => { setEditing(c); open(); }}
                onDelete={requestDelete}
                onPayBill={requestPayBill}
                onSelect={setSelectedId}
                selected={selectedId === summary.card.id}
                payingId={payingId}
              />
            ))}
          </div>

          {selectedId && (
            <div>
              <h3 className="font-display text-xl md:text-2xl font-bold mb-3 md:mb-4 tracking-tight">
                Histórico de compras
              </h3>
              <CardHistory cardId={selectedId} />
            </div>
          )}
        </>
      )}

      {/* Modal: novo / editar cartão */}
      <Modal isOpen={isOpen} onClose={close} title={editing ? 'Editar cartão' : 'Novo cartão'}>
        <CardForm
          initial={editing}
          onSaved={() => { close(); load(); }}
          onCancel={close}
        />
      </Modal>

      {/* Modal: confirmar exclusão */}
      <Modal
        isOpen={!!confirmingDelete}
        onClose={() => setConfirmingDelete(null)}
        title="Excluir cartão"
      >
        {confirmingDelete && (
          <div className="space-y-4">
            <div className="px-4 py-3 bg-red-50 border border-negative rounded-xl">
              <p className="text-sm">
                Tem certeza que deseja excluir o cartão{' '}
                <strong className="font-bold">{confirmingDelete.card.name}</strong>?
              </p>
              {confirmingDelete.openBill > 0 && (
                <p className="text-xs text-ink-700 mt-2">
                  ⚠️ Há fatura aberta de <strong>{formatCurrency(confirmingDelete.openBill)}</strong> ({confirmingDelete.unpaidCount} {confirmingDelete.unpaidCount === 1 ? 'compra' : 'compras'} pendente{confirmingDelete.unpaidCount === 1 ? '' : 's'}).
                </p>
              )}
              <p className="text-xs text-ink-700 mt-2">
                ✓ <strong>Histórico preservado:</strong> as compras antigas continuam no app, só perdem o vínculo com o cartão.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => setConfirmingDelete(null)}
                className="btn-ghost"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-5 py-3 min-h-[44px] bg-negative text-white font-bold rounded-xl shadow-soft-md hover:shadow-soft-lg active:scale-[0.98] transition-all duration-200"
              >
                Excluir cartão
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: confirmar pagamento da fatura */}
      <Modal
        isOpen={!!confirmingPay}
        onClose={() => setConfirmingPay(null)}
        title="Pagar fatura"
      >
        {confirmingPay && (
          <div className="space-y-4">
            <div className="px-4 py-4 bg-accent/20 border border-accent rounded-xl">
              <p className="text-sm">
                Pagar a fatura aberta de <strong className="font-bold">{confirmingPay.card.name}</strong>?
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-ink-600">Valor</span>
                <span className="font-display font-bold text-2xl text-ink-900">
                  {formatCurrency(confirmingPay.openBill)}
                </span>
              </div>
              <p className="text-xs text-ink-700 mt-3">
                Isso vai marcar as <strong>{confirmingPay.unpaidCount} {confirmingPay.unpaidCount === 1 ? 'compra' : 'compras'}</strong> do ciclo atual como pagas.
                O limite disponível volta a crescer no cartão.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => setConfirmingPay(null)}
                className="btn-ghost"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPayBill}
                className="btn-accent flex-1"
              >
                <Wallet className="w-4 h-4" />
                Confirmar pagamento
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
