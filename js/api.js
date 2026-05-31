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
  'latest.student.size',
].join(',');

const scorecardCache = new Map();
const scorecardSearchCache = new Map();

function getScorecardApiKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('api_key') || localStorage.getItem('collegeTrueScorecardKey') || 'DEMO_KEY';
}

function normalizeSchoolName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|at|of|campus|main|immersion)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreSchoolMatch(query, schoolName) {
  const q = normalizeSchoolName(query);
  const name = normalizeSchoolName(schoolName);
  if (!q || !name) return 0;
  if (name === q) return 1000;
  if (name.startsWith(q)) return 850;
  if (name.includes(q)) return 700;

  const qWords = q.split(' ').filter(w => w.length > 1);
  const matched = qWords.filter(w => name.includes(w)).length;
  return matched * 100 + Math.min(50, schoolName.length ? 50 - Math.abs(schoolName.length - query.length) : 0);
}

function ownershipLabel(code) {
  if (code === 1) return 'Public';
  if (code === 2) return 'Private nonprofit';
  if (code === 3) return 'Private for-profit';
  return 'College';
}

function estimateCityMod(state, city) {
  const highCostStates = new Set(['CA', 'NY', 'MA', 'DC', 'NJ', 'WA', 'HI', 'CT']);
  const lowCostStates = new Set(['AL', 'AR', 'IA', 'KS', 'KY', 'MS', 'NE', 'ND', 'OK', 'SD', 'WV']);
  const expensiveCities = ['New York', 'Boston', 'San Francisco', 'Los Angeles', 'Washington', 'Seattle', 'San Jose'];
  if (expensiveCities.some(c => (city || '').includes(c))) return 1.32;
  if (highCostStates.has(state)) return 1.16;
  if (lowCostStates.has(state)) return 0.88;
  return 1.0;
}

function getScorecardValue(row, field) {
  return row[field] == null ? null : Number(row[field]);
}

function mapScorecardSchool(row, query = '') {
  const publicNet = getScorecardValue(row, 'latest.cost.avg_net_price.public');
  const privateNet = getScorecardValue(row, 'latest.cost.avg_net_price.private');
  const inState = getScorecardValue(row, 'latest.cost.tuition.in_state');
  const outState = getScorecardValue(row, 'latest.cost.tuition.out_of_state');
  const attendance = getScorecardValue(row, 'latest.cost.attendance.academic_year');
  const ownership = Number(row['school.ownership']);
  const type = ownershipLabel(ownership);
  const bestTuition = inState || outState || publicNet || privateNet || (attendance ? Math.round(attendance * 0.55) : null);

  return {
    id: row.id,
    name: row['school.name'],
    fullName: row['school.name'],
    tuition: bestTuition || 18000,
    outOfStateTuition: outState,
    attendance,
    cityMod: estimateCityMod(row['school.state'], row['school.city']),
    type,
    state: row['school.state'] || 'US',
    city: row['school.city'] || 'United States',
    studentSize: getScorecardValue(row, 'latest.student.size') || 0,
    source: 'College Scorecard',
    estimated: !bestTuition,
    matchScore: scoreSchoolMatch(query, row['school.name']),
  };
}

function buildScorecardUrl(query, perPage = 25) {
  const params = new URLSearchParams({
    api_key: getScorecardApiKey(),
    'school.name': query,
    'school.degrees_awarded.predominant': '2,3',
    fields: SCORECARD_FIELDS,
    per_page: String(perPage),
  });
  return `${SCORECARD_BASE_URL}?${params.toString()}`;
}

async function searchScorecardSchools(query, limit = 8) {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const cacheKey = clean.toLowerCase();
  if (scorecardSearchCache.has(cacheKey)) {
    return scorecardSearchCache.get(cacheKey).slice(0, limit);
  }

  try {
    const res = await fetch(buildScorecardUrl(clean));
    if (!res.ok) throw new Error(`Scorecard lookup failed: ${res.status}`);
    const data = await res.json();
    const results = (data.results || [])
      .map(row => mapScorecardSchool(row, clean))
      .filter(school => school.name && school.tuition)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return b.studentSize - a.studentSize;
      });

    results.forEach(school => scorecardCache.set(school.name.toLowerCase(), school));
    scorecardSearchCache.set(cacheKey, results);
    return results.slice(0, limit);
  } catch (err) {
    console.warn('College Scorecard lookup unavailable; using local fallback.', err);
    scorecardSearchCache.set(cacheKey, []);
    return [];
  }
}

async function resolveScorecardSchool(raw) {
  const key = raw.trim().toLowerCase();
  if (scorecardCache.has(key)) return { ...scorecardCache.get(key) };

  const results = await searchScorecardSchools(raw, 10);
  const best = results[0];
  if (best && best.matchScore >= 180) return { ...best };
  return null;
}
