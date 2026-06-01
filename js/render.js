// ============================================
// CollegeTrue — Render Engine (Harbor Haze)
// ============================================

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

// ---- Logo helpers ----

function getSchoolLogoUrl(school) {
  // Check known domain map first
  const key = (school.name || '').toLowerCase().trim();
  const domain = school.domain || SCHOOL_DOMAINS[key] || guessDomain(key, school.state);
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}`;
}

function guessDomain(name, state) {
  // Try a few common patterns
  const clean = name
    .replace(/\buniversity\b/gi, '')
    .replace(/\bcollege\b/gi, '')
    .replace(/\bstate\b/gi, '')
    .replace(/\bof\b/gi, '')
    .replace(/\bthe\b/gi, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (clean.length === 0) return null;
  const slug = clean.slice(0, 2).join('').toLowerCase();
  if (slug.length < 2) return null;
  return `${slug}.edu`;
}

function renderLogoOrInitials(school) {
  const logoUrl = getSchoolLogoUrl(school);
  const initials = (school.name || '??')
    .split(/\s+/)
    .filter(w => /^[A-Z]/i.test(w))
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  if (logoUrl) {
    return `
      <div class="school-logo-wrap">
        <img
          class="school-logo"
          src="${logoUrl}"
          alt="${school.name} logo"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="school-logo-fallback" style="display:none">${initials}</div>
      </div>
    `;
  }
  return `
    <div class="school-logo-wrap">
      <div class="school-logo-fallback">${initials}</div>
    </div>
  `;
}

// ---- Score Cards ----

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
    card.className = `score-card ${cardClass} reveal-up`;
    card.style.transitionDelay = `${i * 0.12}s`;

    card.innerHTML = `
      <div class="score-card-verdict">${verdictText}</div>
      <div class="score-card-school">
        <div class="score-card-name">${r.school.name}</div>
        <div class="score-card-type">${r.school.type} · ${r.school.city || r.school.state}${r.school.source ? ` · ${r.school.source}` : ''}</div>
      </div>
      <div class="score-display-row">
        <div class="score-display">
          <div class="score-number ${scoreColor}">${r.score}</div>
          <div class="score-suffix">/ 100<br/>financial<br/>health</div>
        </div>
        ${renderLogoOrInitials(r.school)}
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
      // Trigger reveal for newly added cards
      initReveal();
    }, 80);
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
    row.className = 'burden-row reveal-up';
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
      initReveal();
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
  lead.className = 'snapshot-lead reveal-up';
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

  results.forEach((r, i) => {
    const mood  = r.breathingRoom < 0 ? 'red' : r.breathingRoom < 500 ? 'amber' : 'green';
    const width = Math.max(4, Math.min(100, r.freedomPct));
    const card  = document.createElement('div');
    card.className = `snapshot-card ${mood} reveal-up`;
    card.style.transitionDelay = `${i * 0.1}s`;
    card.innerHTML = `
      <div class="snapshot-card-head">
        <span>${r.school.name}</span>
        <strong>${r.breathingRoom < 0 ? '-' : ''}${formatDollars(Math.abs(r.breathingRoom))}/mo</strong>
      </div>
      <div class="snapshot-bar-wrap">
        <div class="snapshot-bar-fill" style="width: ${width}%;"></div>
      </div>
      <div class="snapshot-detail">
        <span class="mono">take-home: ${formatDollars(r.netMonthly)}/mo</span>
        <span class="mono">loan: ${formatDollars(r.monthlyPayment)}/mo</span>
        <span class="mono">living: ~${formatDollars(r.breathingRoom < 0 ? r.netMonthly - r.monthlyPayment : r.netMonthly - r.monthlyPayment - r.breathingRoom)}/mo</span>
      </div>
      <div class="snapshot-verdict ${mood}">
        ${r.breathingRoom < 0 ? '⚠ Budget shortfall' : r.breathingRoom < 300 ? 'Tight but possible' : r.breathingRoom < 800 ? 'Manageable' : 'Comfortable'}
      </div>
    `;
    grid.appendChild(card);
  });
  container.appendChild(grid);
  requestAnimationFrame(() => { setTimeout(() => initReveal(), 80); });
}

