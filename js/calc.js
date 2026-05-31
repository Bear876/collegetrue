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
  const genericWords = new Set(['college', 'university', 'institute', 'school', 'state', 'the', 'of', 'at', 'a', 'and']);
  const inputWords = key.split(/\s+/).filter(w => w.length > 2 && !genericWords.has(w));

  for (const k of Object.keys(SCHOOLS)) {
    const kWords = k.split(/\s+/).filter(w => w.length > 2 && !genericWords.has(w));
    const hits = inputWords.filter(w => kWords.some(kw => kw.includes(w) || w.includes(kw)));
    if (hits.length > 0 && hits.length >= Math.min(inputWords.length, 1)) {
      return { ...SCHOOLS[k] };
    }
  }

  return null;
}

const MAJOR_SALARIES = {
  cs:         { label: 'CS/Engineering',        startSalary: 88000 },
  business:   { label: 'Business/Finance',       startSalary: 58000 },
  nursing:    { label: 'Nursing/Healthcare',     startSalary: 62000 },
  education:  { label: 'Education',              startSalary: 41000 },
  psychology: { label: 'Psychology',             startSalary: 40000 },
  arts:       { label: 'Arts/Humanities',        startSalary: 38000 },
  bio:        { label: 'Biology/Pre-Med',        startSalary: 42000 },
  law:        { label: 'Pre-Law',                startSalary: 52000 },
  math:       { label: 'Mathematics/Stats',      startSalary: 72000 },
  enviro:     { label: 'Environmental Science',  startSalary: 44000 },
};

const AID_DISCOUNTS = {
  low:  0.00,
  mid:  0.10,
  high: 0.30,
};

const FEDERAL_RATE   = 0.0653;
const LOAN_YEARS     = 10;
const LOAN_MONTHS    = LOAN_YEARS * 12;
const COST_OF_LIVING = 2200;
const TAXES_PCT      = 0.24;
const STUDY_YEARS    = 4;

