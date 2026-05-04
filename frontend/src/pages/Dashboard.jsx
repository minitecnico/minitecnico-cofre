import { useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Download, Sparkles } from 'lucide-react';
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

export default function Dashboard() {
  // Não precisamos mais do filtro de período local — o mês já vem do seletor global
  const { data, loading, refresh } = useDashboard('month');
  const { items: recent, refresh: refreshRecent, remove: removeTx, togglePaid: togglePaidTx } = useTransactions({ limit: 8 });
  const { label: monthLabel } = useMonth();
  const [forecast, setForecast] = useState(null);
  const [exporting, setExporting] = useState(false);

  async function loadForecast() {
    const data = await dashboardService.forecast(3);
    setForecast(data);
  }

  async function handleExport() {
    try {
      setExporting(true);
      const csv = await dashboardService.exportCSV();
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `transacoes-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function refreshAll() {
    refresh();
    refreshRecent();
    if (forecast) loadForecast();
  }

  if (loading && !data) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="h-20 md:h-32 bg-ink-100 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 md:h-40 bg-ink-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Botão de exportar (sem título — interface mais limpa) */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-primary disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{exporting ? 'Exportando…' : 'Exportar CSV'}</span>
          <span className="sm:hidden">{exporting ? 'Exportando…' : 'CSV'}</span>
        </button>
      </div>

      {/* Seletor de mês — controla todo o conteúdo do Dashboard */}
      <MonthSelector />

      {/* Banner de instalação PWA (some quando instalado/dispensado) */}
      <InstallBanner />

      {/* Alertas */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-3 md:px-4 py-3 border-2 ${
                a.type === 'danger'
                  ? 'bg-red-50 border-negative text-negative'
                  : 'bg-yellow-50 border-warn text-yellow-900'
              }`}
            >
              {a.type === 'danger' ? (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <p className="text-sm font-medium">{a.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-5">
        <MonthlyChart data={data.monthlyHistory} />
        <CategoryChart data={data.byCategory} />
      </div>

      {/* Forecast */}
      <div className="card-flat p-4 md:p-6 bg-ink-900 text-ink-50">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 md:mb-4 gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-[10px] md:text-xs uppercase tracking-widest text-accent font-bold">
                Simulação
              </p>
            </div>
            <h3 className="font-display text-xl md:text-2xl font-bold">Saldo projetado</h3>
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
                <div key={f.month} className="border-2 border-accent bg-ink-800 p-3 md:p-4">
                  <p className="text-[10px] md:text-xs uppercase tracking-widest text-accent font-bold">
                    {months[parseInt(m, 10) - 1]}
                  </p>
                  <p className={`font-mono text-xl md:text-2xl font-semibold mt-2 break-all ${f.projected < 0 ? 'text-negative' : 'text-ink-50'}`}>
                    {formatCurrency(f.projected)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transações recentes do mês */}
      <div>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="font-display text-xl md:text-2xl font-bold">
            Transações de {monthLabel}
          </h3>
        </div>
        <TransactionList
          items={recent}
          loading={false}
          onChange={refreshAll}
          onDelete={async (id) => {
            await removeTx(id);
            refresh();
          }}
          onTogglePaid={togglePaidTx}
          emptyMessage={`Nenhuma transação em ${monthLabel}. Use o botão "+" para adicionar.`}
        />
      </div>
    </div>
  );
}
