// ============================================
// CollegeTrue - College Scorecard API Layer
// ============================================

const SCORECARD_BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const SCORECARD_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.ownership',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.cost.attendance.academic_year',
  'latest.cost.avg_net_price.public',
  'latest.cost.avg_net_price.private',
  'latest.aid.median_debt.completers.overall',
  'latest.earnings.10_yrs_after_entry.median',
  'latest.completion.completion_rate_4yr_150nt',
  'latest.school.institutional_characteristics.level',
].join(',');

const DEMO_KEY = 'DEMO_KEY';

// --------------------------------------------
// Local fallback data and generic fallback
// --------------------------------------------

// Specific local fallback data for a few demo colleges
const LOCAL_COLLEGE_DATA = {
  'university of texas at austin': {
    name: 'University of Texas at Austin',
    city: 'Austin',
    state: 'TX',
    type: 'Public',
    tuition: 25000,
    tuitionOut: 55000,
    netPrice: 25000,
    medianDebt: 24000,
    medianEarnings: 65000,
    source: 'Fallback estimate',
  },
  'quinnipiac university': {
    name: 'Quinnipiac University',
    city: 'Hamden',
    state: 'CT',
    type: 'Private Non-Profit',
    tuition: 52000,
    tuitionOut: 52000,
    netPrice: 38000,
    medianDebt: 27000,
    medianEarnings: 58000,
    source: 'Fallback estimate',
  },
  'utah valley university': {
    name: 'Utah Valley University',
    city: 'Orem',
    state: 'UT',
    type: 'Public',
    tuition: 17000,
    tuitionOut: 17000,
    netPrice: 17000,
    medianDebt: 19000,
    medianEarnings: 52000,
    source: 'Fallback estimate',
  },
};

// Generic fallback for any other school
const GENERIC_FALLBACK_TEMPLATE = {
  city: '',
  state: '',
  type: 'Unknown',
  tuition: 25000,
  tuitionOut: 35000,
  netPrice: 25000,
  medianDebt: 25000,
  medianEarnings: 60000,
  source: 'Generic estimate (API unavailable)',
};

function getLocalCollegeFallback(name) {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return LOCAL_COLLEGE_DATA[key] || null;
}

// --------------------------------------------
// Search endpoint
// --------------------------------------------

async function searchScorecardSchools(query, limit = 8) {
  try {
    const url = new URL(SCORECARD_BASE_URL);
    url.searchParams.set('api_key', DEMO_KEY);
    url.searchParams.set('school.name', query);
    url.searchParams.set('fields', 'id,school.name,school.city,school.state,school.ownership,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state');
    url.searchParams.set('per_page', String(limit));
    url.searchParams.set('page', '0');

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.results || !Array.isArray(json.results)) return [];

    return json.results
      .map(r => ({
        name: r['school.name'] || '',
        city: r['school.city'] || '',
        state: r['school.state'] || '',
        type: ownershipLabel(r['school.ownership']),
        source: 'Scorecard',
        tuition_in: r['latest.cost.tuition.in_state'],
        tuition_out: r['latest.cost.tuition.out_of_state'],
        scorecardId: r['id'],
      }))
      .filter(s => s.name);
  } catch {
    return [];
  }
}

// --------------------------------------------
// Detail endpoint (single school)
// --------------------------------------------

async function fetchScorecardSchoolData(name) {
  try {
    const url = new URL(SCORECARD_BASE_URL);
    url.searchParams.set('api_key', DEMO_KEY);
    url.searchParams.set('school.name', name);
    url.searchParams.set('fields', SCORECARD_FIELDS);
    url.searchParams.set('per_page', '3');
    url.searchParams.set('page', '0');

    const res = await fetch(url.toString());
    if (!res.ok) return null; // covers 429 and other non 2xx
    const json = await res.json();
    if (!json.results || json.results.length === 0) return null;

    const r = json.results[0];
    return {
      name: r['school.name'] || name,
      city: r['school.city'] || '',
      state: r['school.state'] || '',
      type: ownershipLabel(r['school.ownership']),
      tuition: r['latest.cost.tuition.in_state'] || r['latest.cost.tuition.out_of_state'] || null,
      tuitionOut: r['latest.cost.tuition.out_of_state'] || null,
      netPrice: r['latest.cost.avg_net_price.public'] || r['latest.cost.avg_net_price.private'] || null,
      medianDebt: r['latest.aid.median_debt.completers.overall'] || null,
      medianEarnings: r['latest.earnings.10_yrs_after_entry.median'] || null,
      source: 'Scorecard API',
    };
  } catch {
    return null;
  }
}

// High level helper: always returns some data, even if API is rate limited
async function fetchSchoolWithFallback(name) {
  // 1. Try live API
  const live = await fetchScorecardSchoolData(name);
  if (live) {
    return live; // source is "Scorecard API"
  }

  // 2. Try specific local fallback
  const local = getLocalCollegeFallback(name);
  if (local) {
    const copy = { ...local };
    return copy;
  }

  // 3. Use generic fallback
  const generic = { ...GENERIC_FALLBACK_TEMPLATE };
  generic.name = name;
  return generic;
}

function ownershipLabel(code) {
  if (code === 1) return 'Public';
  if (code === 2) return 'Private Non-Profit';
  if (code === 3) return 'Private For-Profit';
  return 'Private';
}
