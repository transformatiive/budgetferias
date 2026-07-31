'use strict';

const euro = (n) =>
  '€' + Number(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro0 = (n) => '€' + Math.round(Number(n)).toLocaleString('pt-PT');
const signed = (n) => (n >= 0 ? '+' : '−') + euro(Math.abs(n));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SVG_NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgRoot = (w, h) => {
  const s = el('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' });
  return s;
};

let state = { summary: null, expenses: [], categories: [] };

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
  renderHeader();
  renderBarChart();
  renderLineChart();
  renderCategoryCards();
  renderExpenses();
  fillCategorySelect();
}

// ---------------------------------------------------------------- header

function renderHeader() {
  const { totals, tripDay, totalDays } = state.summary;
  document.getElementById('tripDay').textContent =
    tripDay === 0 ? 'antes da partida' : `dia ${tripDay} de ${totalDays}`;
  document.getElementById('totalSpent').textContent = euro(totals.spent);
  document.getElementById('totalExpected').textContent = euro(totals.expectedSoFar);

  const pct = totals.planned > 0 ? Math.min(100, (totals.spent / totals.planned) * 100) : 0;
  document.getElementById('headerBar').style.width = pct + '%';

  const diff = document.getElementById('totalDiff');
  diff.textContent = `${signed(totals.diffSoFar)} ${totals.diffSoFar >= 0 ? 'acima' : 'abaixo'}`;
  diff.className = 'pill mono ' + (totals.diffSoFar >= 0 ? 'pill--over' : 'pill--under');

  document.getElementById('totalPlanned').textContent = `orçamento ${euro0(totals.planned)}`;
}

// ---------------------------------------------------------------- gráficos

function renderBarChart() {
  const cats = state.categories;
  const W = 340;
  const rowH = 46;
  const H = cats.length * rowH + 8;
  const labelW = 96;
  const chartW = W - labelW - 42;
  const max = Math.max(1, ...cats.flatMap((c) => [c.spent, c.expectedSoFar]));

  const svg = svgRoot(W, H);
  cats.forEach((c, i) => {
    const y = i * rowH + 6;
    svg.appendChild(
      el(
        'text',
        { x: 0, y: y + 14, 'font-size': '9', fill: '#6b6f66', 'font-family': 'IBM Plex Mono, monospace' },
        c.label.length > 15 ? c.label.slice(0, 14) + '…' : c.label
      )
    );
    const bars = [
      { v: c.spent, color: '#b4552d', dy: 0 },
      { v: c.expectedSoFar, color: '#7d8b74', dy: 15 },
    ];
    for (const b of bars) {
      const w = Math.max(b.v > 0 ? 2 : 0, (b.v / max) * chartW);
      svg.appendChild(
        el('rect', { x: labelW, y: y + 20 + b.dy - 12, width: w, height: 11, rx: 2, fill: b.color })
      );
      svg.appendChild(
        el(
          'text',
          {
            x: labelW + w + 5,
            y: y + 20 + b.dy - 3,
            'font-size': '9',
            fill: '#6b6f66',
            'font-family': 'IBM Plex Mono, monospace',
          },
          euro0(b.v)
        )
      );
    }
  });

  const box = document.getElementById('barChart');
  box.replaceChildren(svg);
}

function renderLineChart() {
  const series = state.summary.cumulative;
  const W = 340;
  const H = 170;
  const pad = { top: 12, right: 10, bottom: 22, left: 40 };
  const svg = svgRoot(W, H);
  const box = document.getElementById('lineChart');

  if (series.length === 0) {
    svg.appendChild(
      el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', 'font-size': '11', fill: '#6b6f66' }, 'sem dados')
    );
    box.replaceChildren(svg);
    return;
  }

  const totalDays = state.summary.totalDays;
  const max = Math.max(1, ...series.map((p) => p.total));
  const x = (d) => pad.left + (d / totalDays) * (W - pad.left - pad.right);
  const y = (v) => H - pad.bottom - (v / max) * (H - pad.top - pad.bottom);

  // grelha + eixo Y
  for (let i = 0; i <= 2; i++) {
    const v = (max / 2) * i;
    svg.appendChild(
      el('line', { x1: pad.left, y1: y(v), x2: W - pad.right, y2: y(v), stroke: '#ded8cb', 'stroke-width': 1 })
    );
    svg.appendChild(
      el(
        'text',
        {
          x: pad.left - 5,
          y: y(v) + 3,
          'text-anchor': 'end',
          'font-size': '8',
          fill: '#6b6f66',
          'font-family': 'IBM Plex Mono, monospace',
        },
        euro0(v)
      )
    );
  }

  const pts = series.map((p) => `${x(p.day)},${y(p.total)}`).join(' ');
  const last = series[series.length - 1];
  svg.appendChild(
    el('polygon', {
      points: `${x(series[0].day)},${y(0)} ${pts} ${x(last.day)},${y(0)}`,
      fill: '#b4552d',
      'fill-opacity': '0.12',
    })
  );
  svg.appendChild(
    el('polyline', { points: pts, fill: 'none', stroke: '#b4552d', 'stroke-width': 2, 'stroke-linejoin': 'round' })
  );
  svg.appendChild(el('circle', { cx: x(last.day), cy: y(last.total), r: 3.5, fill: '#b4552d' }));

  // eixo X (dias da viagem)
  for (let d = 1; d <= totalDays; d += 3) {
    svg.appendChild(
      el(
        'text',
        {
          x: x(d),
          y: H - 6,
          'text-anchor': 'middle',
          'font-size': '8',
          fill: '#6b6f66',
          'font-family': 'IBM Plex Mono, monospace',
        },
        'd' + d
      )
    );
  }

  box.replaceChildren(svg);
}

