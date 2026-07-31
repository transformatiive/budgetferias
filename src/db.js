'use strict';

// Camada de dados minima. Usa Postgres quando DATABASE_URL esta definido
// (Railway) e SQLite local caso contrario, para poder correr sem servico externo.

const { SEED_EXPENSES } = require('./config');

const usePostgres = Boolean(process.env.DATABASE_URL);

// --- Postgres --------------------------------------------------------------

function postgresDriver() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });

  const SELECT = `SELECT id, description, category, amount::float8 AS amount,
                         to_char(expense_date, 'YYYY-MM-DD') AS expense_date,
                         note, created_at
                  FROM expenses`;

  return {
    kind: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id           SERIAL PRIMARY KEY,
          description  TEXT NOT NULL,
          category     TEXT NOT NULL,
          amount       NUMERIC(10,2) NOT NULL,
          expense_date DATE NOT NULL,
          note         TEXT,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    },
    async count() {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM expenses');
      return rows[0].n;
    },
    async list() {
      const { rows } = await pool.query(
        `${SELECT} ORDER BY expense_date DESC, id DESC`
      );
      return rows;
    },
    async insert(e) {
      const { rows } = await pool.query(
        `INSERT INTO expenses (description, category, amount, expense_date, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [e.description, e.category, e.amount, e.expense_date, e.note ?? null]
      );
      const { rows: created } = await pool.query(`${SELECT} WHERE id = $1`, [rows[0].id]);
      return created[0];
    },
    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}

// --- SQLite ----------------------------------------------------------------

function sqliteDriver() {
  const { DatabaseSync } = require('node:sqlite');
  const file = process.env.SQLITE_PATH || 'budgetferias.sqlite';
  const db = new DatabaseSync(file);

  const SELECT = `SELECT id, description, category, amount, expense_date, note, created_at
                  FROM expenses`;

  return {
    kind: 'sqlite',
    async init() {
      db.exec(`
        CREATE TABLE IF NOT EXISTS expenses (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          description  TEXT NOT NULL,
          category     TEXT NOT NULL,
          amount       REAL NOT NULL,
          expense_date TEXT NOT NULL,
          note         TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    },
    async count() {
      return db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
    },
    async list() {
      return db.prepare(`${SELECT} ORDER BY expense_date DESC, id DESC`).all();
    },
    async insert(e) {
      const info = db
        .prepare(
          `INSERT INTO expenses (description, category, amount, expense_date, note)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(e.description, e.category, e.amount, e.expense_date, e.note ?? null);
      return db.prepare(`${SELECT} WHERE id = ?`).get(Number(info.lastInsertRowid));
    },
    async remove(id) {
      return db.prepare('DELETE FROM expenses WHERE id = ?').run(id).changes > 0;
    },
  };
}

const driver = usePostgres ? postgresDriver() : sqliteDriver();

async function init() {
  await driver.init();
  if ((await driver.count()) === 0) {
    for (const e of SEED_EXPENSES) await driver.insert(e);
    console.log(`[db] ${driver.kind}: seed carregado (${SEED_EXPENSES.length} despesas)`);
  }
}

module.exports = {
  init,
  kind: driver.kind,
  listExpenses: () => driver.list(),
  createExpense: (e) => driver.insert(e),
  deleteExpense: (id) => driver.remove(id),
};
