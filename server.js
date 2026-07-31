'use strict';

const path = require('path');
const express = require('express');
const db = require('./src/db');
const { CATEGORY_KEYS, BOOKINGS, TRIP_START, TOTAL_DAYS } = require('./src/config');
const { buildSummary, effectiveBudgets, todayISO } = require('./src/summary');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateExpense(body) {
  const errors = [];
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!description) errors.push('description é obrigatória');

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  if (!CATEGORY_KEYS.includes(category)) {
    errors.push(`category tem de ser uma de: ${CATEGORY_KEYS.join(', ')}`);
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('amount tem de ser um numero > 0');

  const expense_date = typeof body.expense_date === 'string' ? body.expense_date.trim() : '';
  if (!DATE_RE.test(expense_date) || Number.isNaN(Date.parse(`${expense_date}T00:00:00Z`))) {
    errors.push('expense_date tem de estar no formato YYYY-MM-DD');
  }

  const note =
    body.note === undefined || body.note === null || String(body.note).trim() === ''
      ? null
      : String(body.note).trim();

  return {
    errors,
    value: { description, category, amount: Math.round(amount * 100) / 100, expense_date, note },
  };
}

app.get('/api/config', async (_req, res, next) => {
  try {
    res.json({
      tripStart: TRIP_START,
      totalDays: TOTAL_DAYS,
      categories: effectiveBudgets(await db.budgetOverrides()),
      bookings: BOOKINGS,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/expenses', async (_req, res, next) => {
  try {
    res.json(await db.listExpenses());
  } catch (err) {
    next(err);
  }
});

app.post('/api/expenses', async (req, res, next) => {
  try {
    const { errors, value } = validateExpense(req.body || {});
    if (errors.length) return res.status(400).json({ error: 'Dados inválidos', details: errors });
    res.status(201).json(await db.createExpense(value));
  } catch (err) {
    next(err);
  }
});

app.delete('/api/expenses/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
    const ok = await db.deleteExpense(id);
    if (!ok) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json({ deleted: id });
  } catch (err) {
    next(err);
  }
});

app.get('/api/summary', async (_req, res, next) => {
  try {
    const [expenses, overrides] = await Promise.all([db.listExpenses(), db.budgetOverrides()]);
    res.json(buildSummary(expenses, todayISO(), overrides));
  } catch (err) {
    next(err);
  }
});

app.get('/api/budget', async (_req, res, next) => {
  try {
    const categories = effectiveBudgets(await db.budgetOverrides());
    res.json({
      categories,
      totalPlanned: Math.round(categories.reduce((s, c) => s + c.planned, 0) * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
});

app.put('/api/budget/:category', async (req, res, next) => {
  try {
    const category = req.params.category;
    if (!CATEGORY_KEYS.includes(category)) {
      return res.status(404).json({
        error: 'Categoria desconhecida',
        details: [`category tem de ser uma de: ${CATEGORY_KEYS.join(', ')}`],
      });
    }

    const body = req.body || {};
    const errors = [];
    const patch = {};

    if ('planned' in body && body.planned !== null) {
      const planned = Number(body.planned);
      if (!Number.isFinite(planned) || planned < 0) errors.push('planned tem de ser um numero >= 0');
      else patch.planned = Math.round(planned * 100) / 100;
    }

    if ('note' in body) {
      if (body.note === null || String(body.note).trim() === '') patch.note = null;
      else if (typeof body.note !== 'string') errors.push('note tem de ser texto');
      else patch.note = body.note.trim();
    }

    if (errors.length) return res.status(400).json({ error: 'Dados inválidos', details: errors });
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Dados inválidos', details: ['indica pelo menos planned ou note'] });
    }

    await db.saveBudgetOverride(category, patch);
    const updated = effectiveBudgets(await db.budgetOverrides()).find((c) => c.category === category);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, db: db.kind }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

const port = process.env.PORT || 3000;

db.init()
  .then(() => {
    app.listen(port, () => console.log(`[server] a ouvir na porta ${port} (${db.kind})`));
  })
  .catch((err) => {
    console.error('[server] falha a inicializar a base de dados', err);
    process.exit(1);
  });
