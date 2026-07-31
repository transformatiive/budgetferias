'use strict';

const euro = (n) =>
  '€' + Number(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro0 = (n) => '€' + Math.round(Number(n)).toLocaleString('pt-PT');
const signed = (n) => (n >= 0 ? '+' : '−') + euro(Math.abs(n));
const signed0 = (n) => (n >= 0 ? '+' : '−') + euro0(Math.abs(n));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgRoot = (w, h) =>
  el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' });
const mono = (extra = {}) => ({
  'font-family': 'IBM Plex Mono, monospace',
  'font-size': '9',
  'letter-spacing': '0.06em',
  fill: '#8b8f84',
  ...extra,
});

const COLORS = { spent: '#b4552d', expected: '#78896f', track: '#ece6d8', ink: '#1a1c18' };

const state = { summary: null, expenses: [], categories: [], variableCats: [], prepaidCats: [] };

async function api(path, options) {
  const res = await fetch(path, options);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && (body.details ? body.details.join('; ') : body.error);
    throw new Error(msg || `Erro ${res.status}`);
  }
  return body;
}

async function load() {
  const [summary, expenses] = await Promise.all([api('/api/summary'), api('/api/expenses')]);
  state.summary = summary;
  state.expenses = expenses;
  state.categories = summary.categories;
  state.variableCats = summary.categories.filter((c) => c.group !== 'prepaid');
  state.prepaidCats = summary.categories.filter((c) => c.group === 'prepaid');
  renderHeader();
  renderBarChart();
  renderLineChart();
  renderCategoryCards();
  renderPrepaidCards();
  renderExpenses();
}

// ---------------------------------------------------------------- header

function renderHeader() {
  const { variable, prepaid, totals, tripDay, totalDays } = state.summary;

  document.getElementById('tripDay').textContent =
    tripDay === 0 ? 'antes da partida' : `dia ${tripDay}/${totalDays}`;

  // O numero grande e o gasto real ate agora: tudo, incluindo o alojamento
  // pre-pago. O ritmo diario fica como leitura secundaria, e so faz sentido
  // sobre o gasto variavel.
  document.getElementById('totalSpent').textContent = euro(totals.spent);
  document.getElementById('totalPlanned').textContent = `de ${euro0(totals.planned)} previstos`;
  document.getElementById('totalRemaining').textContent = euro(totals.remaining);

  const pct = totals.planned > 0 ? Math.min(100, (totals.spent / totals.planned) * 100) : 0;
  document.getElementById('headerBar').style.width = pct + '%';

  document.getElementById('prepaidLabel').textContent =
    `variável ${euro0(variable.spent)} · alojamento ${euro0(prepaid.spent)}`;
  document.getElementById('prepaidValue').textContent = `${Math.round(pct)}%`;

  const diff = document.getElementById('totalDiff');
  const over = variable.diffSoFar >= 0;
  diff.textContent = `${signed(variable.diffSoFar)} ${over ? 'acima' : 'abaixo'}`;
  diff.className = 'stat__value stat__value--sm ' + (over ? 'stat__value--over' : 'stat__value--under');
}

// ---------------------------------------------------------------- gráficos

function renderBarChart() {
  const cats = state.variableCats;
  const W = 340;
  const blockH = 56;
  const H = cats.length * blockH;
  const barW = 250;
  const max = Math.max(1, ...cats.flatMap((c) => [c.spent, c.expectedSoFar]));
  const svg = svgRoot(W, H);

  cats.forEach((c, i) => {
    const top = i * blockH;
    svg.appendChild(
      el('text', mono({ x: 0, y: top + 10, fill: '#5e6459', 'text-transform': 'uppercase' }), c.label)
    );

    [
      { v: c.spent, color: COLORS.spent, y: top + 20 },
      { v: c.expectedSoFar, color: COLORS.expected, y: top + 34 },
    ].forEach((b) => {
      svg.appendChild(
        el('rect', { x: 0, y: b.y, width: barW, height: 7, rx: 3.5, fill: COLORS.track })
      );
      const w = (b.v / max) * barW;
      if (w > 0) {
        svg.appendChild(
          el('rect', { x: 0, y: b.y, width: Math.max(3, w), height: 7, rx: 3.5, fill: b.color })
        );
      }
      svg.appendChild(
        el('text', mono({ x: W, y: b.y + 7, 'text-anchor': 'end', fill: b.color }), euro0(b.v))
      );
    });
  });

  document.getElementById('barChart').replaceChildren(svg);
}

