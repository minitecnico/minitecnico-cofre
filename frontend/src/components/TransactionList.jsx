import { useState } from 'react';
import { Pencil, Trash2, CreditCard as CardIcon, Check, Repeat, Layers } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import Modal from './Modal';
import TransactionForm from './TransactionForm';
import { transactionService } from '../services';

export default function TransactionList({
  items,
  loading,
  onChange,
  onDelete,
  onTogglePaid,
  emptyMessage = 'Nenhuma transação encontrada',
}) {
  const [editing, setEditing] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(null); // {id, description, groupId, total}

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 md:h-16 bg-ink-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card-flat p-8 md:p-12 text-center">
        <p className="text-ink-500 font-medium text-sm md:text-base">{emptyMessage}</p>
      </div>
    );
  }

  // Decide o que fazer ao clicar em "excluir":
  //  - Se for parcelamento: abre modal perguntando "só essa ou todas?"
  //  - Se for transação simples: confirm padrão e exclui
  function handleDeleteClick(t) {
    const isInstallment = !!t.installment_group_id;
    if (isInstallment) {
      setDeletingGroup({
        id: t.id,
        description: t.description,
        groupId: t.installment_group_id,
        total: t.installment_total,
      });
    } else {
      if (confirm(`Excluir "${t.description}"?`)) onDelete(t.id);
    }
  }

  async function handleDeleteOnlyThis() {
    onDelete(deletingGroup.id);
    setDeletingGroup(null);
  }

  async function handleDeleteAll() {
    try {
      await transactionService.removeGroup(deletingGroup.groupId);
      setDeletingGroup(null);
      onChange?.(); // refaz fetch
    } catch (err) {
      alert('Erro ao excluir parcelas: ' + (err.message || 'desconhecido'));
    }
  }

  return (
    <>
      <div className="bg-white border-2 border-ink-900 shadow-flat-sm md:shadow-flat divide-y-2 divide-ink-100">
        {items.map((t) => {
          const isIncome = t.type === 'income';
          const isExpense = !isIncome;
          const isPaid = !!t.paid;
          const cat = t.category || {};
          const card = t.credit_card || null;
          const isInstallment = !!t.installment_group_id && t.installment_total > 1;

          return (
            <div
              key={t.id}
              className={`group flex items-stretch transition-all hover:bg-ink-50 ${
                isExpense && isPaid ? 'opacity-60' : ''
              }`}
            >
              {/* Indicador de cor categoria */}
              <div
                className="w-1 flex-shrink-0"
                style={{ backgroundColor: cat.color || '#64748b' }}
              />

              {/* Checkbox de pago — apenas em despesas */}
              {isExpense && (
                <button
                  type="button"
                  onClick={() => onTogglePaid?.(t.id, isPaid)}
                  className={`flex items-center justify-center w-12 md:w-14 flex-shrink-0 border-r-2 border-ink-100 transition-colors ${
                    isPaid
                      ? 'bg-positive text-white hover:bg-green-700'
                      : 'bg-ink-50 hover:bg-accent text-ink-400 hover:text-ink-900'
                  }`}
                  aria-label={isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
                  aria-pressed={isPaid}
                  title={isPaid ? 'Pago — clique para desmarcar' : 'Pendente — clique para marcar como pago'}
                >
                  <Check
                    className={`w-5 h-5 transition-transform ${
                      isPaid ? 'scale-100' : 'scale-0 group-hover:scale-100'
                    }`}
                    strokeWidth={3}
                  />
                </button>
              )}

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4
                      className={`font-medium text-ink-900 text-sm md:text-base truncate ${
                        isExpense && isPaid ? 'line-through' : ''
                      }`}
                    >
                      {t.description}
                    </h4>
                    {isInstallment && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-ink-100 text-ink-900 border border-ink-900 whitespace-nowrap"
                        title={`Parcela ${t.installment_number} de ${t.installment_total}`}
                      >
                        <Layers className="w-3 h-3" strokeWidth={2.5} />
                        {t.installment_number}/{t.installment_total}
                      </span>
                    )}
                    {t.recurring_id && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider bg-ink-900 text-accent whitespace-nowrap"
                        title="Esta é uma transação recorrente"
                      >
                        <Repeat className="w-3 h-3" strokeWidth={2.5} /> Recorrente
                      </span>
                    )}
                    {card && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap"
                        style={{ backgroundColor: card.color || '#1e293b' }}
                      >
                        <CardIcon className="w-3 h-3" /> {card.name}
                      </span>
                    )}
                    {isExpense && isPaid && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white bg-positive whitespace-nowrap">
                        <Check className="w-3 h-3" strokeWidth={3} /> Pago
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-500 flex-wrap">
                    <span className="font-medium" style={{ color: cat.color }}>
                      {cat.name}
                    </span>
                    <span>·</span>
                    <span>{formatDate(t.date, 'long')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 mt-1 md:mt-0">
                  <div
                    className={`stat-number text-base md:text-lg font-semibold whitespace-nowrap ${
                      isIncome ? 'text-positive' : 'text-negative'
                    } ${isExpense && isPaid ? 'line-through' : ''}`}
                  >
                    {isIncome ? '+' : '−'} {formatCurrency(t.amount)}
                  </div>

                  <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(t)}
                      className="w-9 h-9 flex items-center justify-center hover:bg-ink-200 transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(t)}
                      className="w-9 h-9 flex items-center justify-center text-negative hover:bg-red-50 transition-colors"
                      aria-label="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Editar transação">
        {editing && (
          <TransactionForm
            initial={editing}
            onSaved={() => {
              setEditing(null);
              onChange?.();
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Modal de exclusão de compra parcelada */}
      <Modal
        isOpen={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        title="Excluir parcela"
      >
        {deletingGroup && (
          <div className="space-y-4">
            <div className="px-4 py-3 bg-yellow-50 border-2 border-warn">
              <p className="text-sm">
                <strong className="font-semibold">"{deletingGroup.description}"</strong> faz parte de uma compra
                parcelada em <strong>{deletingGroup.total}x</strong>.
              </p>
              <p className="text-xs text-ink-700 mt-1">O que você quer fazer?</p>
            </div>

            <button
              onClick={handleDeleteOnlyThis}
              className="w-full text-left px-4 py-3 border-2 border-ink-900 hover:bg-accent/30 transition-colors"
            >
              <p className="font-semibold text-sm">Excluir só esta parcela</p>
              <p className="text-xs text-ink-600 mt-0.5">
                As outras parcelas continuam normais.
              </p>
            </button>

            <button
              onClick={handleDeleteAll}
              className="w-full text-left px-4 py-3 border-2 border-negative text-negative hover:bg-red-50 transition-colors"
            >
              <p className="font-semibold text-sm">
                Excluir TODAS as {deletingGroup.total} parcelas
              </p>
              <p className="text-xs text-negative/80 mt-0.5">
                Cancela a compra inteira em todos os meses.
              </p>
            </button>

            <button
              onClick={() => setDeletingGroup(null)}
              className="btn-ghost w-full"
            >
              Cancelar
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
