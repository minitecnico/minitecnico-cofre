import { useState, useEffect, useMemo } from 'react';
import { Repeat, CreditCard as CardIcon } from 'lucide-react';
import { categoryService, transactionService, cardService, recurringService } from '../services';
import { parseAmount, formatCurrency, splitInstallmentAmount } from '../utils/format';
import { useMonth } from '../context/MonthContext';

/**
 * Formulário de transação com:
 *  - Receita ou despesa
 *  - Pagamento via conta ou cartão
 *  - Recorrência mensal (cria modelo)
 *  - Parcelamento (apenas para despesas no cartão)
 *
 * Recorrência e parcelamento são MUTUAMENTE EXCLUSIVOS — uma compra parcelada
 * já cria múltiplas transações; recorrente é um modelo separado.
 */
export default function TransactionForm({ initial = null, onSaved, onCancel, onSwitchToBatch, defaultType = 'expense' }) {
  const isEdit = !!initial;
  const { isCurrentMonth, startDate: monthStart, month: currentMonthString } = useMonth();

  const defaultDate = initial?.date
    || (isCurrentMonth ? new Date().toISOString().slice(0, 10) : monthStart);

  const [type, setType] = useState(initial?.type || defaultType);
  const [amount, setAmount] = useState(initial?.amount?.toString().replace('.', ',') || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [date, setDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState(initial?.category?.id || '');
  const [creditCardId, setCreditCardId] = useState(initial?.credit_card?.id || '');
  const [paymentMethod, setPaymentMethod] = useState(initial?.credit_card ? 'card' : 'account');
  const [isRecurring, setIsRecurring] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(1);

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

  // Reset parcelamento se trocar de pagamento ou tipo
  useEffect(() => {
    if (paymentMethod !== 'card' || type !== 'expense') {
      setInstallmentCount(1);
    }
  }, [paymentMethod, type]);

  // Recorrência e parcelamento são exclusivos
  useEffect(() => {
    if (installmentCount > 1) setIsRecurring(false);
  }, [installmentCount]);

  useEffect(() => {
    if (isRecurring) setInstallmentCount(1);
  }, [isRecurring]);

  // Calcula valor por parcela em tempo real (preview)
  const installmentPreview = useMemo(() => {
    const total = parseAmount(amount);
    if (installmentCount < 2 || total <= 0) return null;
    const parts = splitInstallmentAmount(total, installmentCount);
    return {
      perInstallment: parts[0],
      hasRounding: parts[0] !== parts[parts.length - 1],
    };
  }, [amount, installmentCount]);

  // Pode parcelar? Só despesas no cartão, com valor > 0, não sendo edição
  const canShowInstallments = !isEdit && type === 'expense' && paymentMethod === 'card';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const parsedAmount = parseAmount(amount);
      const trimmedDesc = description.trim();
      const cardIdToUse = type === 'expense' && paymentMethod === 'card' ? creditCardId : null;

      if (!parsedAmount || parsedAmount <= 0) throw new Error('Informe um valor válido');
      if (!trimmedDesc) throw new Error('Informe uma descrição');
      if (!categoryId) throw new Error('Selecione uma categoria');
      if (type === 'expense' && paymentMethod === 'card' && !creditCardId) {
        throw new Error('Selecione um cartão');
      }
      if (installmentCount > 1 && (!cardIdToUse)) {
        throw new Error('Parcelamento exige cartão de crédito');
      }

      // Edição (sempre uma transação só)
      if (isEdit) {
        await transactionService.update(initial.id, {
          type,
          amount: parsedAmount,
          description: trimmedDesc,
          date,
          category_id: categoryId,
          credit_card_id: cardIdToUse,
        });
      }
      // Recorrência (modelo + 1 transação no mês atual)
      else if (isRecurring) {
        const dayOfMonth = new Date(date + 'T00:00:00').getDate();
        const startMonth = `${currentMonthString}-01`;
        const recurring = await recurringService.create({
          type,
          amount: parsedAmount,
          description: trimmedDesc,
          category_id: categoryId,
          credit_card_id: cardIdToUse,
          day_of_month: dayOfMonth,
          start_month: startMonth,
        });
        const { supabase } = await import('../services/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        const { error: txErr } = await supabase.from('transactions').insert({
          user_id: user.id,
          type,
          amount: parsedAmount,
          description: trimmedDesc,
          date,
          category_id: categoryId,
          credit_card_id: cardIdToUse,
          recurring_id: recurring.id,
          paid: type === 'income',
        });
        if (txErr) throw txErr;
      }
      // Parcelamento (cria N transações em meses diferentes)
      else if (installmentCount > 1) {
        await transactionService.createInstallments({
          type,
          totalAmount: parsedAmount,
          installmentCount,
          startDate: date,
          description: trimmedDesc,
          category_id: categoryId,
          credit_card_id: cardIdToUse,
        });
      }
      // Transação simples
      else {
        await transactionService.create({
          type,
          amount: parsedAmount,
          description: trimmedDesc,
          date,
          category_id: categoryId,
          credit_card_id: cardIdToUse,
        });
      }

      onSaved?.();
    } catch (err) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
      {/* Toggle Receita/Despesa */}
      {!isEdit && (
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
        <label className="label">
          {installmentCount > 1 ? `Valor TOTAL da compra` : 'Valor'}
        </label>
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
        {installmentPreview && (
          <p className="text-xs text-ink-600 mt-2">
            <strong>{installmentCount}x</strong> de{' '}
            <span className="font-mono font-semibold text-ink-900">
              {formatCurrency(installmentPreview.perInstallment)}
            </span>
            {installmentPreview.hasRounding && (
              <span className="text-ink-500"> (com ajuste de centavos)</span>
            )}
          </p>
        )}
      </div>

      <div>
        <label className="label">Descrição</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === 'income' ? 'Ex: Salário' : 'Ex: Tênis novo'}
          className="input-field"
          maxLength={100}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">{installmentCount > 1 ? 'Data da 1ª parcela' : 'Data'}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
            {categories.length === 0 && <option value="">— Carregando —</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Forma de pagamento — apenas para despesas */}
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
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Parcelamento — apenas para despesa no cartão */}
      {canShowInstallments && (
        <div>
          <label className="label flex items-center gap-2">
            <CardIcon className="w-3.5 h-3.5" />
            Parcelas
          </label>
          <select
            value={installmentCount}
            onChange={(e) => setInstallmentCount(parseInt(e.target.value, 10))}
            className="input-field"
          >
            <option value={1}>À vista</option>
            <optgroup label="Parcelado (curto prazo)">
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 24].map((n) => (
                <option key={n} value={n}>{n}x</option>
              ))}
            </optgroup>
            <optgroup label="Empréstimo / Financiamento (longo prazo)">
              {[36, 48, 60, 72, 84, 96, 120, 180, 240].map((n) => (
                <option key={n} value={n}>{n}x · {Math.round(n / 12 * 10) / 10} anos</option>
              ))}
            </optgroup>
          </select>
          {installmentCount > 1 && (
            <p className="text-xs text-ink-600 mt-2 px-3 py-2.5 bg-accent/20 rounded-xl">
              ✨ Vamos criar <strong>{installmentCount} parcelas</strong>{' '}
              {installmentCount >= 36 && (
                <span>(≈ {Math.round(installmentCount / 12 * 10) / 10} anos)</span>
              )}{' '}
              automaticamente, uma em cada mês. Você pode editar ou excluir parcelas individuais depois.
            </p>
          )}
        </div>
      )}

      {/* Recorrência — só em criação, e não pode ter parcelamento */}
      {!isEdit && installmentCount === 1 && (
        <label
          className={`flex items-start gap-3 p-3 md:p-4 border-2 cursor-pointer transition-colors ${
            isRecurring ? 'border-ink-900 bg-accent/30' : 'border-ink-300 hover:border-ink-900 bg-white'
          }`}
        >
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-ink-900 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Repeat className="w-4 h-4" strokeWidth={2.5} />
              É recorrente?
            </div>
            <p className="text-xs text-ink-600 mt-0.5">
              {isRecurring
                ? `Será criada automaticamente todo mês no dia ${
                    new Date(date + 'T00:00:00').getDate()
                  }.`
                : 'Marque para repetir essa transação todos os meses.'}
            </p>
          </div>
        </label>
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
          {submitting
            ? 'Salvando…'
            : isEdit
              ? 'Salvar alterações'
              : isRecurring
                ? 'Criar recorrência'
                : installmentCount > 1
                  ? `Criar ${installmentCount} parcelas`
                  : 'Adicionar transação'}
        </button>
      </div>

      {/* Atalho para lançamento em massa — só em modo criação, e quando não está em modos especiais */}
      {!isEdit && !isRecurring && installmentCount === 1 && onSwitchToBatch && (
        <button
          type="button"
          onClick={() => onSwitchToBatch(type)}
          className="w-full text-xs text-ink-500 hover:text-ink-900 underline decoration-2 decoration-accent underline-offset-4 pt-2"
        >
          + Quero lançar várias {type === 'income' ? 'receitas' : 'despesas'} de uma vez
        </button>
      )}
    </form>
  );
}
