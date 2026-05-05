/**
 * Formata valor em Reais (BRL).
 */
export function formatCurrency(value, options = {}) {
  const { showSign = false, compact = false } = options;
  const num = Number(value) || 0;

  if (compact && Math.abs(num) >= 1000) {
    const formatted = new Intl.NumberFormat('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(num);
    return `R$ ${formatted}`;
  }

  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(num));

  if (showSign && num !== 0) {
    return `${num > 0 ? '+' : '−'} ${formatted}`;
  }
  return num < 0 ? `− ${formatted}` : formatted;
}

/**
 * Formata uma data para exibição.
 * --------------------------------------------------------------
 * IMPORTANTE: trata strings 'YYYY-MM-DD' como data LOCAL, não UTC.
 *
 * Por que isso importa: se você fizer new Date('2026-08-28'), o JS interpreta
 * como UTC midnight. Em timezones a oeste (Brasil = UTC-3), isso vira o dia
 * ANTERIOR (27/08 às 21h). O usuário cadastra dia 28 e vê dia 27 — bug clássico.
 *
 * A solução é parsear a string manualmente (ano, mês, dia) e construir
 * a Date com o construtor de componentes — que sempre é interpretado como local.
 */
export function formatDate(date, pattern = 'short') {
  let d;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    // String ISO de data: parseia componentes pra evitar shift de timezone
    const [y, m, dd] = date.slice(0, 10).split('-').map(Number);
    d = new Date(y, m - 1, dd);
  } else {
    d = new Date(date);
  }

  if (pattern === 'short') {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
  if (pattern === 'long') {
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }
  return d.toLocaleDateString('pt-BR');
}

export function formatPercent(value) {
  return `${Math.round(value)}%`;
}

/**
 * Converte string "1.234,56" → 1234.56
 */
export function parseAmount(input) {
  if (typeof input === 'number') return input;
  const cleaned = String(input).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Gera as datas das parcelas a partir de uma data inicial.
 * --------------------------------------------------------------
 * Mantém o MESMO DIA do mês em cada parcela. Se o mês alvo não tiver esse dia
 * (ex: dia 31 em fevereiro), usa o último dia do mês.
 *
 * Ex: '2026-04-15' + 4 parcelas →
 *   ['2026-04-15', '2026-05-15', '2026-06-15', '2026-07-15']
 *
 * Ex: '2026-01-31' + 3 parcelas →
 *   ['2026-01-31', '2026-02-28', '2026-03-31']
 */
export function generateInstallmentDates(startDateStr, count) {
  const startDate = new Date(startDateStr + 'T00:00:00');
  const targetDay = startDate.getDate();
  const dates = [];

  for (let i = 0; i < count; i++) {
    const targetMonth = startDate.getMonth() + i;
    const targetYear = startDate.getFullYear();
    const candidate = new Date(targetYear, targetMonth, 1); // dia 1 do mês alvo
    // Último dia do mês alvo
    const lastDayOfMonth = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    const day = Math.min(targetDay, lastDayOfMonth);
    candidate.setDate(day);

    // Format YYYY-MM-DD (timezone-safe)
    const y = candidate.getFullYear();
    const m = String(candidate.getMonth() + 1).padStart(2, '0');
    const d = String(candidate.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }

  return dates;
}

/**
 * Divide um valor em N parcelas, ajustando centavos pra somar exato.
 * Ex: 100,00 em 3 → [33.34, 33.33, 33.33] (a primeira pega o centavo extra)
 */
export function splitInstallmentAmount(total, count) {
  const cents = Math.round(total * 100);
  const baseCents = Math.floor(cents / count);
  const remainder = cents - baseCents * count;

  return Array.from({ length: count }, (_, i) => {
    const adj = i < remainder ? 1 : 0;
    return (baseCents + adj) / 100;
  });
}
