// ============================================
// CollegeTrue — Render Engine (Harbor Haze)
// ============================================

// Harbor Haze color constants for JS-rendered elements
const HH = {
  green:     '#2e7d6e',
  greenDim:  'rgba(46,125,110,0.13)',
  greenBdr:  'rgba(46,125,110,0.42)',
  amber:     '#b7862a',
  amberDim:  'rgba(183,134,42,0.13)',
  amberBdr:  'rgba(183,134,42,0.42)',
  red:       '#c05a48',
  redDim:    'rgba(192,90,72,0.11)',
  redBdr:    'rgba(192,90,72,0.38)',
  ink3:      '#8fa5b4',
};

function renderScoreCards(results) {
  const container = document.getElementById('score-cards');
  container.innerHTML = '';

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const winnerName = sorted[0].school.name;
  const worstName  = sorted[sorted.length - 1].school.name;

  results.forEach((r, i) => {
    const isWinner  = r.school.name === winnerName && results.length > 1;
    const isWorst   = r.school.name === worstName  && results.length > 1 && winnerName !== worstName;
    const cardClass = isWinner ? 'winner' : isWorst ? 'worst' : 'neutral';
    const verdictText = isWinner ? 'best financial fit' : isWorst ? 'highest risk' : 'middle ground';
    const scoreColor = getScoreColor(r.score);
    const barHex = scoreColor === 'green' ? HH.green : scoreColor === 'amber' ? HH.amber : HH.red;

    const card = document.createElement('div');
    card.className = `score-card ${cardClass} fade-in-up`;
    card.style.animationDelay = `${i * 0.1}s`;

    card.innerHTML = `
      <div class="score-card-verdict">${verdictText}</div>
      <div class="score-card-school">
        <div class="score-card-name">${r.school.name}</div>
        <div class="score-card-type">${r.school.type} · ${r.school.city || r.school.state}${r.school.source ? ` · ${r.school.source}` : ''}</div>
      </div>
      <div class="score-display">
        <div class="score-number ${scoreColor}">${r.score}</div>
        <div class="score-suffix">/ 100<br/>financial<br/>health</div>
      </div>
      <div class="score-bar-wrap">
        <div class="score-bar-fill" style="width: 0%; background: ${barHex};" data-target="${r.score}%"></div>
      </div>
      <div class="score-stats">
        <div class="score-stat">
          <span class="score-stat-k">tuition (net)</span>
          <span class="score-stat-v">${formatDollars(r.netTuition)}/yr</span>
        </div>
        <div class="score-stat">
          <span class="score-stat-k">total est. debt</span>
          <span class="score-stat-v">${formatDollars(r.totalDebt)}</span>
        </div>
        <div class="score-stat">
          <span class="score-stat-k">monthly payment</span>
          <span class="score-stat-v">${formatDollars(r.monthlyPayment)}/mo</span>
        </div>
        <div class="score-stat">
          <span class="score-stat-k">% of paycheck</span>
          <span class="score-stat-v" style="color: ${getBarColor(r.paymentPct)}">${r.paymentPct}%</span>
        </div>
        <div class="score-stat">
          <span class="score-stat-k">total interest (10yr)</span>
          <span class="score-stat-v" style="color: var(--ink2)">${formatDollars(r.totalInterest)}</span>
        </div>
        ${r.school.estimated ? `<div class="estimated-note">tuition estimated</div>` : ''}
      </div>
    `;

    container.appendChild(card);
  });

  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.score-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.target;
      });
    }, 120);
  });
}

function renderBurdenBars(results) {
  const container = document.getElementById('burden-bars');
  container.innerHTML = '';

  const maxPayment = Math.max(...results.map(r => r.monthlyPayment));
  const maxPct     = Math.max(...results.map(r => r.paymentPct));

  results.forEach(r => {
    const barPct    = maxPayment > 0 ? Math.round((r.monthlyPayment / maxPayment) * 100) : 0;
    const barColor  = getBarColor(r.paymentPct);
    const thresh15  = Math.max(8, Math.min(92, maxPct > 0 ? Math.round((15 / maxPct) * 100) : 50));
    const thresh25  = Math.max(8, Math.min(92, maxPct > 0 ? Math.round((25 / maxPct) * 100) : 80));

    const row = document.createElement('div');
    row.className = 'burden-row';
    row.innerHTML = `
      <div class="burden-row-header">
        <span class="burden-school-name">${r.school.name}</span>
        <span class="burden-pct" style="color: ${barColor}">${r.paymentPct}% of paycheck</span>
      </div>
      <div class="burden-sub">${formatDollars(r.monthlyPayment)}/month × 120 payments = ${formatDollars(r.totalPaid)} total repaid.</div>
      <div class="burden-scale">
        <span class="burden-scale-label" style="left: ${thresh15}%">15% watch zone</span>
        <span class="burden-scale-label danger" style="left: ${thresh25}%">25% danger zone</span>
      </div>
      <div class="burden-track">
        <div class="burden-fill" style="width: 0%; background: ${barColor};" data-target="${barPct}%"></div>
        <div class="burden-threshold" style="left: ${thresh15}%"></div>
        <div class="burden-threshold danger" style="left: ${thresh25}%"></div>
      </div>
    `;
    container.appendChild(row);
  });

  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.burden-fill').forEach(bar => {
        bar.style.width = bar.dataset.target;
      });
    }, 220);
  });
}

