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

    return json.results.map(r => ({
      name: r['school.name'] || '',
      city: r['school.city'] || '',
      state: r['school.state'] || '',
      type: ownershipLabel(r['school.ownership']),
      source: 'Scorecard',
      tuition_in: r['latest.cost.tuition.in_state'],
      tuition_out: r['latest.cost.tuition.out_of_state'],
      scorecardId: r['id'],
    })).filter(s => s.name);
  } catch {
    return [];
  }
}

async function fetchScorecardSchoolData(name) {
  try {
    const url = new URL(SCORECARD_BASE_URL);
    url.searchParams.set('api_key', DEMO_KEY);
    url.searchParams.set('school.name', name);
    url.searchParams.set('fields', SCORECARD_FIELDS);
    url.searchParams.set('per_page', '3');
    url.searchParams.set('page', '0');

    const res = await fetch(url.toString());
    if (!res.ok) return null;
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

function ownershipLabel(code) {
  if (code === 1) return 'Public';
  if (code === 2) return 'Private Non-Profit';
  if (code === 3) return 'Private For-Profit';
  return 'Private';
}
