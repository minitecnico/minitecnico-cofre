import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Trophy, Sparkles, RotateCcw, Trash2, Plus, Check,
  Flame, TrendingUp, Edit2, X,
} from 'lucide-react';
import { weeklyChallengeService } from '../services/goals';
import { formatCurrency, parseAmount } from '../utils/format';
import Modal from './Modal';

/**
 * Componente raiz do Desafio 52 Semanas.
 *
 * Estados:
 *   - Sem desafio → tela de criação
 *   - Com desafio → grid heatmap + estatísticas + ações
 *
 * Lógica do desafio:
 *   - Você escolhe um multiplicador (R$ 1, 5, 10, 20, 50)
 *   - Semana N = N × multiplicador (semana 1 = 1×, semana 52 = 52×)
 *   - Total = (52 × 53 / 2) × multiplicador = 1378 × multiplicador
 *   - Click numa semana → marca como paga (verde-limão)
 *   - Click de novo → desmarca
 */
export default function WeeklyChallenge() {
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingMultiplier, setEditingMultiplier] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await weeklyChallengeService.getActive();
      setChallenge(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggleWeek(weekIndex) {
    if (!challenge) return;
    // Atualização otimista pra UX instantânea
    const oldStatus = [...(challenge.weeks_status || [])];
    while (oldStatus.length < 52) oldStatus.push(false);
    const newStatus = [...oldStatus];
    newStatus[weekIndex] = !newStatus[weekIndex];
    setChallenge({ ...challenge, weeks_status: newStatus });

    try {
      const updated = await weeklyChallengeService.toggleWeek(challenge.id, weekIndex);
      setChallenge(updated);
    } catch (err) {
      // Reverte em caso de erro
      setChallenge({ ...challenge, weeks_status: oldStatus });
      alert('Erro: ' + err.message);
    }
  }

  async function handleReset() {
    setConfirmReset(false);
    const updated = await weeklyChallengeService.reset(challenge.id);
    setChallenge(updated);
  }

  async function handleDelete() {
    setConfirmDelete(false);
    await weeklyChallengeService.remove(challenge.id);
    setChallenge(null);
  }

  if (loading) {
    return <div className="card-flat p-8 animate-pulse h-96 bg-ink-100" />;
  }

  if (!challenge && !creating) {
    return <ChallengeIntro onStart={() => setCreating(true)} />;
  }

  if (creating && !challenge) {
    return (
      <CreateChallenge
        onCreated={(c) => { setChallenge(c); setCreating(false); }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  return (
    <ActiveChallengeView
      challenge={challenge}
      onToggleWeek={handleToggleWeek}
      onResetClick={() => setConfirmReset(true)}
      onDeleteClick={() => setConfirmDelete(true)}
      onEditMultiplier={() => setEditingMultiplier(true)}
      confirmReset={confirmReset}
      onCancelReset={() => setConfirmReset(false)}
      onConfirmReset={handleReset}
      confirmDelete={confirmDelete}
      onCancelDelete={() => setConfirmDelete(false)}
      onConfirmDelete={handleDelete}
      editingMultiplier={editingMultiplier}
      onCancelEditMultiplier={() => setEditingMultiplier(false)}
      onMultiplierUpdated={(updated) => { setChallenge(updated); setEditingMultiplier(false); }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tela: ainda não tem desafio
// ─────────────────────────────────────────────────────────────────────────

function ChallengeIntro({ onStart }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 text-white p-6 md:p-8 shadow-soft-lg">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-accent flex items-center justify-center flex-shrink-0 shadow-soft-md">
          <Trophy className="w-6 h-6 text-ink-900" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight">
            Desafio 52 Semanas
          </h2>
          <p className="text-ink-300 text-sm mt-1">
            Junte dinheiro semana a semana, de forma crescente. No fim do ano você terá uma reserva considerável.
          </p>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 mb-5">
        <p className="text-sm leading-relaxed">
          <strong className="text-accent">Como funciona:</strong> você escolhe um multiplicador (R$ 1, 5, 10…).
          Na semana <strong>1</strong> você guarda <strong>1×</strong> esse valor. Na semana <strong>2</strong>, <strong>2×</strong>.
          E assim até a semana <strong>52</strong>.
        </p>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-white/5 rounded-lg py-2 px-2">
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold">Multiplicador R$ 1</p>
            <p className="font-display font-bold text-base mt-0.5">R$ 1.378</p>
          </div>
          <div className="bg-white/5 rounded-lg py-2 px-2">
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold">R$ 5</p>
            <p className="font-display font-bold text-base mt-0.5">R$ 6.890</p>
          </div>
          <div className="bg-white/5 rounded-lg py-2 px-2">
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold">R$ 10</p>
            <p className="font-display font-bold text-base mt-0.5">R$ 13.780</p>
          </div>
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full px-5 py-3 min-h-[48px] bg-accent text-ink-900 font-bold rounded-xl shadow-soft-md hover:shadow-soft-lg active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Sparkles className="w-5 h-5" strokeWidth={2.5} />
        Começar meu desafio
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tela: criando desafio
// ─────────────────────────────────────────────────────────────────────────

const PRESET_MULTIPLIERS = [1, 5, 10, 20, 50, 100];

function CreateChallenge({ onCreated, onCancel }) {
  const [title, setTitle] = useState('Meu Desafio 52 Semanas');
  const [multiplier, setMultiplier] = useState(5);
  const [customMultiplier, setCustomMultiplier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const finalMultiplier = customMultiplier ? parseAmount(customMultiplier) : multiplier;
  const total = finalMultiplier * 1378; // 1+2+3+...+52 = 1378

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!finalMultiplier || finalMultiplier <= 0) {
        throw new Error('Multiplicador deve ser maior que zero');
      }
      const created = await weeklyChallengeService.create({
        title: title.trim() || 'Desafio 52 Semanas',
        multiplier: finalMultiplier,
      });
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-flat p-5 md:p-6 space-y-4">
      <div>
        <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight">Novo desafio</h2>
        <p className="text-sm text-ink-500 mt-1">Escolha o multiplicador e comece já.</p>
      </div>

      <div>
        <label className="label">Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field"
          maxLength={60}
        />
      </div>

      <div>
        <label className="label">Multiplicador</label>
        <p className="text-xs text-ink-500 mb-2">
          Quanto vale "1×" na sua semana 1? Esse valor multiplica em cada semana seguinte.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {PRESET_MULTIPLIERS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMultiplier(m); setCustomMultiplier(''); }}
              className={`px-3 py-2.5 min-h-[44px] rounded-xl font-bold text-sm transition-all duration-200 ${
                !customMultiplier && multiplier === m
                  ? 'bg-gradient-dark text-white shadow-soft'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              }`}
            >
              R$ {m}
            </button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-500 font-mono pointer-events-none">
            ou customizado: R$
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={customMultiplier}
            onChange={(e) => setCustomMultiplier(e.target.value)}
            placeholder="0,00"
            className="input-field pl-44 font-mono text-right"
          />
        </div>
      </div>

      {finalMultiplier > 0 && (
        <div className="rounded-2xl bg-gradient-accent p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-ink-900/80">Total ao final</p>
              <p className="font-display text-2xl md:text-3xl font-bold text-ink-900 mt-1">
                {formatCurrency(total)}
              </p>
              <p className="text-xs text-ink-900/80 mt-0.5">
                Semana 1: {formatCurrency(finalMultiplier)} · Semana 52: {formatCurrency(finalMultiplier * 52)}
              </p>
            </div>
            <Trophy className="w-12 h-12 text-ink-900 flex-shrink-0" strokeWidth={2} />
          </div>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-negative text-negative text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={submitting} className="btn-accent flex-1 disabled:opacity-60">
          {submitting ? 'Criando…' : 'Iniciar desafio'}
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tela: desafio ativo (heatmap + stats)
// ─────────────────────────────────────────────────────────────────────────

function ActiveChallengeView({
  challenge, onToggleWeek, onResetClick, onDeleteClick, onEditMultiplier,
  confirmReset, onCancelReset, onConfirmReset,
  confirmDelete, onCancelDelete, onConfirmDelete,
  editingMultiplier, onCancelEditMultiplier, onMultiplierUpdated,
}) {
  const multiplier = Number(challenge.multiplier);
  const weeks = useMemo(() => {
    const arr = [...(challenge.weeks_status || [])];
    while (arr.length < 52) arr.push(false);
    return arr.slice(0, 52);
  }, [challenge.weeks_status]);

  // Stats
  const totalTarget = multiplier * 1378;
  const completedWeeks = weeks.filter(Boolean).length;
  const savedAmount = weeks.reduce((sum, paid, i) => paid ? sum + (i + 1) * multiplier : sum, 0);
  const remainingAmount = totalTarget - savedAmount;
  const progress = totalTarget > 0 ? (savedAmount / totalTarget) * 100 : 0;
  const isComplete = completedWeeks === 52;

  // "Streak" — quantas semanas consecutivas pagas a partir da última
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 51; i >= 0; i--) {
      if (weeks[i]) count++;
      else break;
    }
    return count;
  }, [weeks]);

  // Próxima semana a pagar (primeira não-paga)
  const nextWeekIdx = weeks.findIndex((paid) => !paid);

  return (
    <div className="space-y-4">
      {/* Header com título + ações */}
      <div className="card-flat p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-ink-500 font-bold">Desafio</p>
            <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight mt-0.5 truncate">
              {challenge.title}
            </h2>
            <p className="text-sm text-ink-500 mt-1">
              <button
                onClick={onEditMultiplier}
                className="inline-flex items-center gap-1 hover:text-ink-900 hover:underline transition-colors"
              >
                <span>Multiplicador {formatCurrency(multiplier)}</span>
                <Edit2 className="w-3 h-3" />
              </button>
            </p>
          </div>

          <div className="flex gap-1">
            <button
              onClick={onResetClick}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors"
              title="Resetar"
              aria-label="Resetar desafio"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onDeleteClick}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-500 hover:text-negative hover:bg-red-50 transition-colors"
              title="Excluir"
              aria-label="Excluir desafio"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBlock
            label="Guardado"
            value={formatCurrency(savedAmount)}
            sublabel={`${progress.toFixed(0)}%`}
            highlight
          />
          <StatBlock
            label="Faltam"
            value={formatCurrency(remainingAmount)}
            sublabel={isComplete ? 'Completo!' : `${52 - completedWeeks} semanas`}
          />
          <StatBlock
            label="Sequência"
            value={`${streak}`}
            sublabel={streak > 0 ? 'semanas seguidas' : 'sem sequência'}
            icon={streak >= 4 ? Flame : null}
          />
          <StatBlock
            label="Total alvo"
            value={formatCurrency(totalTarget)}
            sublabel="52 semanas"
          />
        </div>

        {/* Barra de progresso */}
        <div className="mt-4">
          <div className="h-3 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-accent rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {isComplete && (
          <div className="mt-4 p-3 rounded-xl bg-gradient-accent text-ink-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 flex-shrink-0" />
            <p className="font-bold text-sm">Parabéns! Você completou o desafio! 🎉</p>
          </div>
        )}
      </div>

      {/* Próxima semana — destaque */}
      {!isComplete && nextWeekIdx !== -1 && (
        <button
          onClick={() => onToggleWeek(nextWeekIdx)}
          className="w-full rounded-2xl bg-gradient-to-br from-ink-900 to-ink-800 text-white p-4 md:p-5 hover:shadow-soft-lg active:scale-[0.99] transition-all duration-200 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-accent font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Próxima
              </p>
              <p className="font-display font-bold text-lg md:text-xl mt-1">
                Semana {nextWeekIdx + 1} · {formatCurrency((nextWeekIdx + 1) * multiplier)}
              </p>
              <p className="text-xs text-ink-300 mt-0.5">
                Toque pra marcar como guardado
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Check className="w-6 h-6 text-accent" strokeWidth={2.5} />
            </div>
          </div>
        </button>
      )}

      {/* Grid heatmap de 52 semanas */}
      <div className="card-flat p-4 md:p-5">
        <h3 className="font-display font-bold text-base md:text-lg tracking-tight mb-3">
          Suas 52 semanas
        </h3>
        <div
          className="grid gap-1 md:gap-1.5"
          style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
        >
          {weeks.map((paid, i) => (
            <WeekCell
              key={i}
              weekNumber={i + 1}
              amount={(i + 1) * multiplier}
              paid={paid}
              isNext={i === nextWeekIdx && !isComplete}
              onClick={() => onToggleWeek(i)}
            />
          ))}
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-4 mt-4 text-[10px] uppercase tracking-widest font-bold text-ink-500 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-ink-100 border border-ink-200" />
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gradient-dark ring-2 ring-accent" />
            <span>Próxima</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-accent" />
            <span>Pago</span>
          </div>
        </div>
      </div>

      {/* Modais */}
      <Modal isOpen={confirmReset} onClose={onCancelReset} title="Resetar desafio">
        <div className="space-y-4">
          <p className="text-sm">
            Tem certeza que deseja resetar todas as semanas?
            <br />
            <strong>Você perderá o progresso atual ({formatCurrency(savedAmount)} guardado).</strong>
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={onCancelReset} className="btn-ghost">Cancelar</button>
            <button
              onClick={onConfirmReset}
              className="flex-1 px-5 py-3 min-h-[44px] bg-warn text-ink-900 font-bold rounded-xl shadow-soft-md hover:shadow-soft-lg active:scale-[0.98] transition-all duration-200"
            >
              Resetar tudo
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={confirmDelete} onClose={onCancelDelete} title="Excluir desafio">
        <div className="space-y-4">
          <p className="text-sm">
            Tem certeza que deseja excluir esse desafio? <strong>Esta ação não pode ser desfeita.</strong>
            Você poderá criar um novo depois.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={onCancelDelete} className="btn-ghost">Cancelar</button>
            <button
              onClick={onConfirmDelete}
              className="flex-1 px-5 py-3 min-h-[44px] bg-negative text-white font-bold rounded-xl shadow-soft-md hover:shadow-soft-lg active:scale-[0.98] transition-all duration-200"
            >
              Excluir desafio
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editingMultiplier} onClose={onCancelEditMultiplier} title="Alterar multiplicador">
        <EditMultiplierForm
          challenge={challenge}
          onSaved={onMultiplierUpdated}
          onCancel={onCancelEditMultiplier}
        />
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────

function StatBlock({ label, value, sublabel, highlight, icon: Icon }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-gradient-accent text-ink-900' : 'bg-ink-50'}`}>
      <p className={`text-[10px] uppercase tracking-widest font-bold ${highlight ? 'text-ink-900/80' : 'text-ink-500'}`}>
        {label}
      </p>
      <p className={`font-display text-base md:text-lg font-bold mt-0.5 truncate ${highlight ? 'text-ink-900' : 'text-ink-900'}`}>
        {value}
      </p>
      <p className={`text-[10px] mt-0.5 truncate flex items-center gap-1 ${highlight ? 'text-ink-900/70' : 'text-ink-500'}`}>
        {Icon && <Icon className="w-3 h-3" />}
        {sublabel}
      </p>
    </div>
  );
}

function WeekCell({ weekNumber, amount, paid, isNext, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`aspect-square rounded-md md:rounded-lg flex items-center justify-center text-[9px] md:text-[10px] font-bold transition-all duration-150 active:scale-90 relative group ${
        paid
          ? 'bg-accent text-ink-900 hover:bg-accent/80 shadow-soft'
          : isNext
            ? 'bg-gradient-dark text-white ring-2 ring-accent ring-offset-1 hover:scale-105'
            : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
      }`}
      title={`Semana ${weekNumber} · ${formatCurrency(amount)}${paid ? ' · ✓ Pago' : ''}`}
    >
      {paid ? <Check className="w-3 h-3 md:w-4 md:h-4" strokeWidth={3} /> : weekNumber}
    </button>
  );
}

function EditMultiplierForm({ challenge, onSaved, onCancel }) {
  const [value, setValue] = useState(String(challenge.multiplier).replace('.', ','));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const m = parseAmount(value);
      if (!m || m <= 0) throw new Error('Valor inválido');
      const updated = await weeklyChallengeService.update(challenge.id, { multiplier: m });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="px-4 py-3 bg-yellow-50 border border-warn/40 rounded-xl text-xs text-yellow-900">
        ⚠ Mudar o multiplicador <strong>não altera as semanas já marcadas como pagas</strong>,
        mas o valor total e os valores de cada semana serão recalculados.
      </div>
      <div>
        <label className="label">Novo multiplicador</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500 font-mono pointer-events-none">R$</span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input-field pl-10 font-mono text-right"
            autoFocus
          />
        </div>
      </div>
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-negative text-negative text-sm rounded-xl">{error}</div>
      )}
      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancelar</button>
        <button type="submit" disabled={submitting} className="btn-accent flex-1">
          {submitting ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