function renderTimeline(results) {
  const container = document.getElementById('timeline-section');
  container.innerHTML = '';

  // Fix: use annualNet as the scale basis so bars show even when savings = 0.
  // We show two stacked segments: loan payment (red/amber) + breathing room (green).
  // This way a school with $0 savings still has visible bars (showing where money goes).
  const maxAnnualNet = Math.max(...results.flatMap(r => r.timeline.map(t => t.annualNet)));

  results.forEach((r, ri) => {
    const wrap = document.createElement('div');
    wrap.className = 'timeline-school reveal-up';
    wrap.style.transitionDelay = `${ri * 0.12}s`;

    const scoreColor = getScoreColor(r.score);
    const barAccent = scoreColor === 'green' ? HH.green : scoreColor === 'amber' ? HH.amber : HH.red;
    const totalSaved = r.timeline[r.timeline.length - 1].cumulativeSaved;

    wrap.innerHTML = `<div class="timeline-school-label">${r.school.name} <span class="mono" style="font-size:0.55rem; color:var(--ink3); font-weight:400;">· $${Math.round(totalSaved).toLocaleString()} saved by 30</span></div>`;

    const track = document.createElement('div');
    track.className = 'timeline-track';

    r.timeline.forEach(t => {
      const BAR_MAX = 80; // px tall at 100%
      const scale = maxAnnualNet > 0 ? BAR_MAX / maxAnnualNet : 0;

      // Segments as % of annual net income
      const paymentH = t.stillInRepayment ? Math.round(t.payment * scale) : 0;
      const savedH   = Math.round(Math.max(0, t.saved) * scale);
      const livingH  = Math.max(0, Math.round(t.annualNet * scale) - paymentH - savedH);

      const col = document.createElement('div');
      col.className = `timeline-col${t.stillInRepayment ? ' repaying' : ' free'}`;

      const tooltip = t.stillInRepayment
        ? `Age ${t.age}: $${Math.round(t.payment).toLocaleString()} loans, $${Math.round(t.saved).toLocaleString()} saved`
        : `Age ${t.age}: Debt-free! $${Math.round(t.saved).toLocaleString()} saved this year`;

      col.innerHTML = `
        <div class="timeline-bar-stack" title="${tooltip}" style="height:${BAR_MAX}px;">
          <div class="timeline-seg saved"   style="height:${savedH}px;   background:${barAccent}; opacity:0.85;"></div>
          <div class="timeline-seg living"  style="height:${livingH}px;  background:var(--haze-shore);"></div>
          <div class="timeline-seg payment" style="height:${paymentH}px; background:${paymentH > 0 ? HH.red : 'transparent'}; opacity:0.65;"></div>
        </div>
        <div class="timeline-age mono">${t.age}</div>
      `;
      track.appendChild(col);
    });

    wrap.appendChild(track);

    // Legend for this school
    const legend = document.createElement('div');
    legend.className = 'timeline-legend-row';
    legend.innerHTML = `
      <span><span class="tl-dot" style="background:${barAccent}"></span>Savings</span>
      <span><span class="tl-dot" style="background:var(--haze-shore)"></span>Living costs</span>
      ${r.timeline.some(t => t.stillInRepayment) ? `<span><span class="tl-dot" style="background:${HH.red}; opacity:0.65"></span>Loan payment</span>` : ''}
    `;
    wrap.appendChild(legend);

    container.appendChild(wrap);
  });

  requestAnimationFrame(() => { setTimeout(() => initReveal(), 80); });
}

function renderResultsTitle(results) {
  const names = results.map(r => r.school.name);
  document.getElementById('results-title').textContent =
    names.length === 3 ? `${names[0]} vs. ${names[1]} vs. ${names[2]}` : 'The Numbers Don\'t Lie';
}

function renderVerdict(results) {
  const container = document.getElementById('verdict-section');
  container.innerHTML = '';

  const sorted   = [...results].sort((a, b) => b.score - a.score);
  const winner   = sorted[0];
  const runnerUp = sorted[1];
  const worst    = sorted[sorted.length - 1];

  const monthlySaved = winner.monthlyPayment < worst.monthlyPayment
    ? worst.monthlyPayment - winner.monthlyPayment : 0;

  const div = document.createElement('div');
  div.className = 'verdict-inner reveal-up';
  div.innerHTML = `
    <div class="verdict-tag mono">CollegeTrue verdict</div>
    <h3 class="verdict-headline">
      ${winner.school.name} is your <em>smartest financial bet</em>.
    </h3>
    <p class="verdict-body">
      Choosing ${winner.school.name} over ${worst.school.name} saves you
      <strong>${formatDollars(monthlySaved)}/month</strong> in loan payments —
      that's ${formatDollars(monthlySaved * 12)}/year you keep in your pocket.
      Over the 10-year repayment window, the gap is
      <strong>${formatDollars(monthlySaved * 120)}</strong>.
    </p>
    <div class="verdict-scores">
      ${sorted.map(r => `
        <div class="verdict-score-item">
          <span>${r.school.name}</span>
          <span class="verdict-score-num ${getScoreColor(r.score)}">${r.score}/100</span>
        </div>
      `).join('')}
    </div>
    <p class="verdict-caveat mono">
      Scores are based on loan burden as % of median starting salary for your major,
      monthly breathing room, and debt-to-salary ratio. They're estimates — always
      verify with each school's Net Price Calculator.
    </p>
  `;
  container.appendChild(div);
  requestAnimationFrame(() => { setTimeout(() => initReveal(), 80); });
}