function renderLineChart() {
  const series = state.summary.cumulative;
  const W = 340;
  const H = 168;
  const pad = { top: 14, right: 6, bottom: 24, left: 40 };
  const svg = svgRoot(W, H);
  const meta = document.getElementById('lineMeta');

  if (series.length === 0) {
    svg.appendChild(el('text', mono({ x: W / 2, y: H / 2, 'text-anchor': 'middle' }), 'sem dados'));
    document.getElementById('lineChart').replaceChildren(svg);
    meta.textContent = '—';
    return;
  }

  const totalDays = state.summary.totalDays;
  const max = Math.max(1, ...series.map((p) => p.total));
  const last = series[series.length - 1];
  const x = (d) => pad.left + (d / totalDays) * (W - pad.left - pad.right);
  const y = (v) => H - pad.bottom - (v / max) * (H - pad.top - pad.bottom);

  meta.textContent = `${euro0(last.total)} ao dia ${last.day}`;

  const grad = el('linearGradient', { id: 'areaFill', x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.appendChild(el('stop', { offset: '0%', 'stop-color': COLORS.spent, 'stop-opacity': '0.22' }));
  grad.appendChild(el('stop', { offset: '100%', 'stop-color': COLORS.spent, 'stop-opacity': '0' }));
  const defs = el('defs');
  defs.appendChild(grad);
  svg.appendChild(defs);

  for (let i = 0; i <= 2; i++) {
    const v = (max / 2) * i;
    svg.appendChild(
      el('line', {
        x1: pad.left,
        y1: y(v),
        x2: W - pad.right,
        y2: y(v),
        stroke: '#e8e1d3',
        'stroke-width': 1,
      })
    );
    svg.appendChild(el('text', mono({ x: pad.left - 8, y: y(v) + 3, 'text-anchor': 'end' }), euro0(v)));
  }

  const pts = series.map((p) => `${x(p.day)},${y(p.total)}`).join(' ');
  svg.appendChild(
    el('polygon', {
      points: `${x(series[0].day)},${y(0)} ${pts} ${x(last.day)},${y(0)}`,
      fill: 'url(#areaFill)',
    })
  );
  svg.appendChild(
    el('polyline', {
      points: pts,
      fill: 'none',
      stroke: COLORS.spent,
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    })
  );
  svg.appendChild(
    el('circle', { cx: x(last.day), cy: y(last.total), r: 4, fill: COLORS.spent, stroke: '#fffdf7', 'stroke-width': 2 })
  );

  for (let d = 1; d <= totalDays; d += 3) {
    svg.appendChild(el('text', mono({ x: x(d), y: H - 6, 'text-anchor': 'middle' }), String(d)));
  }

  document.getElementById('lineChart').replaceChildren(svg);
}

// ---------------------------------------------------------------- cartões

function renderCategoryCards() {
  const wrap = document.getElementById('categoryCards');
  wrap.innerHTML = state.variableCats
    .map((c) => {
      const pct = c.planned > 0 ? Math.min(100, (c.spent / c.planned) * 100) : c.spent > 0 ? 100 : 0;
      const markerPct = c.planned > 0 ? Math.min(100, (c.expectedSoFar / c.planned) * 100) : 0;
      const over = c.diffSoFar >= 0;
      return `
      <article class="card">
        <div class="cat__head">
          <div>
            <h3 class="cat__name">${esc(c.label)}</h3>
            <p class="cat__pacing">${esc(c.pacingLabel)}</p>
          </div>
          <span class="cat__diff ${over ? 'cat__diff--over' : 'cat__diff--under'}">${signed0(c.diffSoFar)}</span>
        </div>
        <div class="cat__bar">
          <div class="cat__fill" style="width:${pct}%"></div>
          ${c.planned > 0 ? `<div class="cat__marker" style="left:${markerPct}%"></div>` : ''}
        </div>
        <div class="cat__figures">
          <span>gasto <strong>${euro0(c.spent)}</strong></span>
          <span>esperado <strong>${euro0(c.expectedSoFar)}</strong></span>
          <span>total <strong>${euro0(c.planned)}</strong></span>
        </div>
        ${c.note ? `<p class="cat__note">${esc(c.note)}</p>` : ''}
      </article>`;
    })
    .join('');
}

function renderPrepaidCards() {
  const wrap = document.getElementById('prepaidCards');
  wrap.innerHTML = state.prepaidCats
    .map((c) => {
      const pct = c.planned > 0 ? Math.min(100, (c.spent / c.planned) * 100) : c.spent > 0 ? 100 : 0;
      return `
      <article class="card">
        <div class="cat__head">
          <div>
            <h3 class="cat__name">${esc(c.label)}</h3>
            <p class="cat__pacing">${esc(c.pacingLabel)}</p>
          </div>
          <span class="cat__diff cat__diff--neutral">${Math.round(pct)}% pago</span>
        </div>
        <div class="cat__bar">
          <div class="cat__fill cat__fill--prepaid" style="width:${pct}%"></div>
        </div>
        <div class="cat__figures">
          <span>pago <strong>${euro0(c.spent)}</strong></span>
          <span>falta <strong>${euro0(c.remaining)}</strong></span>
          <span>total <strong>${euro0(c.planned)}</strong></span>
        </div>
        ${c.note ? `<p class="cat__note">${esc(c.note)}</p>` : ''}
      </article>`;
    })
    .join('');
}

// ---------------------------------------------------------------- despesas

function renderExpenses() {
  const list = document.getElementById('expenseList');
  if (state.expenses.length === 0) {
    list.innerHTML = '<li class="empty">Ainda sem despesas registadas.</li>';
    return;
  }
  const labels = Object.fromEntries(state.categories.map((c) => [c.category, c.label]));
  list.innerHTML = state.expenses
    .map((e) => {
      const [, m, d] = e.expense_date.split('-');
      return `
      <li class="expense">
        <div class="expense__day">
          <b>${esc(d)}</b><span>${MONTHS[Number(m) - 1] || ''}</span>
        </div>
        <div class="expense__main">
          <div class="expense__desc">${esc(e.description)}</div>
          <div class="expense__meta">${esc(labels[e.category] || e.category)}${
            e.note ? ' · ' + esc(e.note) : ''
          }</div>
        </div>
        <span class="expense__amount">${euro(e.amount)}</span>
        <button class="expense__del" type="button" data-id="${e.id}" aria-label="Apagar">&times;</button>
      </li>`;
    })
    .join('');
}

document.getElementById('expenseList').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.expense__del');
  if (!btn) return;
  if (!confirm('Apagar esta despesa?')) return;
  btn.disabled = true;
  try {
    await api(`/api/expenses/${btn.dataset.id}`, { method: 'DELETE' });
    await load();
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
});

load().catch((err) => {
  document.getElementById('tripDay').textContent = 'erro';
  console.error(err);
});
