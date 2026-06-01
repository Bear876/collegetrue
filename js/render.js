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
  const key = (school.name || '').toLowerCase().trim();
  const domain = school.domain || SCHOOL_DOMAINS[key] || guessDomain(key, school.state);
  if (!domain) return null;
  // Google's favicon service is reliable for .edu domains — returns the actual university favicon/logo
  return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
}

function getSchoolLogoFallbackUrl(domain) {
  // Clearbit as secondary attempt
  return `https://logo.clearbit.com/${domain}`;
}

function guessDomain(name, state) {
  const n = name.toLowerCase();

  // Common abbreviation patterns
  const abbrevMap = {
    'mit': 'mit.edu', 'nyu': 'nyu.edu', 'usc': 'usc.edu', 'ucla': 'ucla.edu',
    'ucsd': 'ucsd.edu', 'ucsb': 'ucsb.edu', 'ucd': 'ucdavis.edu', 'ucb': 'berkeley.edu',
    'ucf': 'ucf.edu', 'uci': 'uci.edu', 'uva': 'virginia.edu', 'unc': 'unc.edu',
    'uf': 'ufl.edu', 'asu': 'asu.edu', 'rpi': 'rpi.edu', 'wpi': 'wpi.edu',
    'smu': 'smu.edu', 'lsu': 'lsu.edu', 'tcu': 'tcu.edu', 'byu': 'byu.edu',
    'vcu': 'vcu.edu', 'gmu': 'gmu.edu', 'gsu': 'gsu.edu', 'fsu': 'fsu.edu',
    'csu': 'colostate.edu', 'uiuc': 'illinois.edu', 'upenn': 'upenn.edu',
    'pitt': 'pitt.edu', 'ohio state': 'osu.edu', 'penn state': 'psu.edu',
    'ut austin': 'utexas.edu', 'georgia tech': 'gatech.edu',
    'michigan state': 'msu.edu', 'iowa state': 'iastate.edu',
    'ohio state university': 'osu.edu', 'university of michigan': 'umich.edu',
  };
  for (const [k, v] of Object.entries(abbrevMap)) {
    if (n === k || n.includes(k)) return v;
  }

  const clean = name
    .replace(/\buniversity\b/gi, '')
    .replace(/\bcollege\b/gi, '')
    .replace(/\bstate\b/gi, '')
    .replace(/\bof\b/gi, '')
    .replace(/\bthe\b/gi, '')
    .replace(/\bat\b/gi, '')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (clean.length === 0) return null;
  const slug = clean.slice(0, 2).join('').toLowerCase();
  if (slug.length < 2) return null;
  return `${slug}.edu`;
}

