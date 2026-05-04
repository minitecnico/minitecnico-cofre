import { useState, useMemo } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Plus, Search, X } from 'lucide-react';
import { useTransactions } from '../hooks/useTransactions';
import TransactionList from '../components/TransactionList';
import Modal from '../components/Modal';
import TransactionForm from '../components/TransactionForm';
import BatchTransactionForm from '../components/BatchTransactionForm';
import MonthSelector from '../components/MonthSelector';
import { useDisclosure } from '../hooks/useDisclosure';
import { formatCurrency } from '../utils/format';
import { useMonth } from '../context/MonthContext';

export default function TransactionListPage({ type = 'income' }) {
  const isIncome = type === 'income';
  const { label } = useMonth();
  const { isOpen, open, close } = useDisclosure();
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState('single'); // 'single' | 'batch'

  const { items, total, loading, refresh, remove, togglePaid } = useTransactions({
    type,
    limit: 200,
  });

  // Busca client-side: descrição + categoria
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const q = searchTerm.toLowerCase().trim();
    return items.filter((t) => {
      const desc = (t.description || '').toLowerCase();
      const catName = (t.category?.name || '').toLowerCase();
      return desc.includes(q) || catName.includes(q);
    });
  }, [items, searchTerm]);

  const totalAmount = filteredItems.reduce((s, t) => s + Number(t.amount), 0);

  const pendingCount = !isIncome ? filteredItems.filter((t) => !t.paid).length : 0;
  const pendingTotal = !isIncome
    ? filteredItems.filter((t) => !t.paid).reduce((s, t) => s + Number(t.amount), 0)
    : 0;

  const Icon = isIncome ? ArrowUpCircle : ArrowDownCircle;
  const accentClass = isIncome ? 'text-positive' : 'text-negative';
  const bgAccent = isIncome ? 'bg-accent text-ink-900' : 'bg-ink-900 text-white';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] md:text-xs uppercase tracking-widest text-ink-500 font-semibold">
            {isIncome ? 'Entradas' : 'Saídas'} · {label}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-1 leading-tight flex items-center gap-2 md:gap-3">
            <Icon className={`w-7 h-7 md:w-10 md:h-10 ${accentClass} flex-shrink-0`} />
            <span className="truncate">{isIncome ? 'Receitas' : 'Despesas'}</span>
          </h1>
        </div>

        <button
          onClick={open}
          className={`px-4 md:px-5 py-2.5 md:py-3 min-h-[44px] font-semibold border-2 border-ink-900 shadow-flat-sm hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all ${bgAccent} self-start sm:self-end flex-shrink-0`}
        >
          <span className="flex items-center gap-2 text-sm md:text-base">
            <Plus className="w-5 h-5" />
            <span className="whitespace-nowrap">Nova {isIncome ? 'receita' : 'despesa'}</span>
          </span>
        </button>
      </div>

      {/* Seletor de mês */}
      <MonthSelector />

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5">
        <div
          className={`card-flat p-4 md:p-6 ${
            isIncome ? 'bg-accent' : 'bg-ink-900 text-ink-50'
          } md:col-span-${isIncome ? '3' : '2'}`}
        >
          <p
            className={`text-[10px] md:text-xs uppercase font-semibold tracking-widest ${
              isIncome ? 'text-ink-700' : 'text-ink-300'
            }`}
          >
            Total {isIncome ? 'recebido' : 'gasto'} no mês
            {searchTerm && <span className="ml-1 normal-case">· filtrado</span>}
          </p>
          <p className="stat-number text-3xl md:text-4xl mt-2 md:mt-3 break-all">
            {formatCurrency(totalAmount)}
          </p>
          <p className={`text-xs md:text-sm mt-2 ${isIncome ? 'text-ink-700' : 'text-ink-400'}`}>
            {filteredItems.length} {filteredItems.length === 1 ? 'transação' : 'transações'}
            {searchTerm && total !== filteredItems.length && (
              <span> de {total}</span>
            )}
          </p>
        </div>

        {!isIncome && (
          <div className="card-flat p-4 md:p-6 bg-white">
            <p className="text-[10px] md:text-xs uppercase font-semibold tracking-widest text-ink-500">
              Ainda a pagar
            </p>
            <p
              className={`stat-number text-3xl md:text-4xl mt-2 md:mt-3 break-all ${
                pendingTotal > 0 ? 'text-negative' : 'text-positive'
              }`}
            >
              {formatCurrency(pendingTotal)}
            </p>
            <p className="text-xs md:text-sm mt-2 text-ink-500">
              {pendingCount === 0
                ? '✓ Tudo pago'
                : `${pendingCount} ${pendingCount === 1 ? 'pendente' : 'pendentes'}`}
            </p>
          </div>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por descrição ou categoria…"
          className="input-field pl-10 pr-10"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center hover:bg-ink-100 transition-colors"
            aria-label="Limpar busca"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lista */}
      <TransactionList
        items={filteredItems}
        loading={loading}
        onChange={refresh}
        onDelete={remove}
        onTogglePaid={togglePaid}
        emptyMessage={
          searchTerm
            ? `Nenhuma ${isIncome ? 'receita' : 'despesa'} encontrada para "${searchTerm}".`
            : `Nenhuma ${isIncome ? 'receita' : 'despesa'} cadastrada em ${label}.`
        }
      />

      {/* Modal nova transação */}
      <Modal
        isOpen={isOpen}
        onClose={() => { close(); setMode('single'); }}
        title={
          mode === 'batch'
            ? `Lançamento em massa — ${isIncome ? 'Receitas' : 'Despesas'}`
            : `Nova ${isIncome ? 'receita' : 'despesa'}`
        }
        size={mode === 'batch' ? 'lg' : 'md'}
      >
        {mode === 'single' ? (
          <TransactionForm
            defaultType={type}
            onSaved={() => {
              close();
              setMode('single');
              refresh();
            }}
            onCancel={() => { close(); setMode('single'); }}
            onSwitchToBatch={() => setMode('batch')}
          />
        ) : (
          <BatchTransactionForm
            type={type}
            onSaved={() => {
              close();
              setMode('single');
              refresh();
            }}
            onCancel={() => { close(); setMode('single'); }}
          />
        )}
      </Modal>
    </div>
  );
}