function renderSnapshot(results) {
  const container = document.getElementById('snapshot-section');
  container.innerHTML = '';

  const sorted = [...results].sort((a, b) => b.breathingRoom - a.breathingRoom);
  const best   = sorted[0];
  const worst  = sorted[sorted.length - 1];
  const roomGap = best.breathingRoom - worst.breathingRoom;

  const lead = document.createElement('div');
  lead.className = 'snapshot-lead';
  lead.innerHTML = `
    <div>
      <span class="snapshot-k">best monthly breathing room</span>
      <strong>${best.school.name}</strong>
    </div>
    <div class="snapshot-gap">
      <span>gap vs. riskiest choice</span>
      <strong>${formatDollars(roomGap)}/mo</strong>
    </div>
  `;
  container.appendChild(lead);

  const grid = document.createElement('div');
  grid.className = 'snapshot-grid';

  results.forEach(r => {
    const mood  = r.breathingRoom < 0 ? 'red' : r.breathingRoom < 500 ? 'amber' : 'green';
    const width = Math.max(4, Math.min(100, r.freedomPct));
    const card  = document.createElement('div');
    card.className = `snapshot-card ${mood}`;
    card.innerHTML = `
      <div class="snapshot-card-head">
        <span>${r.school.name}</span>
        <strong>${r.breathingRoom < 0 ? '-' : ''}${formatDollars(Math.abs(r.breathingRoom))}/mo</strong>
      </div>
      <div class="snapshot-track">
        <div class="snapshot-fill" style="width:${width}%"></div>
      </div>
      <div class="snapshot-breakdown mono">
        <span>${formatDollars(r.monthlyTakehome)} take-home</span>
        <span>- ${formatDollars(r.essentials)} basics (rent, food, transport)</span>
        <span>- ${formatDollars(r.monthlyPayment)} loan payment</span>
      </div>
      <p>${r.breathingRoom < 0
        ? 'Budget underwater before savings or emergencies.'
        : r.breathingRoom < 500
        ? 'You can make it work — but small emergencies hurt.'
        : 'Real flexibility. You can save, invest, and breathe.'}</p>
    `;
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function renderTimeline(results) {
  const container = document.getElementById('timeline-section');
  container.innerHTML = '';

  const YEARS = [
    { key: 0, label: 'Age 22' },
    { key: 1, label: 'Age 23' },
    { key: 2, label: 'Age 24' },
    { key: 3, label: 'Age 25' },
    { key: 4, label: 'Age 26' },
    { key: 5, label: 'Age 27' },
    { key: 6, label: 'Age 28' },
    { key: 7, label: 'Age 30' },
    { key: 8, label: 'Age 32' },
  ];

  const numCols    = YEARS.length;
  const colTemplate = `100px repeat(${numCols}, 1fr)`;
  const grid       = document.createElement('div');
  grid.className   = 'timeline-grid';

  const headerRow  = document.createElement('div');
  headerRow.className = 'timeline-header-row';
  headerRow.style.cssText = `grid-template-columns: ${colTemplate}; display: grid; gap: 3px;`;
  headerRow.innerHTML = `<div></div>` + YEARS.map(y => `<div class="timeline-header-cell">${y.label}</div>`).join('');
  grid.appendChild(headerRow);

  results.forEach(r => {
    const row = document.createElement('div');
    row.className = 'timeline-school-row';
    row.style.cssText = `grid-template-columns: ${colTemplate}; display: grid; gap: 3px; margin-bottom: 5px;`;

    const labelCell = document.createElement('div');
    labelCell.className = 'timeline-school-label';
    labelCell.textContent = r.school.name;
    row.appendChild(labelCell);

    r.timeline.forEach(point => {
      const cell = document.createElement('div');
      cell.className = 'timeline-cell';
      const bg = point.color === 'green' ? HH.greenDim
               : point.color === 'amber' ? HH.amberDim
               : HH.redDim;
      const tc = point.color === 'green' ? HH.green
               : point.color === 'amber' ? HH.amber
               : HH.red;
      cell.style.background = bg;
      cell.style.color = tc;
      cell.title = point.note || '';
      cell.textContent = point.label;
      row.appendChild(cell);
    });

    grid.appendChild(row);
  });

  container.appendChild(grid);

  const legend = document.createElement('div');
  legend.className = 'timeline-legend';
  legend.innerHTML = `
    <div class="timeline-legend-item"><div class="timeline-legend-dot" style="background:${HH.greenDim}; border:1px solid ${HH.green};"></div>Healthy finances</div>
    <div class="timeline-legend-item"><div class="timeline-legend-dot" style="background:${HH.amberDim}; border:1px solid ${HH.amber};"></div>Some pressure</div>
    <div class="timeline-legend-item"><div class="timeline-legend-dot" style="background:${HH.redDim}; border:1px solid ${HH.red};"></div>Financial strain</div>
    <div class="timeline-legend-item" style="margin-left:auto; font-size:0.52rem; font-style:italic;">Hover cells for detail</div>
  `;
  container.appendChild(legend);
}

function renderVerdict(results) {
  const container = document.getElementById('verdict-section');
  const { headline, body } = buildVerdict(results);
  container.innerHTML = `
    <span class="verdict-tag">— the honest verdict</span>
    <h3 class="verdict-headline">${headline}</h3>
    <div class="verdict-body">${body}</div>
  `;
}

function renderResultsTitle(results) {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  document.getElementById('results-title').textContent =
    best.paymentPct <= 12  ? `${best.school.name} wins — by a lot.`
    : best.paymentPct <= 22 ? 'The Numbers Are In.'
    : 'You Need to See This.';
}