function renderLogoOrInitials(school) {
  const key = (school.name || '').toLowerCase().trim();
  const domain = school.domain || (typeof SCHOOL_DOMAINS !== 'undefined' && SCHOOL_DOMAINS[key]) || guessDomain(key, school.state);

  const initials = (school.name || '??')
    .split(/\s+/)
    .filter(w => /^[A-Z]/i.test(w))
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  const colorSeed = (school.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
  const palettes = [
    ['#dbeafe','#1d4ed8'],['#dcfce7','#15803d'],['#fef3c7','#92400e'],
    ['#fce7f3','#be185d'],['#ede9fe','#5b21b6'],['#e0f2fe','#075985'],
  ];
  const [bg, fg] = palettes[colorSeed];
  const fallbackHtml = `<div class="school-logo-fallback" style="display:none; background:${bg}; color:${fg};">${initials}</div>`;

  if (domain) {
    // Try in order: apple-touch-icon (180px, high-res) → Google favicon (128px) → Clearbit → initials
    const src1 = `https://${domain}/apple-touch-icon.png`;
    const src2 = `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
    const src3 = `https://logo.clearbit.com/${domain}`;
    return `
      <div class="school-logo-wrap">
        <img
          class="school-logo"
          src="${src1}"
          alt="${school.name} logo"
          onerror="const t=this.dataset.t||'0';if(t==='0'){this.dataset.t='1';this.src='${src2}';}else if(t==='1'){this.dataset.t='2';this.src='${src3}';}else{this.style.display='none';this.nextElementSibling.style.display='flex';}"
        />
        ${fallbackHtml}
      </div>
    `;
  }
  return `
    <div class="school-logo-wrap">
      <div class="school-logo-fallback" style="background:${bg}; color:${fg};">${initials}</div>
    </div>
  `;
}

// ---- Score Cards ----

function renderScoreCards(results) {
  const container = document.getElementById('score-cards');
  container.innerHTML = '';

  const sorted = [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.monthlyPayment - b.monthlyPayment; // tie-break: lower payment wins
  });
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
    card.className = `score-card ${cardClass} reveal-scale`;
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

  results.forEach((r, idx) => {
    const barPct    = maxPayment > 0 ? Math.round((r.monthlyPayment / maxPayment) * 100) : 0;
    const barColor  = getBarColor(r.paymentPct);
    const thresh15  = Math.max(8, Math.min(92, maxPct > 0 ? Math.round((15 / maxPct) * 100) : 50));
    const thresh25  = Math.max(8, Math.min(92, maxPct > 0 ? Math.round((25 / maxPct) * 100) : 80));

    const row = document.createElement('div');
    row.className = 'burden-row reveal-left';
    row.style.transitionDelay = `${idx * 0.1}s`;
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

  const maxAnnualNet = Math.max(...results.flatMap(r => r.timeline.map(t => t.annualNet)));

  // ---- One global legend at the top — always the same ----
  const globalLegend = document.createElement('div');
  globalLegend.className = 'timeline-legend-global reveal-up';
  globalLegend.innerHTML = `
    <span class="tl-legend-item"><span class="tl-dot" style="background:#2e7d6e;"></span><span>Savings / free cash</span></span>
    <span class="tl-legend-item"><span class="tl-dot" style="background:#c8d4dc;"></span><span>Living costs</span></span>
    <span class="tl-legend-item"><span class="tl-dot" style="background:#c05a48; opacity:0.75;"></span><span>Loan payment</span></span>
  `;
  container.appendChild(globalLegend);

  // Fixed colors that always match the legend key
  const COLOR_SAVINGS = '#2e7d6e';
  const COLOR_LIVING  = '#c8d4dc';
  const COLOR_PAYMENT = '#c05a48';

  results.forEach((r, ri) => {
    const wrap = document.createElement('div');
    wrap.className = 'timeline-school reveal-up';
    wrap.style.transitionDelay = `${ri * 0.12}s`;

    const totalSaved = r.timeline[r.timeline.length - 1].cumulativeSaved;

    wrap.innerHTML = `<div class="timeline-school-label">${r.school.name} <span class="timeline-saved-label">· $${Math.round(totalSaved).toLocaleString()} saved by age 30</span></div>`;

    const track = document.createElement('div');
    track.className = 'timeline-track';

    r.timeline.forEach(t => {
      const BAR_MAX = 80;
      const scale = maxAnnualNet > 0 ? BAR_MAX / maxAnnualNet : 0;

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
          <div class="timeline-seg saved"   style="height:${savedH}px;   background:${COLOR_SAVINGS};"></div>
          <div class="timeline-seg living"  style="height:${livingH}px;  background:${COLOR_LIVING};"></div>
          <div class="timeline-seg payment" style="height:${paymentH}px; background:${paymentH > 0 ? COLOR_PAYMENT : 'transparent'};"></div>
        </div>
        <div class="timeline-age mono">${t.age}</div>
      `;
      track.appendChild(col);
    });

    wrap.appendChild(track);
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

  const sorted = [...results].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.monthlyPayment - b.monthlyPayment;
  });
  const winner   = sorted[0];
  const others   = sorted.slice(1); // everyone the winner beats

  // Check if it was a score tie (winner won purely on lower payment)
  const tiedSchools = results.filter(r => r.score === winner.score);
  const wasTie = tiedSchools.length > 1;

  // Build a comparison line for each other school
  const comparisonLines = others.map(other => {
    const diff = other.monthlyPayment - winner.monthlyPayment;
    if (diff <= 0) {
      // winner actually costs more monthly (edge case — shouldn't happen after sort, but be safe)
      return `<strong>${other.school.name}</strong> has a similar monthly cost (${formatDollars(other.monthlyPayment)}/mo vs. ${formatDollars(winner.monthlyPayment)}/mo).`;
    }
    return `vs. <strong>${other.school.name}</strong>: <strong>${formatDollars(diff)}/mo less</strong> — that's ${formatDollars(diff * 12)}/yr, or ${formatDollars(diff * 120)} over 10 years.`;
  });

  // Tie-breaking explanation
  const tieNote = wasTie
    ? `<p class="verdict-tie-note mono">⚖ ${tiedSchools.map(s => s.school.name).join(' and ')} both scored ${winner.score}/100 — identical financial health rating. ${winner.school.name} wins the tie because it has the lowest monthly payment (${formatDollars(winner.monthlyPayment)}/mo), meaning more money in your pocket every single month.</p>`
    : '';

  const div = document.createElement('div');
  div.className = 'verdict-inner reveal-up';
  div.innerHTML = `
    <div class="verdict-tag mono">CollegeTrue verdict</div>
    <h3 class="verdict-headline">
      ${winner.school.name} is your <em>smartest financial bet</em>.
    </h3>
    ${tieNote}
    <div class="verdict-comparisons">
      ${comparisonLines.map(line => `<div class="verdict-comparison-row">${line}</div>`).join('')}
    </div>
    <div class="verdict-scores">
      ${sorted.map(r => `
        <div class="verdict-score-item">
          <span class="verdict-score-name">${r.school.name}</span>
          <div class="verdict-score-right">
            <span class="verdict-score-detail mono">${formatDollars(r.monthlyPayment)}/mo · ${r.paymentPct}% of paycheck</span>
            <span class="verdict-score-num ${getScoreColor(r.score)}">${r.score}/100</span>
          </div>
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
