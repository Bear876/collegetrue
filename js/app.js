// ============================================
// CollegeTrue - App Controller + Scroll Reveal
// ============================================

let currentResults = null;

// ---- Scroll Reveal (Intersection Observer) ----

let revealObserver = null;

function initReveal() {
  if (revealObserver) revealObserver.disconnect();

  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.06,
    rootMargin: '0px 0px -32px 0px',
  });

  document.querySelectorAll('.reveal-up:not(.revealed), .reveal-scale:not(.revealed), .reveal-left:not(.revealed)').forEach(el => {
    revealObserver.observe(el);
  });
}

// Hero animations run immediately on load
function runHeroAnimation() {
  const heroEls = document.querySelectorAll('.reveal-hero');
  heroEls.forEach((el, i) => {
    setTimeout(() => el.classList.add('revealed'), i * 120 + 80);
  });
  const lateEls = document.querySelectorAll('.reveal-hero-late');
  lateEls.forEach((el, i) => {
    setTimeout(() => el.classList.add('revealed'), i * 120 + 280);
  });
}

// ---- Autocomplete ----

function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function localSchoolMatches(value, limit = 6) {
  const val = value.trim().toLowerCase();
  if (!val) return [];

  // Exact starts-with matches first
  const startsWith = SCHOOL_NAMES_LIST.filter(name =>
    name.toLowerCase().startsWith(val)
  );
  // Contains matches second
  const contains = SCHOOL_NAMES_LIST.filter(name =>
    !name.toLowerCase().startsWith(val) && name.toLowerCase().includes(val)
  );
  const combined = [...startsWith, ...contains].slice(0, limit);

  return combined.map(name => {
    const key = name.toLowerCase();
    const school = SCHOOLS[key] || Object.values(SCHOOLS).find(s =>
      (s.fullName || s.name || '').toLowerCase() === name.toLowerCase()
    );
    return {
      name,
      type: school ? school.type : '',
      city: school ? (school.city || school.state || '') : '',
      source: 'Local',
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
      <span class="ac-item-type">${[school.type, school.city].filter(Boolean).join(' · ')}</span>
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

    const localMatches = localSchoolMatches(val, 6);
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
    if (e.key === 'ArrowDown') {
      const first = ac.querySelector('.ac-item');
      if (first) { e.preventDefault(); first.focus(); }
    }
  });

  // Keyboard navigation within dropdown
  ac.addEventListener('keydown', e => {
    const items = [...ac.querySelectorAll('.ac-item')];
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && idx < items.length - 1) {
      e.preventDefault(); items[idx + 1].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) items[idx - 1].focus(); else input.focus();
    } else if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault();
      input.value = items[idx].dataset.value;
      ac.classList.remove('open');
      input.focus();
    }
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
  'Fetching financial data...',
];

let loadingInterval = null;

function startLoading() {
  let i = 0;
  const el = document.getElementById('loading-text');
  el.textContent = LOADING_MESSAGES[0];
  loadingInterval = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    el.textContent = LOADING_MESSAGES[i];
  }, 700);
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

  if (id === 'form')    document.getElementById('form-section').style.display = 'block';
  if (id === 'loading') document.getElementById('loading-section').style.display = 'block';
  if (id === 'results') document.getElementById('results-section').style.display = 'block';

  // Re-init reveal observer after section change
  setTimeout(() => initReveal(), 60);
}

// ---- Input validation ----

function looksLikeCollege(input) {
  const val = input.trim();
  if (!val || val.length < 2) return false;

  // Reject pure numbers or very short strings
  if (/^\d+$/.test(val)) return false;
  if (/^[\d\s\W]+$/.test(val)) return false; // only digits, spaces, symbols

  // Must have at least one real word (3+ letters)
  const words = val.split(/\s+/).filter(w => /[a-zA-Z]{3,}/.test(w));
  if (words.length === 0) return false;

  // Single-character or single-digit inputs
  if (val.length <= 2 && !/[a-zA-Z]{2}/.test(val)) return false;

  return true;
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

  const invalidInputs = [s1, s2, s3].filter(s => !looksLikeCollege(s));
  if (invalidInputs.length > 0) {
    showError(`"${invalidInputs[0]}" doesn't look like a college name. Please enter valid US college or university names.`);
    return;
  }
  if (!majorKey) {
    showError('Please select your intended major or field of study.');
    return;
  }

  const btn = document.getElementById('run-btn');
  btn.disabled = true;

  showSection('loading');
  startLoading();

  try {
    const results = await Promise.all([s1, s2, s3].map(s => calcSchool(s, majorKey, aidLevel)));
    currentResults = results;

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

  ['school1', 'school2', 'school3'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') runAnalysis();
    });
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runAnalysis();
  });

  // Kick off hero entrance + scroll reveal
  runHeroAnimation();
  setTimeout(() => initReveal(), 300);
});
