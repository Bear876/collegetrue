// ============================================
// CollegeTrue - Calculation Engine
// ============================================

function lookupSchool(raw) {
  const key = raw.trim().toLowerCase();
  if (SCHOOLS[key]) return { ...SCHOOLS[key] };

  // Fuzzy match - find key that contains or is contained by input
  for (const k of Object.keys(SCHOOLS)) {
    if (k.includes(key) || key.includes(k)) return { ...SCHOOLS[k] };
  }

  // Partial word match
  const genericWords = new Set(['college', 'university', 'state', 'campus', 'institute', 'school']);
  const words = key.split(' ').filter(w => w.length > 3 && !genericWords.has(w));
  for (const k of Object.keys(SCHOOLS)) {
    for (const word of words) {
      if (k.includes(word)) return { ...SCHOOLS[k] };
    }
  }

  // Fallback - estimate based on length heuristic
  const isLikelyPrivate = raw.length > 14 && !raw.toLowerCase().includes('university of') && !raw.toLowerCase().includes('state');
  return {
    name: titleCase(raw.trim()),
    fullName: raw.trim(),
    tuition: isLikelyPrivate ? 52000 : 16000,
    cityMod: 1.0,
    type: isLikelyPrivate ? 'Private (est.)' : 'Public (est.)',
    state: '-',
    city: 'varies',
    estimated: true,
  };
}

function titleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

async function resolveSchool(raw) {
  const key = raw.trim().toLowerCase();
  if (SCHOOLS[key]) return { ...SCHOOLS[key] };

  if (typeof resolveScorecardSchool === 'function') {
    const liveSchool = await resolveScorecardSchool(raw);
    if (liveSchool) return liveSchool;
  }

  return lookupSchool(raw);
}

async function calcSchool(schoolRaw, majorKey, aidLevel) {
  const school = await resolveSchool(schoolRaw);
  const major = MAJORS[majorKey];
  const aidRate = AID_RATES[aidLevel];

  // Cost calculations
  const grantAid = Math.round(school.tuition * aidRate);
  const netTuition = school.tuition - grantAid;
  const annualLiving = Math.round(LIVING_BASE * school.cityMod);
  const annualTotal = netTuition + annualLiving;
  const totalDebt = annualTotal * 4;  // 4-year degree

  // Loan repayment - standard federal 10-year plan, 5.5% avg rate
  const ANNUAL_RATE = 0.055;
  const MONTHLY_RATE = ANNUAL_RATE / 12;
  const N_PAYMENTS = 120; // 10 years
  const monthlyPayment = totalDebt > 0
    ? Math.round(totalDebt * MONTHLY_RATE / (1 - Math.pow(1 + MONTHLY_RATE, -N_PAYMENTS)))
    : 0;

  // Income calculations
  const annualGrossSalary = major.salary;
  const taxRate = annualGrossSalary > 55000 ? 0.28 : 0.22; // rough effective rate
  const annualTakehome = Math.round(annualGrossSalary * (1 - taxRate));
  const monthlyTakehome = Math.round(annualTakehome / 12);

  // Payment burden
  const paymentPct = Math.round((monthlyPayment / monthlyTakehome) * 100);

  // First-job budget snapshot
  const rent = Math.round(monthlyTakehome * 0.30);
  const food = Math.round(monthlyTakehome * 0.12);
  const transport = Math.round(monthlyTakehome * 0.10);
  const essentials = rent + food + transport;
  const breathingRoom = monthlyTakehome - essentials - monthlyPayment;
  const freedomPct = Math.round((Math.max(0, breathingRoom) / monthlyTakehome) * 100);

  // Total interest paid over 10 years
  const totalPaid = monthlyPayment * N_PAYMENTS;
  const totalInterest = Math.round(totalPaid - totalDebt);

  // Financial health score (0-100)
  let score = 100;
  // Primary driver: debt-to-income ratio (monthly payment as % of take-home)
  if (paymentPct >= 35)      score -= 60;
  else if (paymentPct >= 28) score -= 48;
  else if (paymentPct >= 22) score -= 36;
  else if (paymentPct >= 16) score -= 22;
  else if (paymentPct >= 10) score -= 10;
  else if (paymentPct >= 5)  score -= 3;

  // Secondary: absolute debt load
  if (totalDebt > 180000) score -= 18;
  else if (totalDebt > 120000) score -= 12;
  else if (totalDebt > 80000) score -= 7;
  else if (totalDebt > 40000) score -= 3;

  // Bonus for public schools (generally more transparent, better value)
  if (school.type === 'Public') score += 5;

  score = Math.max(5, Math.min(100, score));

  // Life timeline - what can you afford each year?
  const timeline = buildTimeline(monthlyPayment, monthlyTakehome, paymentPct);

  return {
    school,
    major,
    grantAid,
    netTuition: Math.round(netTuition),
    annualLiving,
    annualTotal: Math.round(annualTotal),
    totalDebt: Math.round(totalDebt),
    monthlyPayment,
    monthlyTakehome,
    annualTakehome,
    annualGrossSalary,
    paymentPct,
    rent,
    food,
    transport,
    essentials,
    breathingRoom,
    freedomPct,
    totalInterest,
    totalPaid: Math.round(totalPaid),
    score,
    timeline,
  };
}

