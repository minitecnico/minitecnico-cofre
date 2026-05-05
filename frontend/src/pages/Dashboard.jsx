import { useState, useMemo } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Sparkles,
  Filter, ArrowUpDown, Clock, Check, Repeat, Layers,
} from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';
import { dashboardService } from '../services';
import StatCard from '../components/StatCard';
import { MonthlyChart, CategoryChart } from '../components/Charts';
import TransactionList from '../components/TransactionList';
import { useTransactions } from '../hooks/useTransactions';
import { formatCurrency } from '../utils/format';
import InstallBanner from '../components/InstallBanner';
import MonthSelector from '../components/MonthSelector';
import { useMonth } from '../context/MonthContext';

/**
 * Filtros disponíveis na lista de transações do dashboard:
 *   - status: all | pending | paid
 *   - kind:   all | recurring | installment
 *   - sort:   date_desc (recentes 1º) | date_asc | due (vencimento próximo 1º) | amount_desc
 */
const STATUS_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Pendentes', icon: Clock },
  { id: 'paid', label: 'Pagas', icon: Check },
];

const KIND_FILTERS = [
  { id: 'all', label: 'Todos os tipos' },
  { id: 'recurring', label: 'Recorrentes', icon: Repeat },
  { id: 'installment', label: 'Parceladas', icon: Layers },
];

const SORT_OPTIONS = [
  { id: 'due', label: 'Vencimento próximo' },
  { id: 'date_desc', label: 'Mais recentes' },
  { id: 'date_asc', label: 'Mais antigas' },
  { id: 'amount_desc', label: 'Maior valor' },
  { id: 'amount_asc', label: 'Menor valor' },
];