// ---------------------------------------------------------------- cartões

function renderCategoryCards() {
  const wrap = document.getElementById('categoryCards');
  wrap.innerHTML = state.categories
    .map((c) => {
      const pct = c.planned > 0 ? Math.min(100, (c.spent / c.planned) * 100) : c.spent > 0 ? 100 : 0;
      const markerPct = c.planned > 0 ? Math.min(100, (c.expectedSoFar / c.planned) * 100) : 0;
      const over = c.diffSoFar >= 0;
      return `
      <article class="card">
        <div class="cat__head">
          <div>
            <h3 class="cat__name">${esc(c.label)}</h3>
            <p class="cat__note">${esc(c.pacingLabel)}</p>
          </div>
          <span class="cat__diff ${over ? 'cat__diff--over' : 'cat__diff--under'}">${signed(c.diffSoFar)}</span>
        </div>
        <div class="cat__bar">
          <div class="bar"><div class="bar__fill" style="width:${pct}%"></div></div>
          ${c.planned > 0 ? `<div class="cat__marker" style="left:${markerPct}%"></div>` : ''}
        </div>
        <div class="cat__figures mono">
          <span>gasto <strong>${euro0(c.spent)}</strong></span>
          <span>esperado <strong>${euro0(c.expectedSoFar)}</strong></span>
          <span>total <strong>${euro0(c.planned)}</strong></span>
        </div>
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
    .map(
      (e) => `
      <li class="expense">
        <div class="expense__main">
          <div class="expense__desc">${esc(e.description)}</div>
          <div class="expense__meta mono">${esc(e.expense_date)} · ${esc(labels[e.category] || e.category)}${
            e.note ? ' · ' + esc(e.note) : ''
          }</div>
        </div>
        <span class="expense__amount">${euro(e.amount)}</span>
        <button class="expense__del" type="button" data-id="${e.id}" aria-label="Apagar">&times;</button>
      </li>`
    )
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

// ---------------------------------------------------------------- formulário

const sheet = document.getElementById('sheet');
const form = document.getElementById('expenseForm');
const formError = document.getElementById('formError');

function fillCategorySelect() {
  const select = document.getElementById('categorySelect');
  if (select.options.length) return;
  select.innerHTML = state.categories
    .map((c) => `<option value="${esc(c.category)}">${esc(c.label)}</option>`)
    .join('');
}

function openSheet() {
  formError.hidden = true;
  form.reset();
  form.elements.expense_date.value = state.summary ? state.summary.today : new Date().toISOString().slice(0, 10);
  sheet.hidden = false;
  form.elements.description.focus();
}

function closeSheet() {
  sheet.hidden = true;
}

document.getElementById('openForm').addEventListener('click', openSheet);
sheet.addEventListener('click', (ev) => {
  if (ev.target.hasAttribute('data-close')) closeSheet();
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !sheet.hidden) closeSheet();
});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const submit = form.querySelector('.submit');
  submit.disabled = true;
  formError.hidden = true;
  try {
    await api('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: data.description,
        category: data.category,
        amount: Number(data.amount),
        expense_date: data.expense_date,
        note: data.note || undefined,
      }),
    });
    closeSheet();
    await load();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

load().catch((err) => {
  document.getElementById('tripDay').textContent = 'erro';
  console.error(err);
});