function buildTimeline(monthlyPayment, monthlyTakehome, paymentPct) {
  // Rough monthly budget breakdown post-graduation
  const rent = Math.round(monthlyTakehome * 0.30);
  const food = Math.round(monthlyTakehome * 0.12);
  const transport = Math.round(monthlyTakehome * 0.10);
  const leftoverBeforeLoans = monthlyTakehome - rent - food - transport;
  const leftoverAfterLoans = leftoverBeforeLoans - monthlyPayment;
  const canSave = leftoverAfterLoans > 200;
  const canInvest = leftoverAfterLoans > 600;
  const canTravel = leftoverAfterLoans > 400;
  const stressed = paymentPct > 22;
  const crushing = paymentPct > 30;

  return [
    {
      age: 22,
      year: "Year 1",
      label: crushing ? "Survival mode" : stressed ? "Tight budget" : "Getting started",
      color: crushing ? "red" : stressed ? "amber" : "green",
      note: crushing
        ? `$${leftoverAfterLoans < 0 ? '0' : leftoverAfterLoans.toLocaleString()} left after essentials + loans`
        : `$${Math.max(0, leftoverAfterLoans).toLocaleString()}/mo breathing room`,
    },
    {
      age: 23,
      year: "Year 2",
      label: crushing ? "No safety net" : stressed ? "Scraping by" : "Building savings",
      color: crushing ? "red" : stressed ? "amber" : "green",
      note: crushing ? "Can't save. Emergency fund: $0" : canSave ? "Starting emergency fund" : "Saving slowly",
    },
    {
      age: 24,
      year: "Year 3",
      label: crushing ? "Career pressure" : stressed ? "Slow progress" : "Getting stable",
      color: crushing ? "red" : stressed ? "amber" : "green",
      note: crushing ? "Must chase salary urgently" : stressed ? "Debt still dominant" : "Debt manageable",
    },
    {
      age: 25,
      year: "Year 4",
      label: crushing ? "Major sacrifice" : stressed ? "Trade-offs" : "Investing begins",
      color: crushing ? "red" : stressed ? "amber" : "green",
      note: crushing ? "No home, no investments" : canInvest ? "Starting 401k / Roth IRA" : "Saving, not investing yet",
    },
    {
      age: 26,
      year: "Year 5",
      label: crushing ? "Still locked in" : stressed ? "Light ahead" : "Growing wealth",
      color: crushing ? "red" : stressed ? "amber" : "green",
      note: crushing ? "5 years left of payments" : stressed ? "Halfway through debt" : "Net worth turning positive",
    },
    {
      age: 27,
      year: "Year 6",
      label: crushing ? "Halfway & hurting" : stressed ? "Progressing" : "Real freedom",
      color: crushing ? "red" : stressed ? "amber" : "green",
      note: crushing ? "Still $" + Math.round(monthlyPayment * 12 * 4).toLocaleString() + " of debt left" : canTravel ? "Can travel + invest" : "On track",
    },
    {
      age: 28,
      year: "Year 7",
      label: crushing ? "Side hustle needed" : stressed ? "Getting easier" : "Milestone years",
      color: crushing ? "red" : stressed ? "amber" : "green",
      note: crushing ? "Must earn more to survive" : "Flexibility increasing",
    },
    {
      age: 30,
      year: "Year 9",
      label: crushing ? "Near the end" : stressed ? "Almost there" : "Debt-free ahead",
      color: crushing ? "amber" : "green",
      note: "2 years of payments left",
    },
    {
      age: 32,
      year: "Year 11",
      label: "Debt-free!",
      color: "green",
      note: crushing
        ? `$${(monthlyPayment * 120).toLocaleString()} total paid over 10 years`
        : `$${(monthlyPayment * 120).toLocaleString()} paid - now fully yours`,
    },
  ];
}

