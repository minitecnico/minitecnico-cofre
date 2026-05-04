import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { categoryService, transactionService, cardService } from '../services';
import { parseAmount, formatCurrency } from '../utils/format';
import { useMonth } from '../context/MonthContext';

/**
 * Lançamento em massa de transações.
 * --------------------------------------------------------------
 * Permite adicionar múltiplas linhas (despesas ou receitas) e salvar
 * todas de uma vez via createBatch.
 *
 * Comportamento "herdar e sobrescrever":
 *   - A 1ª linha define data e cartão padrão.
 *   - Linhas subsequentes herdam por padrão (não precisa preencher de novo).
 *   - Cada linha pode ser "expandida" pra sobrescrever data/cartão.
 *
 * Visual: linhas compactas (1 linha por despesa) com sumário ao lado.
 */

function emptyItem(defaults = {}) {
  return {
    id: crypto.randomUUID(), // só pro React reconhecer key (não vai pro banco)
    description: '',
    amount: '',
    categoryId: defaults.categoryId || '',
    // overrides opcionais — se null, herda da config geral
    dateOverride: null,
    paymentMethodOverride: null, // 'account' | 'card' | null (herda)
    creditCardIdOverride: null,
    expanded: false,
  };
}

export default function BatchTransactionForm({ type = 'expense', onSaved, onCancel }) {
  const isIncome = type === 'income';
  const { isCurrentMonth, startDate: monthStart } = useMonth();

  const initialDate = isCurrentMonth ? new Date().toISOString().slice(0, 10) : monthStart;

  // Configuração comum (aplicada a todas as linhas que não sobrescrevem)
  const [commonDate, setCommonDate] = useState(initialDate);
  const [commonPaymentMethod, setCommonPaymentMethod] = useState(isIncome ? 'account' : 'card');
  const [commonCreditCardId, setCommonCreditCardId] = useState('');

  // Linhas
  const [items, setItems] = useState([emptyItem(), emptyItem()]);

  // Dados auxiliares
  const [categories, setCategories] = useState([]);
  const [cards, setCards] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    categoryService.list(type).then(setCategories).catch(() => setCategories([]));
    if (!isIncome) {
      cardService.list().then(setCards).catch(() => setCards([]));
    }
  }, [type, isIncome]);

  // Define categoria padrão na primeira carga
  useEffect(() => {
    if (categories.length === 0) return;
    setItems((prev) =>
      prev.map((it) =>
        it.categoryId ? it : { ...it, categoryId: categories[0].id }
      )
    );
  }, [categories]);

  // Auto-seleciona primeiro cartão (caso comum)
  useEffect(() => {
    if (cards.length > 0 && !commonCreditCardId) {
      setCommonCreditCardId(cards[0].card.id);
    }
  }, [cards, commonCreditCardId]);

  function updateItem(id, patch) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function addItem() {
    const lastCategoryId = items[items.length - 1]?.categoryId || categories[0]?.id || '';
    setItems((prev) => [...prev, emptyItem({ categoryId: lastCategoryId })]);
  }

  function removeItem(id) {
    if (items.length === 1) return; // sempre mantém pelo menos 1
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // Calcula total e quantidade de itens válidos (com descrição + valor)
  const summary = useMemo(() => {
    let total = 0;
    let validCount = 0;
    for (const it of items) {
      const amt = parseAmount(it.amount);
      if (amt > 0 && it.description.trim()) {
        total += amt;
        validCount++;
      }
    }
    return { total, validCount };
  }, [items]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Filtra só linhas válidas
    const validItems = items.filter(
      (it) => it.description.trim() && parseAmount(it.amount) > 0 && it.categoryId
    );

    if (validItems.length === 0) {
      setError('Adicione pelo menos uma transação preenchida (descrição, valor e categoria).');
      return;
    }

    setSubmitting(true);

    try {
      // Monta o payload final aplicando "herdar ou sobrescrever"
      const payload = validItems.map((it) => {
        const date = it.dateOverride || commonDate;
        const method = it.paymentMethodOverride || commonPaymentMethod;
        const cardId = it.creditCardIdOverride
          || (method === 'card' && !it.paymentMethodOverride ? commonCreditCardId : null);

        return {
          type,
          amount: parseAmount(it.amount),
          description: it.description.trim(),
          date,
          category_id: it.categoryId,
          credit_card_id: !isIncome && method === 'card' ? cardId : null,
        };
      });

      // Validação extra para despesas no cartão
      if (!isIncome) {
        for (const p of payload) {
          if (commonPaymentMethod === 'card' && !p.credit_card_id) {
            throw new Error('Selecione um cartão para o lançamento em massa.');
          }
        }
      }

      const { count } = await transactionService.createBatch(payload);
      onSaved?.(count);
    } catch (err) {
      setError(err.message || 'Erro ao salvar lançamentos');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
      {/* Cabeçalho informativo */}
      <div className="px-3 py-2 bg-accent/30 border-2 border-ink-900 text-xs md:text-sm">
        <Layers className="w-4 h-4 inline mr-1" />
        <strong>Lançamento em massa.</strong> Cadastre várias {isIncome ? 'receitas' : 'despesas'} de uma vez.
        A data e {!isIncome && 'forma de pagamento e '}categoria são preenchidas uma vez no topo
        — você pode sobrescrever em cada linha se precisar.
      </div>

      {/* Configurações comuns */}
      <div className="card-flat p-3 md:p-4 bg-ink-50 space-y-3">
        <p className="text-[10px] uppercase font-semibold tracking-widest text-ink-700">
          Aplicar a todas
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label !mb-1">Data</label>
            <input
              type="date"
              value={commonDate}
              onChange={(e) => setCommonDate(e.target.value)}
              className="input-field !min-h-[40px] !py-2"
            />
          </div>

          {!isIncome && (
            <div>
              <label className="label !mb-1">Forma de pagamento</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCommonPaymentMethod('account')}
                  className={`flex-1 px-2 py-2 text-xs font-medium border-2 transition-all ${
                    commonPaymentMethod === 'account'
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-700 border-ink-300 hover:border-ink-900'
                  }`}
                >
                  Conta
                </button>
                <button
                  type="button"
                  onClick={() => setCommonPaymentMethod('card')}
                  className={`flex-1 px-2 py-2 text-xs font-medium border-2 transition-all ${
                    commonPaymentMethod === 'card'
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-700 border-ink-300 hover:border-ink-900'
                  }`}
                >
                  Cartão
                </button>
              </div>
            </div>
          )}
        </div>

        {!isIncome && commonPaymentMethod === 'card' && (
          <div>
            <label className="label !mb-1">Cartão</label>
            <select
              value={commonCreditCardId}
              onChange={(e) => setCommonCreditCardId(e.target.value)}
              className="input-field !min-h-[40px] !py-2"
            >
              <option value="">Selecione um cartão</option>
              {cards.map(({ card }) => (
                <option key={card.id} value={card.id}>{card.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Linhas */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase font-semibold tracking-widest text-ink-700">
          {isIncome ? 'Receitas' : 'Despesas'} ({items.length})
        </p>

        {items.map((item, idx) => (
          <BatchItemRow
            key={item.id}
            item={item}
            index={idx}
            categories={categories}
            cards={cards}
            isIncome={isIncome}
            commonDate={commonDate}
            commonPaymentMethod={commonPaymentMethod}
            commonCreditCardId={commonCreditCardId}
            onChange={(patch) => updateItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
            canRemove={items.length > 1}
          />
        ))}

        <button
          type="button"
          onClick={addItem}
          className="w-full px-4 py-3 min-h-[44px] border-2 border-dashed border-ink-400 hover:border-ink-900 hover:bg-accent/20 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Adicionar outra {isIncome ? 'receita' : 'despesa'}
        </button>
      </div>

      {/* Resumo */}
      {summary.validCount > 0 && (
        <div className="px-4 py-3 bg-ink-900 text-ink-50 border-2 border-ink-900 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold">
              Total de {summary.validCount} {summary.validCount === 1 ? 'lançamento' : 'lançamentos'}
            </p>
            <p className="font-mono text-2xl font-semibold mt-0.5">{formatCurrency(summary.total)}</p>
          </div>
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
        <button
          type="submit"
          disabled={submitting || summary.validCount === 0}
          className="btn-accent flex-1 disabled:opacity-60"
        >
          {submitting
            ? 'Salvando…'
            : summary.validCount === 0
              ? 'Preencha pelo menos uma'
              : `Salvar ${summary.validCount} ${summary.validCount === 1 ? (isIncome ? 'receita' : 'despesa') : (isIncome ? 'receitas' : 'despesas')}`}
        </button>
      </div>
    </form>
  );
}

/**
 * Linha individual de uma transação no lançamento em massa.
 * Modo compacto por padrão; expande se o usuário quiser sobrescrever.
 */
function BatchItemRow({
  item,
  index,
  categories,
  cards,
  isIncome,
  commonDate,
  commonPaymentMethod,
  commonCreditCardId,
  onChange,
  onRemove,
  canRemove,
}) {
  const effectiveDate = item.dateOverride || commonDate;
  const effectiveMethod = item.paymentMethodOverride || commonPaymentMethod;
  const effectiveCardId = item.creditCardIdOverride
    || (effectiveMethod === 'card' && !item.paymentMethodOverride ? commonCreditCardId : null);

  const hasOverride = !!(item.dateOverride || item.paymentMethodOverride || item.creditCardIdOverride);

  function toggleExpand() {
    onChange({ expanded: !item.expanded });
  }

  function clearOverrides() {
    onChange({
      dateOverride: null,
      paymentMethodOverride: null,
      creditCardIdOverride: null,
      expanded: false,
    });
  }

  return (
    <div className={`border-2 ${item.expanded || hasOverride ? 'border-ink-900' : 'border-ink-200'} bg-white transition-colors`}>
      {/* Linha principal compacta */}
      <div className="flex items-stretch gap-2 p-2">
        <div className="flex items-center justify-center w-7 text-xs font-mono font-semibold text-ink-500">
          {index + 1}
        </div>

        <input
          type="text"
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Descrição (ex: Aluguel)"
          className="flex-1 min-w-0 px-2 py-2 bg-transparent border-0 focus:outline-none text-sm placeholder:text-ink-400"
          maxLength={100}
        />

        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-500 font-mono">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={item.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0,00"
            className="w-24 sm:w-28 pl-7 pr-2 py-2 bg-transparent border-0 focus:outline-none text-sm font-mono font-semibold text-right"
          />
        </div>

        <select
          value={item.categoryId}
          onChange={(e) => onChange({ categoryId: e.target.value })}
          className="w-28 sm:w-36 px-1.5 py-2 bg-transparent border-0 focus:outline-none text-xs cursor-pointer"
          aria-label="Categoria"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={toggleExpand}
          className={`w-8 flex items-center justify-center transition-colors ${
            hasOverride ? 'text-ink-900 bg-accent/30' : 'text-ink-400 hover:text-ink-900'
          }`}
          title={hasOverride ? 'Personalizado — clique para ajustar' : 'Personalizar data/pagamento'}
          aria-label="Personalizar"
        >
          {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="w-8 flex items-center justify-center text-ink-400 hover:text-negative hover:bg-red-50 transition-colors"
            aria-label="Remover linha"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Resumo compacto quando há override (mas não está expandido) */}
      {!item.expanded && hasOverride && (
        <div className="px-3 pb-2 text-[10px] text-ink-500 flex flex-wrap gap-x-3 gap-y-1">
          {item.dateOverride && (
            <span>📅 {new Date(item.dateOverride + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
          )}
          {item.paymentMethodOverride && (
            <span>💳 {item.paymentMethodOverride === 'card' ? 'Cartão personalizado' : 'Conta'}</span>
          )}
        </div>
      )}

      {/* Painel expandido pra sobrescrever data/cartão */}
      {item.expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t-2 border-ink-100 bg-ink-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label !mb-1 !text-[9px]">Data desta linha</label>
              <input
                type="date"
                value={item.dateOverride || effectiveDate}
                onChange={(e) =>
                  onChange({ dateOverride: e.target.value === commonDate ? null : e.target.value })
                }
                className="input-field !min-h-[36px] !py-1.5 !text-xs"
              />
            </div>

            {!isIncome && (
              <div>
                <label className="label !mb-1 !text-[9px]">Pagamento desta linha</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        paymentMethodOverride: 'account',
                        creditCardIdOverride: null,
                      })
                    }
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium border-2 transition-all ${
                      effectiveMethod === 'account'
                        ? 'bg-ink-900 text-white border-ink-900'
                        : 'bg-white text-ink-700 border-ink-300'
                    }`}
                  >
                    Conta
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ paymentMethodOverride: 'card' })}
                    className={`flex-1 px-2 py-1.5 text-[10px] font-medium border-2 transition-all ${
                      effectiveMethod === 'card'
                        ? 'bg-ink-900 text-white border-ink-900'
                        : 'bg-white text-ink-700 border-ink-300'
                    }`}
                  >
                    Cartão
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isIncome && effectiveMethod === 'card' && (
            <div>
              <label className="label !mb-1 !text-[9px]">Cartão desta linha</label>
              <select
                value={effectiveCardId || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({
                    creditCardIdOverride: v === commonCreditCardId ? null : v,
                  });
                }}
                className="input-field !min-h-[36px] !py-1.5 !text-xs"
              >
                <option value="">Selecione</option>
                {cards.map(({ card }) => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </select>
            </div>
          )}

          {hasOverride && (
            <button
              type="button"
              onClick={clearOverrides}
              className="text-xs underline text-ink-500 hover:text-ink-900"
            >
              Limpar personalização (voltar a usar configuração comum)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
