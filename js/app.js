// ============================================
// CollegeTrue - App Controller
// ============================================

let currentResults = null;

// ---- Autocomplete ----

function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function localSchoolMatches(value, limit = 4) {
  const val = value.trim().toLowerCase();
  return SCHOOL_NAMES_LIST.filter(name =>
    name.toLowerCase().includes(val)
  ).slice(0, limit).map(name => {
    const key = name.toLowerCase();
    const school = SCHOOLS[key] || Object.values(SCHOOLS).find(s => s.name === name);
    return {
      name,
      type: school ? school.type : '',
      city: school ? school.city || school.state : '',
      source: 'Local fallback',
    };
  });
}

function renderAutocompleteItems(input, ac, schools) {
  if (schools.length === 0) {
    ac.classList.remove('open');
    return;
  }

  ac.innerHTML = schools.map(school => `
    <div class="ac-item" data-value="${school.name}">
      <span>${school.name}</span>
      <span class="ac-item-type">${[school.type, school.city || school.state].filter(Boolean).join(' · ')}</span>
    </div>
  `).join('');

  ac.classList.add('open');

  ac.querySelectorAll('.ac-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      input.value = item.dataset.value;
      ac.classList.remove('open');
    });
  });
}

function setupAutocomplete(inputId, acId) {
  const input = document.getElementById(inputId);
  const ac = document.getElementById(acId);

  const updateMatches = debounce(async () => {
    const val = input.value.trim();
    if (val.length < 2) { ac.classList.remove('open'); return; }

    const localMatches = localSchoolMatches(val);
    renderAutocompleteItems(input, ac, localMatches);

    if (typeof searchScorecardSchools !== 'function') return;
    const liveMatches = await searchScorecardSchools(val, 8);
    if (input.value.trim() !== val) return;

    const merged = [...liveMatches, ...localMatches]
      .filter((school, index, all) =>
        all.findIndex(s => s.name.toLowerCase() === school.name.toLowerCase()) === index
      )
      .slice(0, 8);

    renderAutocompleteItems(input, ac, merged);
  }, 250);

  input.addEventListener('input', updateMatches);

  input.addEventListener('blur', () => {
    setTimeout(() => ac.classList.remove('open'), 150);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') ac.classList.remove('open');
  });
}

// ---- Loading messages ----

const LOADING_MESSAGES = [
  'Searching College Scorecard...',
  'Pulling tuition data...',
  'Calculating cost of living...',
  'Modeling loan repayments...',
  'Estimating starting salaries...',
  'Running the reality check...',
  'Crunching 10-year projections...',
];

let loadingInterval = null;

function startLoading() {
  let i = 0;
  const el = document.getElementById('loading-text');
  el.textContent = LOADING_MESSAGES[0];
  loadingInterval = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    el.textContent = LOADING_MESSAGES[i];
  }, 600);
}

function stopLoading() {
  clearInterval(loadingInterval);
  loadingInterval = null;
}

// ---- Error handling ----

function showError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.add('visible');
  el.style.display = 'block';
}

function clearError() {
  const el = document.getElementById('form-error');
  el.classList.remove('visible');
  el.style.display = 'none';
}

// ---- Sections ----

function showSection(id) {
  document.getElementById('form-section').style.display = 'none';
  document.getElementById('loading-section').style.display = 'none';
  document.getElementById('results-section').style.display = 'none';

  if (id === 'form') document.getElementById('form-section').style.display = 'block';
  if (id === 'loading') document.getElementById('loading-section').style.display = 'block';
  if (id === 'results') document.getElementById('results-section').style.display = 'block';
}

// ---- Main analysis ----

async function runAnalysis() {
  const s1 = document.getElementById('school1').value.trim();
  const s2 = document.getElementById('school2').value.trim();
  const s3 = document.getElementById('school3').value.trim();
  const majorKey = document.getElementById('major').value;
  const aidLevel = document.getElementById('aid').value;

  clearError();

  if (!s1 || !s2 || !s3) {
    showError('Please enter all three schools before running the analysis.');
    return;
  }
  if (!majorKey) {
    showError('Please select your intended major or field of study.');
    return;
  }

  // Disable button
  const btn = document.getElementById('run-btn');
  btn.disabled = true;

  // Show loading
  showSection('loading');
  startLoading();

  // Calculate
  try {
    const results = await Promise.all([s1, s2, s3].map(s => calcSchool(s, majorKey, aidLevel)));
    currentResults = results;

    // Render
    renderResultsTitle(results);
    renderScoreCards(results);
    renderSnapshot(results);
    renderBurdenBars(results);
    renderTimeline(results);
    renderVerdict(results);

    stopLoading();
    showSection('results');
    window.scrollTo({ top: document.getElementById('results-section').offsetTop - 20, behavior: 'smooth' });
  } catch (err) {
    console.error(err);
    stopLoading();
    showSection('form');
    showError('Something went wrong with the calculation. Please check your inputs and try again.');
  }

  btn.disabled = false;
}

// ---- Reset ----

function resetApp() {
  showSection('form');
  window.scrollTo({ top: document.getElementById('form-section').offsetTop - 20, behavior: 'smooth' });
}

function runNewSearch() {
  document.getElementById('school1').value = '';
  document.getElementById('school2').value = '';
  document.getElementById('school3').value = '';
  document.getElementById('major').value = '';
  document.getElementById('aid').value = 'mid';
  resetApp();
}

// ---- Share ----

function copyShareLink() {
  const url = window.location.href.split('?')[0];
  const text = `I just ran my CollegeTrue reality check - comparing my loan payments as a % of my first paycheck across 3 colleges. Everyone choosing a college should see this. ${url}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.share-btn.primary');
      const original = btn.innerHTML;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    });
  }
}

// ---- Scroll helper ----

function scrollToForm() {
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  setupAutocomplete('school1', 'ac1');
  setupAutocomplete('school2', 'ac2');
  setupAutocomplete('school3', 'ac3');

  // Enter key on last field triggers submit
  ['school1', 'school2', 'school3'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') runAnalysis();
    });
  });

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runAnalysis();
  });
});