function calcMonthlyPayment(principal, rate, months) {
  if (principal <= 0) return 0;
  const r = rate / 12;
  if (r === 0) return principal / months;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

async function calcSchool(rawName, majorKey, aidLevel) {
  const major = MAJOR_SALARIES[majorKey] || MAJOR_SALARIES['business'];
  const aidDiscount = AID_DISCOUNTS[aidLevel] ?? 0.10;

  // Try live API first
  let schoolData = null;
  if (typeof fetchScorecardSchoolData === 'function') {
    try { schoolData = await fetchScorecardSchoolData(rawName); } catch {}
  }

  // Fall back to local data
  if (!schoolData || (!schoolData.tuition && !schoolData.netPrice)) {
    const local = lookupSchool(rawName);
    if (local) {
      schoolData = {
        name:     local.fullName || local.name,
        city:     local.city || '',
        state:    local.state || '',
        type:     local.type || 'Private',
        tuition:  local.tuition,
        netPrice: null,
        medianDebt: null,
        medianEarnings: null,
        source: 'Local data',
        domain: local.domain || null,
        estimated: false,
      };
    }
  }

  // Generic fallback
  if (!schoolData) {
    schoolData = {
      name:      rawName,
      city:      '',
      state:     '',
      type:      'Private',
      tuition:   45000,
      netPrice:  null,
      source:    'Estimated',
      estimated: true,
      domain:    null,
    };
  }

  // Determine city cost modifier
  const cityKey = (schoolData.city || '').toLowerCase();
  const stateKey = (schoolData.state || '').toUpperCase();
  const cityMod = getCityMod(cityKey, stateKey);

  // Determine tuition
  let baseTuition = schoolData.netPrice || schoolData.tuition || 45000;
  if (!schoolData.netPrice && schoolData.tuition) {
    baseTuition = schoolData.tuition;
  }

  // Apply aid discount
  const netTuition = Math.round(baseTuition * (1 - aidDiscount));

  // Total debt for 4 years
  const totalDebt = netTuition * STUDY_YEARS;

  // Monthly loan payment
  const monthlyPayment = Math.round(calcMonthlyPayment(totalDebt, FEDERAL_RATE, LOAN_MONTHS));
  const totalPaid      = monthlyPayment * LOAN_MONTHS;
  const totalInterest  = Math.round(totalPaid - totalDebt);

  // Salary & take-home
  const grossMonthly   = Math.round(major.startSalary / 12);
  const netMonthly     = Math.round(grossMonthly * (1 - TAXES_PCT));
  const paymentPct     = Math.round((monthlyPayment / netMonthly) * 100);

  // Age-25 snapshot
  const adjustedLiving = Math.round(COST_OF_LIVING * cityMod);
  const breathingRoom  = netMonthly - monthlyPayment - adjustedLiving;
  const freedomPct     = Math.max(0, Math.round((breathingRoom / netMonthly) * 100));

  // Timeline (years 22–30)
  const timeline = [];
  let cumulativeSaved = 0;
  for (let yr = 0; yr <= 8; yr++) {
    const age = 22 + yr;
    const stillInRepayment = yr < LOAN_YEARS;
    const payment = stillInRepayment ? monthlyPayment * 12 : 0;
    const annualNet = netMonthly * 12;
    const living = adjustedLiving * 12;
    const saved  = Math.max(0, annualNet - payment - living);
    cumulativeSaved += saved;
    timeline.push({ age, stillInRepayment, payment, annualNet, living, saved, cumulativeSaved });
  }

  // Score 0–100
  const score = computeScore(paymentPct, breathingRoom, netTuition, major.startSalary);

  return {
    school: {
      name:      schoolData.name || rawName,
      fullName:  schoolData.name || rawName,
      type:      schoolData.type || 'Private',
      city:      schoolData.city || '',
      state:     schoolData.state || '',
      source:    schoolData.source || '',
      estimated: schoolData.estimated || false,
      domain:    schoolData.domain || null,
    },
    major,
    netTuition,
    totalDebt,
    monthlyPayment,
    totalPaid,
    totalInterest,
    grossMonthly,
    netMonthly,
    paymentPct,
    breathingRoom,
    freedomPct,
    timeline,
    score,
  };
}

function getCityMod(city, state) {
  const NYC_AREAS    = ['new york', 'brooklyn', 'queens', 'bronx', 'manhattan', 'staten island', 'jersey city', 'hoboken'];
  const BAY_AREAS    = ['san francisco', 'san jose', 'oakland', 'berkeley', 'palo alto', 'mountain view', 'sunnyvale', 'santa clara', 'cupertino'];
  const LA_AREAS     = ['los angeles', 'santa monica', 'west hollywood', 'beverly hills', 'culver city', 'long beach', 'pasadena', 'glendale'];
  const BOSTON_AREAS = ['boston', 'cambridge', 'somerville', 'brookline', 'newton', 'medford', 'malden', 'quincy'];
  const DC_AREAS     = ['washington', 'arlington', 'alexandria', 'bethesda', 'silver spring', 'college park'];
  const SEATTLE_AREAS= ['seattle', 'bellevue', 'redmond', 'kirkland', 'renton', 'tacoma'];
  const MIAMI_AREAS  = ['miami', 'coral gables', 'miami beach', 'ft lauderdale', 'fort lauderdale', 'boca raton'];
  const CHICAGO_AREAS= ['chicago', 'evanston', 'oak park', 'naperville'];

  if (NYC_AREAS.some(a => city.includes(a))) return 1.45;
  if (BAY_AREAS.some(a => city.includes(a))) return 1.50;
  if (LA_AREAS.some(a => city.includes(a)))  return 1.35;
  if (BOSTON_AREAS.some(a => city.includes(a))) return 1.38;
  if (DC_AREAS.some(a => city.includes(a)))  return 1.32;
  if (SEATTLE_AREAS.some(a => city.includes(a))) return 1.30;
  if (MIAMI_AREAS.some(a => city.includes(a)))   return 1.20;
  if (CHICAGO_AREAS.some(a => city.includes(a))) return 1.18;

  // State-based fallback
  const highCostStates = new Set(['NY','CA','MA','DC','CT','NJ','HI','WA']);
  const lowCostStates  = new Set(['MS','AR','WV','KY','IN','IA','NE','KS','OK','SD','ND','MT','ID','WY']);
  if (highCostStates.has(state)) return 1.25;
  if (lowCostStates.has(state))  return 0.82;
  return 1.00;
}

function computeScore(paymentPct, breathingRoom, netTuition, startSalary) {
  let score = 100;
  // Penalize for high payment burden
  if (paymentPct > 30) score -= 40;
  else if (paymentPct > 25) score -= 30;
  else if (paymentPct > 20) score -= 20;
  else if (paymentPct > 15) score -= 10;
  else if (paymentPct > 10) score -= 4;
  // Penalize for negative breathing room
  if (breathingRoom < 0)    score -= 25;
  else if (breathingRoom < 200) score -= 15;
  else if (breathingRoom < 500) score -= 8;
  // Penalize for very high debt relative to salary
  const debtToSalary = (netTuition * 4) / startSalary;
  if (debtToSalary > 2.5) score -= 15;
  else if (debtToSalary > 1.5) score -= 8;
  else if (debtToSalary > 1.0) score -= 4;
  return Math.max(5, Math.min(100, Math.round(score)));
}

function getScoreColor(score) {
  if (score >= 70) return 'green';
  if (score >= 45) return 'amber';
  return 'red';
}

function getBarColor(pct) {
  if (pct <= 12) return '#2e7d6e';
  if (pct <= 20) return '#b7862a';
  return '#c05a48';
}

function formatDollars(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n).toLocaleString();
  return '$' + Math.round(n);
}
