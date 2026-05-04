import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useMonth } from '../context/MonthContext';

export default function MonthSelector() {
  const { label, shortLabel, isCurrentMonth, goToPrevious, goToNext, goToCurrent } = useMonth();

  return (
    <div className="card-flat p-1.5 flex items-center gap-1">
      <button
        onClick={goToPrevious}
        className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-all duration-200 flex-shrink-0"
        aria-label="Mês anterior"
        title="Mês anterior"
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={2.25} />
      </button>

      <button
        onClick={goToCurrent}
        disabled={isCurrentMonth}
        className={`flex-1 flex items-center justify-center gap-2 min-h-[40px] px-3 py-2 rounded-xl transition-all duration-200 ${
          isCurrentMonth
            ? 'text-ink-900 cursor-default'
            : 'text-ink-700 hover:bg-accent/20 hover:text-ink-900 cursor-pointer'
        }`}
        title={isCurrentMonth ? 'Você está no mês atual' : 'Voltar ao mês atual'}
      >
        <Calendar className="w-4 h-4 flex-shrink-0" strokeWidth={2.25} />
        <span className="font-display font-bold text-base md:text-lg truncate tracking-tight">
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </span>
        {!isCurrentMonth && (
          <span className="hidden md:inline text-[10px] tracking-wider font-semibold text-ink-500 ml-1">
            · ir pra hoje
          </span>
        )}
      </button>

      <button
        onClick={goToNext}
        className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-all duration-200 flex-shrink-0"
        aria-label="Próximo mês"
        title="Próximo mês"
      >
        <ChevronRight className="w-5 h-5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
