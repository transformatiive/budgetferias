'use strict';

// ---------------------------------------------------------------------------
// Configuração da viagem. Editar aqui (e so aqui) quando houver alteracoes.
// ---------------------------------------------------------------------------

const TRIP_START = '2026-07-27'; // dia 1
const TOTAL_DAYS = 18;

// pacing (so para categorias 'variable'):
//   'daily'     -> (planned / TOTAL_DAYS) * dias decorridos
//   'scheduled' -> soma das atividades da lista cuja data ja passou
//
// group:
//   'variable' -> gasto do dia-a-dia; entra no ritmo (esperado ate hoje) e no
//                 grafico de acumulado
//   'prepaid'  -> pago em blocos antecipados, muitas vezes antes da viagem
//                 comecar. Nao tem ritmo diario: mostra-se pago vs total.
//
// `planned` e `note` sao apenas valores por omissao: podem ser alterados em
// runtime via PUT /api/budget/:category, e essa alteracao (guardada na base de
// dados) prevalece sobre o que esta aqui.
const CATEGORIES = [
  {
    category: 'refeicoes',
    label: 'Refeições',
    planned: 1980,
    group: 'variable',
    pacingLabel: 'média diária do orçamento',
  },
  {
    category: 'alojamento',
    label: 'Alojamento',
    planned: 8354,
    group: 'prepaid',
    pacingLabel: 'pago em blocos antecipados',
    note: 'Reservas confirmadas: Douro, Vitoria, Nîmes, Lugano, Zermatt, St. Moritz, Lyon. Falta Zaragoza e Chamonix.',
  },
  {
    category: 'atividades',
    label: 'Atividades / Teleféricos',
    planned: 1920,
    group: 'variable',
    pacing: 'scheduled',
    schedule: 'activities', // ver PLANNED_ACTIVITIES
    pacingLabel: 'atividades com data já passada',
  },
  {
    category: 'transporte',
    label: 'Tesla + Portagens',
    planned: 555,
    group: 'variable',
    pacingLabel: 'média diária do orçamento',
  },
  {
    category: 'outros',
    label: 'Outros',
    planned: 0,
    group: 'variable',
    pacingLabel: 'sem orçamento previsto',
  },
];

// Atividades previstas, com a data em que acontecem. Servem para calcular o
// "previsto ate hoje" da categoria atividades: em vez de uma media diaria,
// conta-se o que ja estava marcado ate a data de hoje.
// (Gandria e Bellinzona sairam do plano.)
const PLANNED_ACTIVITIES = [
  { name: 'Monte Generoso', date: '2026-08-03', amount: 109 },
  { name: 'Monte San Salvatore + Morcote', date: '2026-08-04', amount: 109 },
  { name: 'Täsch — parque 4 dias', date: '2026-08-08', amount: 88 },
  { name: 'Zermatt — Schwarzsee', date: '2026-08-09', amount: 109 },
  { name: 'Zermatt — 5 Lakes / Sunnegga', date: '2026-08-09', amount: 55 },
  { name: 'Zermatt — Gornergrat', date: '2026-08-10', amount: 235 },
  { name: 'Bernina Express', date: '2026-08-12', amount: 269 },
];

const SCHEDULES = { activities: PLANNED_ACTIVITIES };

// Reservas de alojamento confirmadas, como referencia do que compoe o
// orcamento de alojamento. Adicionar aqui as que faltam (Zaragoza, Chamonix)
// assim que estiverem confirmadas, e atualizar `planned` em conformidade.
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

module.exports = {
  TRIP_START,
  TOTAL_DAYS,
  CATEGORIES,
  CATEGORY_KEYS,
  BOOKINGS,
  PLANNED_ACTIVITIES,
  SCHEDULES,
  SEED_EXPENSES,
};