export default function Dashboard() {
  const { data, loading, refresh } = useDashboard('month');
  // Buscamos um número maior de transações pra dar conta dos filtros
  const { items: rawItems, refresh: refreshList, remove: removeTx, togglePaid: togglePaidTx } = useTransactions({ limit: 100 });
  const { label: monthLabel } = useMonth();
  const [forecast, setForecast] = useState(null);

  // Estados dos filtros
  const [statusFilter, setStatusFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due');

  async function loadForecast() {
    const data = await dashboardService.forecast(3);
    setForecast(data);
  }

  function refreshAll() {
    refresh();
    refreshList();
    if (forecast) loadForecast();
  }

  // Aplica filtros + ordenação
  const filteredItems = useMemo(() => {
    let items = [...rawItems];

    // Filtro por status (só faz sentido para despesas; receitas sempre "pagas")
    if (statusFilter === 'pending') {
      items = items.filter((t) => t.type === 'expense' && !t.paid);
    } else if (statusFilter === 'paid') {
      items = items.filter((t) => t.type === 'expense' && t.paid);
    }

    // Filtro por tipo
    if (kindFilter === 'recurring') {
      items = items.filter((t) => !!t.recurring_id);
    } else if (kindFilter === 'installment') {
      items = items.filter((t) => !!t.installment_group_id && t.installment_total > 1);
    }

    // Ordenação
    items.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':
          return new Date(b.date) - new Date(a.date);
        case 'date_asc':
          return new Date(a.date) - new Date(b.date);
        case 'amount_desc':
          return Number(b.amount) - Number(a.amount);
        case 'amount_asc':
          return Number(a.amount) - Number(b.amount);
        case 'due':
        default: {
          // Despesas pendentes 1º (ordenadas por data crescente),
          // depois receitas/pagas (mais recentes 1º)
          const aPending = a.type === 'expense' && !a.paid;
          const bPending = b.type === 'expense' && !b.paid;
          if (aPending && !bPending) return -1;
          if (!aPending && bPending) return 1;
          if (aPending && bPending) return new Date(a.date) - new Date(b.date);
          return new Date(b.date) - new Date(a.date);
        }
      }
    });

    return items;
  }, [rawItems, statusFilter, kindFilter, sortBy]);

  // Conta pendentes pra mostrar badge no chip
  const pendingCount = useMemo(
    () => rawItems.filter((t) => t.type === 'expense' && !t.paid).length,
    [rawItems]
  );

  if (loading && !data) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="h-20 md:h-32 bg-ink-100 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 md:h-40 bg-ink-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasAlerts = data.alerts.length > 0;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Seletor de mês — controla todo o conteúdo */}
      <MonthSelector />

      {/* Banner de instalação PWA (some quando instalado/dispensado) */}
      <InstallBanner />

      {/* Stat cards COM alertas inline (sutis) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 stagger">
        <StatCard
          label="Saldo do mês"
          sublabel={monthLabel}
          value={data.balance.balance}
          variant="balance"
          icon={Wallet}
          trend={data.comparison?.balanceChange}
        />
        <StatCard
          label="Receitas"
          sublabel={monthLabel}
          value={data.periodSummary.income}
          variant="income"
          icon={TrendingUp}
          trend={data.comparison?.incomeChange}
        />
        <StatCard
          label="Despesas"
          sublabel={monthLabel}
          value={data.periodSummary.expense}
          variant="expense"
          icon={TrendingDown}
          trend={data.comparison?.expenseChange}
        />
      </div>

      {/* Alertas — agora discretos: chips inline em vez de banners gritantes */}
      {hasAlerts && (
        <div className="flex flex-wrap items-center gap-2">
          {data.alerts.map((a, i) => {
            const Icon = a.type === 'danger' ? AlertCircle : AlertTriangle;
            return (
              <div
                key={i}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  a.type === 'danger'
                    ? 'bg-red-50 text-negative border border-negative/30'
                    : 'bg-yellow-50 text-yellow-900 border border-warn/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{a.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5">
        <MonthlyChart data={data.monthlyHistory} />
        <CategoryChart data={data.byCategory} />
      </div>

      {/* Forecast */}
      <div className="rounded-2xl shadow-soft-md bg-gradient-dark text-ink-50 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 md:mb-4 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-[10px] md:text-xs uppercase tracking-widest text-accent font-bold">
                Simulação
              </p>
            </div>
            <h3 className="font-display text-xl md:text-2xl font-bold tracking-tight">Saldo projetado</h3>
            <p className="text-xs md:text-sm text-ink-300 mt-1">
              Baseado na média dos últimos 3 meses
            </p>
          </div>
          {!forecast && (
            <button onClick={loadForecast} className="btn-accent self-start flex-shrink-0">
              Calcular projeção
            </button>
          )}
        </div>

        {forecast && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mt-4">
            {forecast.forecast.map((f) => {
              const [, m] = f.month.split('-');
              const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              return (
                <div key={f.month} className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3 md:p-4">
                  <p className="text-[10px] md:text-xs uppercase tracking-widest text-accent font-bold">
                    {months[parseInt(m, 10) - 1]}
                  </p>
                  <p className={`font-display font-bold text-xl md:text-2xl mt-2 break-all ${f.projected < 0 ? 'text-negative' : 'text-ink-50'}`}>
                    {formatCurrency(f.projected)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de transações com filtros inteligentes */}
      <div className="space-y-3 md:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl md:text-2xl font-bold tracking-tight">
            Transações de {monthLabel}
            <span className="ml-2 text-sm font-mono font-medium text-ink-500">
              ({filteredItems.length})
            </span>
          </h3>
        </div>

        {/* Filtros — chips horizontais */}
        <div className="card-flat p-3 md:p-4 space-y-3">
          {/* Status (despesas) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-bold text-ink-500 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Status
            </span>
            {STATUS_FILTERS.map(({ id, label, icon: Icon }) => {
              const active = statusFilter === id;
              const showBadge = id === 'pending' && pendingCount > 0;
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-gradient-dark text-white shadow-soft'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                  {showBadge && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      active ? 'bg-accent text-ink-900' : 'bg-negative text-white'
                    }`}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tipo */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-bold text-ink-500 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Tipo
            </span>
            {KIND_FILTERS.map(({ id, label, icon: Icon }) => {
              const active = kindFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setKindFilter(id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-gradient-dark text-white shadow-soft'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {label}
                </button>
              );
            })}
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-bold text-ink-500 flex items-center gap-1 mr-1">
              <ArrowUpDown className="w-3 h-3" /> Ordem
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 min-h-[32px] bg-ink-100 hover:bg-ink-200 text-xs font-semibold rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-ink-900 cursor-pointer transition-colors"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <TransactionList
          items={filteredItems}
          loading={false}
          onChange={refreshAll}
          onDelete={async (id) => {
            await removeTx(id);
            refresh();
          }}
          onTogglePaid={togglePaidTx}
          emptyMessage={
            statusFilter !== 'all' || kindFilter !== 'all'
              ? 'Nenhuma transação corresponde aos filtros aplicados.'
              : `Nenhuma transação em ${monthLabel}. Use o botão "+" para adicionar.`
          }
        />
      </div>
    </div>
  );
}
