'use strict';

const { TRIP_START, TOTAL_DAYS, CATEGORIES } = require('./config');

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

/**
 * Junta as categorias do config com os valores guardados via PUT /api/budget/:category.
 * O que esta na base de dados prevalece; o config e apenas o valor por omissao.
 */
function effectiveBudgets(overrides = []) {
  const byCategory = new Map(overrides.map((o) => [o.category, o]));
  return CATEGORIES.map((c) => {
    const o = byCategory.get(c.category);
    const plannedOverridden = o != null && o.planned != null;
    const noteOverridden = o != null && o.note != null;
    return {
      category: c.category,
      label: c.label,
      group: c.group,
      pacingLabel: c.pacingLabel,
      planned: plannedOverridden ? Number(o.planned) : c.planned,
      note: noteOverridden ? o.note : c.note ?? null,
      defaults: { planned: c.planned, note: c.note ?? null },
      overridden: plannedOverridden || noteOverridden,
      updatedAt: o ? o.updated_at : null,
    };
  });
}

/**
 * Categorias 'prepaid' (alojamento) ficam de fora do ritmo diario: sao pagas em
 * blocos, muitas vezes antes da viagem comecar, e misturadas com o gasto do
 * dia-a-dia distorcem a leitura de "quanto ja gastei vs quanto devia ter gasto".
 */
function buildSummary(expenses, today = todayISO(), overrides = []) {
  const day = tripDay(today);
  const budgets = effectiveBudgets(overrides);
  const groupOf = new Map(budgets.map((c) => [c.category, c.group]));

  const spentByCategory = new Map();
  for (const e of expenses) {
    spentByCategory.set(e.category, (spentByCategory.get(e.category) || 0) + Number(e.amount));
  }

  const categories = budgets.map((c) => {
    const spent = round2(spentByCategory.get(c.category) || 0);
    if (c.group === 'prepaid') {
      return {
        category: c.category,
        label: c.label,
        group: c.group,
        planned: c.planned,
        pacingLabel: c.pacingLabel,
        note: c.note,
        spent,
        remaining: round2(c.planned - spent),
        expectedSoFar: null,
        diffSoFar: null,
      };
    }
    const expectedSoFar = round2((c.planned / TOTAL_DAYS) * day);
    return {
      category: c.category,
      label: c.label,
      group: c.group,
      planned: c.planned,
      pacingLabel: c.pacingLabel,
      note: c.note,
      spent,
      expectedSoFar,
      diffSoFar: round2(spent - expectedSoFar),
    };
  });

  // Despesas em categorias desconhecidas contam como gasto variavel, para nao
  // desaparecerem dos totais.
  const known = new Set(budgets.map((c) => c.category));
  const orphan = round2(
    [...spentByCategory].filter(([k]) => !known.has(k)).reduce((s, [, v]) => s + v, 0)
  );

  const variableCats = categories.filter((c) => c.group !== 'prepaid');
  const prepaidCats = categories.filter((c) => c.group === 'prepaid');

  const variable = {
    planned: round2(variableCats.reduce((s, c) => s + c.planned, 0)),
    spent: round2(variableCats.reduce((s, c) => s + c.spent, 0) + orphan),
    expectedSoFar: round2(variableCats.reduce((s, c) => s + c.expectedSoFar, 0)),
  };
  variable.diffSoFar = round2(variable.spent - variable.expectedSoFar);
  variable.remaining = round2(variable.planned - variable.spent);

  const prepaid = {
    planned: round2(prepaidCats.reduce((s, c) => s + c.planned, 0)),
    spent: round2(prepaidCats.reduce((s, c) => s + c.spent, 0)),
  };
  prepaid.remaining = round2(prepaid.planned - prepaid.spent);

  const totals = {
    planned: round2(variable.planned + prepaid.planned),
    spent: round2(variable.spent + prepaid.spent),
  };
  totals.remaining = round2(totals.planned - totals.spent);

  return {
    tripStart: TRIP_START,
    totalDays: TOTAL_DAYS,
    today,
    tripDay: day,
    categories,
    variable,
    prepaid,
    totals,
    cumulative: cumulativeSeries(expenses, today, groupOf),
  };
}

/**
 * Gasto variavel acumulado por dia da viagem. Exclui o pre-pago para a linha
 * nao dar saltos verticais quando se paga uma reserva.
 */
function cumulativeSeries(expenses, today = todayISO(), groupOf = new Map()) {
  const byDay = new Array(TOTAL_DAYS + 1).fill(0);
  for (const e of expenses) {
    if (groupOf.get(e.category) === 'prepaid') continue;
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

module.exports = { buildSummary, effectiveBudgets, tripDay, todayISO, daysBetween };
