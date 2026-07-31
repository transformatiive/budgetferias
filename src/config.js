'use strict';

// ---------------------------------------------------------------------------
// Configuração da viagem. Editar aqui (e so aqui) quando houver alteracoes.
// ---------------------------------------------------------------------------

const TRIP_START = '2026-07-27'; // dia 1
const TOTAL_DAYS = 18;

// pacing:
//   'daily'  -> (planned / TOTAL_DAYS) * dias decorridos
//   'booked' -> soma das reservas cujo paidBy ja passou
const CATEGORIES = [
  {
    category: 'refeicoes',
    label: 'Refeições',
    planned: 1980,
    pacing: 'daily',
    pacingLabel: 'média diária do orçamento',
  },
  {
    category: 'alojamento',
    label: 'Alojamento',
    planned: 1930,
    pacing: 'booked',
    pacingLabel: 'com base nas reservas já pagas',
  },
  {
    category: 'atividades',
    label: 'Atividades / Teleféricos',
    planned: 1920,
    pacing: 'daily',
    pacingLabel: 'média diária do orçamento',
  },
  {
    category: 'transporte',
    label: 'Tesla + Portagens',
    planned: 555,
    pacing: 'daily',
    pacingLabel: 'média diária do orçamento',
  },
  {
    category: 'outros',
    label: 'Outros',
    planned: 0,
    pacing: 'daily',
    pacingLabel: 'sem orçamento previsto',
  },
];

// Reservas de alojamento confirmadas. Adicionar aqui as que faltam
// (Zaragoza, Chamonix, ...) assim que estiverem confirmadas.
const BOOKINGS = [
  { name: 'Quinta Alto do Rio (Douro)', paidBy: '2026-07-27', amount: 1141.92 },
  { name: 'Kora Green City Aparthotel (Vitoria)', paidBy: '2026-07-30', amount: 187.0 },
  { name: 'Campanile PRIME (Nîmes)', paidBy: '2026-07-31', amount: 214.0 },
  { name: '76 The Lake House (Lugano/Melide)', paidBy: '2026-08-01', amount: 2056.81 },
  { name: 'Hotel Daniela (Zermatt)', paidBy: '2026-08-08', amount: 3016.69 },
  { name: 'Hotel Laudinella (St. Moritz)', paidBy: '2026-08-11', amount: 1559.0 },
  { name: 'Ibis Styles Croix Rousse (Lyon)', paidBy: '2026-08-14', amount: 178.56 },
];

// Despesas pré-carregadas no primeiro arranque (base de dados vazia).
const SEED_EXPENSES = [
  { description: 'Quinta Alto Rio', category: 'refeicoes', amount: 365.75, expense_date: '2026-07-30', note: null },
  { description: 'Bar Cais', category: 'refeicoes', amount: 82.2, expense_date: '2026-07-28', note: null },
  { description: 'Bar do Rio, Cinfães', category: 'refeicoes', amount: 66.7, expense_date: '2026-07-29', note: 'almoço' },
  { description: 'Burger King', category: 'refeicoes', amount: 32.65, expense_date: '2026-07-30', note: null },
  { description: 'Jantar', category: 'refeicoes', amount: 86.1, expense_date: '2026-07-30', note: null },
  { description: 'Lanche', category: 'refeicoes', amount: 7.0, expense_date: '2026-07-30', note: null },
  { description: 'Alojamento cão', category: 'outros', amount: 25.0, expense_date: '2026-07-30', note: 'alojamento' },
  { description: 'Estacionamento, Vitoria', category: 'transporte', amount: 12.75, expense_date: '2026-07-31', note: null },
];

const CATEGORY_KEYS = CATEGORIES.map((c) => c.category);

module.exports = { TRIP_START, TOTAL_DAYS, CATEGORIES, CATEGORY_KEYS, BOOKINGS, SEED_EXPENSES };