function getScoreColor(score) {
  if (score >= 68) return 'green';
  if (score >= 42) return 'amber';
  return 'red';
}

function getBarColor(pct) {
  if (pct <= 10) return '#2f8f5b';
  if (pct <= 16) return '#69a979';
  if (pct <= 22) return '#b7791f';
  if (pct <= 28) return '#c58b3a';
  return '#c0564a';
}

function getBarHex(color) {
  const map = { green: '#2f8f5b', amber: '#b7791f', red: '#c0564a' };
  return map[color] || '#9b9896';
}

function formatDollars(n) {
  return '$' + Math.round(n).toLocaleString();
}

function buildVerdict(results) {
  const sorted = [...results].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const mid = sorted[1];
  const majorLabel = results[0].major.label;
  const salary = results[0].annualGrossSalary;

  const debtGap = worst.totalDebt - best.totalDebt;
  const paymentGap = worst.monthlyPayment - best.monthlyPayment;

  let headline = '';
  let body = '';

  if (best.paymentPct <= 10) {
    headline = `${best.school.name} is genuinely a great financial decision.`;
  } else if (best.paymentPct <= 16) {
    headline = `${best.school.name} is your safest bet - manageable, not ideal.`;
  } else if (best.paymentPct <= 22) {
    headline = `None of your options are cheap - but ${best.school.name} is the least painful.`;
  } else {
    headline = `All three schools carry real financial risk for a ${majorLabel} grad.`;
  }

  body += `You're planning to study <strong>${majorLabel}</strong>, a field that pays a median starting salary of around <strong>${formatDollars(salary)}/year</strong> - that's roughly <strong>${formatDollars(results[0].monthlyTakehome)}/month take-home</strong> after taxes. `;

  body += `<strong class="highlight-green">${best.school.name}</strong> costs you <strong>${formatDollars(best.monthlyPayment)}/month</strong> in loan payments - <span class="highlight-${getScoreColor(best.score)}">${best.paymentPct}% of your paycheck</span> - for 10 straight years. `;

  if (worst !== best) {
    if (worst.paymentPct > 28) {
      body += `<strong class="highlight-red">${worst.school.name}</strong>, by contrast, would take <strong>${formatDollars(worst.monthlyPayment)}/month</strong> - that's <span class="highlight-red">${worst.paymentPct}% of every paycheck</span> you earn for a decade. That's not just tight; that changes the trajectory of your 20s. `;
    } else {
      body += `<strong>${worst.school.name}</strong> would cost <strong>${formatDollars(worst.monthlyPayment)}/month</strong> - <span class="highlight-amber">${worst.paymentPct}% of your paycheck</span> - which is noticeable but not disqualifying if you're intentional. `;
    }
  }

  if (debtGap > 10000) {
    body += `The raw debt gap between your cheapest and most expensive option is <strong>${formatDollars(debtGap)}</strong>. That's money that could be a down payment on a home, a year of travel, or years of compound interest in a retirement account. `;
  }

  if (best.paymentPct > 22) {
    body += `<strong>Honest advice:</strong> consider whether there are in-state public schools or schools with stronger merit aid programs for your major. The prestige premium often isn't reflected in salary for ${majorLabel} grads.`;
  } else if (best.paymentPct <= 10) {
    body += `<strong>You're in a strong position.</strong> ${best.school.name} gives you real financial flexibility - you can save, invest, and build wealth in your 20s while your peers are counting pennies.`;
  } else {
    body += `<strong>Bottom line:</strong> go in with eyes open. Run the net price calculator at each school's financial aid office - actual aid packages can shift these numbers significantly.`;
  }

  return { headline, body };
}
