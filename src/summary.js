'use strict';

const { TRIP_START, TOTAL_DAYS, CATEGORIES, BOOKINGS } = require('./config');

const round2 = (n) => Math.round(n * 100) / 100;

/** Numero de dias (inteiro) entre duas datas YYYY-MM-DD. */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dia atual da viagem: 1 no TRIP_START, limitado a [0, TOTAL_DAYS].
 * 0 significa que a viagem ainda nao comecou.
 */
function tripDay(today = todayISO()) {
  const day = daysBetween(TRIP_START, today) + 1;
  return Math.max(0, Math.min(TOTAL_DAYS, day));
}

function bookedSoFar(today = todayISO()) {
  return BOOKINGS.filter((b) => b.paidBy <= today).reduce((s, b) => s + b.amount, 0);
}

function buildSummary(expenses, today = todayISO()) {
  const day = tripDay(today);
  const spentByCategory = new Map();
  for (const e of expenses) {
    spentByCategory.set(e.category, (spentByCategory.get(e.category) || 0) + Number(e.amount));
  }

  const categories = CATEGORIES.map((c) => {
    const spent = round2(spentByCategory.get(c.category) || 0);
    const expectedSoFar =
      c.pacing === 'booked' ? round2(bookedSoFar(today)) : round2((c.planned / TOTAL_DAYS) * day);
    return {
      category: c.category,
      label: c.label,
      planned: c.planned,
      pacing: c.pacing,
      pacingLabel: c.pacingLabel,
      spent,
      expectedSoFar,
      diffSoFar: round2(spent - expectedSoFar),
    };
  });

  // Despesas em categorias desconhecidas nao devem desaparecer do total.
  const known = new Set(CATEGORIES.map((c) => c.category));
  const orphan = round2(
    [...spentByCategory].filter(([k]) => !known.has(k)).reduce((s, [, v]) => s + v, 0)
  );

  const totals = {
    planned: round2(categories.reduce((s, c) => s + c.planned, 0)),
    spent: round2(categories.reduce((s, c) => s + c.spent, 0) + orphan),
    expectedSoFar: round2(categories.reduce((s, c) => s + c.expectedSoFar, 0)),
  };
  totals.diffSoFar = round2(totals.spent - totals.expectedSoFar);
  totals.remaining = round2(totals.planned - totals.spent);

  return {
    tripStart: TRIP_START,
    totalDays: TOTAL_DAYS,
    today,
    tripDay: day,
    categories,
    totals,
    cumulative: cumulativeSeries(expenses, today),
  };
}

/** Serie de gasto acumulado por dia da viagem (para o grafico de linha). */
function cumulativeSeries(expenses, today = todayISO()) {
  const byDay = new Array(TOTAL_DAYS + 1).fill(0);
  for (const e of expenses) {
    const idx = Math.max(0, Math.min(TOTAL_DAYS, daysBetween(TRIP_START, e.expense_date) + 1));
    byDay[idx] += Number(e.amount);
  }
  const day = tripDay(today);
  const out = [];
  let acc = 0;
  for (let d = 0; d <= TOTAL_DAYS; d++) {
    acc += byDay[d];
    if (d === 0 && byDay[0] === 0) continue; // ignora o ponto pre-viagem se vazio
    if (d > day) break; // ainda nao aconteceu
    out.push({ day: d, total: round2(acc) });
  }
  return out;
}

module.exports = { buildSummary, tripDay, bookedSoFar, todayISO, daysBetween };
