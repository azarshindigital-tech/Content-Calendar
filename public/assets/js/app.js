/* app.js — application state + orchestration (vanilla, no framework). */
import * as C from './calendar.js';
import { loadDataset } from './data.js';
import { icons } from './icons.js';
import * as Cal from './ui-calendar.js';
import * as Asst from './ui-assistant.js';
import { requestSuggestions, ApiError } from './api.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  dataset: null,
  tz: 'Asia/Tehran',
  section: 'calendar',
  view: 'month',
  calendarType: 'shamsi',
  todayJdn: 0,
  refJdn: 0,
  selectedJdn: 0,
  refYear: 1405,
  hiddenCategories: new Set(),
  search: '',
  assistantRefJdn: 0,
  lastResult: null,
  isGenerating: false,
  abortController: null
};

// ===========================================================================
// Boot
// ===========================================================================
async function init() {
  state.todayJdn = C.todayJdn(state.tz);
  state.refJdn = state.todayJdn;
  state.selectedJdn = state.todayJdn;
  state.assistantRefJdn = state.todayJdn;
  state.refYear = C.jdnToJalaaliParts(state.todayJdn).jy;

  try {
    state.dataset = await loadDataset('data/events.json');
  } catch (err) {
    showFatal(err);
    return;
  }

  // Clamp to data coverage if "today" is outside the dataset.
  const cov = state.dataset.coverage;
  if (state.todayJdn < cov.minJdn || state.todayJdn > cov.maxJdn) {
    const clamped = Math.min(Math.max(state.todayJdn, cov.minJdn), cov.maxJdn);
    state.refJdn = clamped;
    state.selectedJdn = clamped;
    state.assistantRefJdn = clamped;
    state.outsideCoverage = true;
    state.refYear = C.jdnToJalaaliParts(clamped).jy;
  }

  wireTopnav();
  wireCalendarControls();
  buildAssistantForm();
  wireAssistant();
  renderDataNotice();
  renderCalendar();
  renderAssistantPreview();
  renderResults(idleState());
  setSection('calendar');
}

// ===========================================================================
// Section switching
// ===========================================================================
function wireTopnav() {
  $$('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => setSection(btn.dataset.section));
  });
}
function setSection(name) {
  state.section = name;
  $$('[data-section]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.section === name)));
  $('#section-calendar').classList.toggle('is-active', name === 'calendar');
  $('#section-assistant').classList.toggle('is-active', name === 'assistant');
}

// ===========================================================================
// Calendar
// ===========================================================================
function wireCalendarControls() {
  $('#nav-prev').addEventListener('click', () => navigate(-1));
  $('#nav-next').addEventListener('click', () => navigate(1));
  $('#nav-today').addEventListener('click', goToday);

  $$('#seg-view .segmented__btn').forEach((b) =>
    b.addEventListener('click', () => setView(b.dataset.view)));
  $$('#seg-cal .segmented__btn').forEach((b) =>
    b.addEventListener('click', () => setCalType(b.dataset.caltype)));

  // Delegated clicks inside the calendar body.
  $('#cal-body').addEventListener('click', (e) => {
    const el = e.target.closest('[data-jdn]');
    if (!el) return;
    selectDay(parseInt(el.dataset.jdn, 10), { fromMonthOut: el.dataset.out === '1' });
  });
  $('#cal-body').addEventListener('keydown', (e) => {
    const el = e.target.closest('[data-jdn]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectDay(parseInt(el.dataset.jdn, 10)); }
  });

  // Legend filters.
  $('#legend').addEventListener('click', (e) => {
    const el = e.target.closest('[data-cat]');
    if (!el) return;
    const id = el.dataset.cat;
    if (state.hiddenCategories.has(id)) state.hiddenCategories.delete(id);
    else state.hiddenCategories.add(id);
    renderCalendar();
  });

  // Search (debounced).
  let t;
  $('#search').addEventListener('input', (e) => {
    state.search = e.target.value;
    clearTimeout(t);
    t = setTimeout(() => { $('#rangelist-body').innerHTML = Cal.renderRangeList(state, state.dataset); }, 140);
  });
}

function setView(view) {
  if (state.view === view) return;
  state.view = view;
  syncSegmented();
  renderCalendar();
}
function setCalType(type) {
  if (state.calendarType === type) return;
  state.calendarType = type;           // same real day, different presentation
  syncSegmented();
  renderCalendar();
}
function syncSegmented() {
  $$('#seg-view .segmented__btn').forEach((b) => b.classList.toggle('is-active', b.dataset.view === state.view));
  $$('#seg-cal .segmented__btn').forEach((b) => b.classList.toggle('is-active', b.dataset.caltype === state.calendarType));
}

function addMonths(jdn, delta) {
  if (state.calendarType === 'shamsi') {
    const { jy, jm } = C.jdnToJalaaliParts(jdn);
    const idx = jy * 12 + (jm - 1) + delta;
    return C.jalaaliToJdn(Math.floor(idx / 12), (idx % 12) + 1, 1);
  }
  const { gy, gm } = C.jdnToGregorianParts(jdn);
  const idx = gy * 12 + (gm - 1) + delta;
  return C.gregorianToJdn(Math.floor(idx / 12), (idx % 12) + 1, 1);
}

function navigate(delta) {
  if (state.view === 'month') state.refJdn = addMonths(state.refJdn, delta);
  else if (state.view === 'week') state.refJdn = state.refJdn + delta * 7;
  else { state.selectedJdn += delta; state.refJdn = state.selectedJdn; }
  renderCalendar();
}
function goToday() {
  state.refJdn = state.todayJdn;
  state.selectedJdn = state.todayJdn;
  renderCalendar();
}
function selectDay(jdn, { fromMonthOut = false } = {}) {
  state.selectedJdn = jdn;
  // In month view, clicking an out-of-month day moves the frame to that month.
  if (state.view === 'month' && fromMonthOut) state.refJdn = jdn;
  else if (state.view !== 'month') state.refJdn = jdn;
  renderCalendar();
}

function renderCalendar() {
  $('#cal-title').innerHTML = Cal.renderTitle(state);
  $('#legend').innerHTML = Cal.renderLegend(state);
  $('#cal-body').innerHTML = Cal.renderCalBody(state, state.dataset);
  $('#detail').innerHTML = Cal.renderDetail(state, state.dataset);
  $('#rangelist-body').innerHTML = Cal.renderRangeList(state, state.dataset);
}

function renderDataNotice() {
  const cov = state.dataset.coverage;
  const rep = state.dataset.report;
  const minG = C.formatGregorian(cov.minJdn, { long: true, fa: true });
  const maxG = C.formatGregorian(cov.maxJdn, { long: true, fa: true });
  let html = `<div class="notice notice--info">${icons.info}
    <div>داده‌ها مربوط به سال <b>${C.toPersianDigits(state.refYear)}</b> و شامل
    <b>${C.toPersianDigits(rep.parsed)}</b> مناسبت است (از ${esc(minG)} تا ${esc(maxG)}).
    نبودِ مناسبت در یک روز به‌معنای نبود آن در دنیای واقعی نیست؛ تنها در این داده ثبت نشده است.</div></div>`;

  const flags = [];
  if (rep.invalidFormat.length || rep.invalidDate.length)
    flags.push(`${C.toPersianDigits(rep.invalidFormat.length + rep.invalidDate.length)} رکورد با تاریخ نامعتبر کنار گذاشته شد`);
  if (rep.shamsiGregorianMismatch.length)
    flags.push(`${C.toPersianDigits(rep.shamsiGregorianMismatch.length)} رکورد با مغایرت تاریخ شمسی/میلادی (علامت‌گذاری‌شده، بدون تغییر)`);
  if (flags.length) {
    html += `<div class="notice notice--warn">${icons.warn}<div>${esc(flags.join(' • '))}.</div></div>`;
  }
  if (state.outsideCoverage) {
    html += `<div class="notice notice--warn">${icons.warn}<div>تاریخ امروز خارج از محدودهٔ دادهٔ ۱۴۰۵ است؛ نمای تقویم روی نزدیک‌ترین تاریخ درون محدوده تنظیم شد.</div></div>`;
  }
  $('#data-notice').innerHTML = html;
}

// ===========================================================================
// Assistant — form
// ===========================================================================
function buildAssistantForm() {
  $('#goals').innerHTML = Asst.renderChips(Asst.GOALS, 'goal');
  $('#channels').innerHTML = Asst.renderChips(Asst.CHANNELS, 'channel');
  $('#f-tone').innerHTML = Asst.renderToneOptions();

  // Reference-date selects (year fixed to the data year).
  const monthSel = $('#ref-month');
  monthSel.innerHTML = C.PERSIAN_MONTHS.map((m, i) =>
    `<option value="${i + 1}">${esc(m)}</option>`).join('');
  fillDaysForMonth();
  const { jm, jd } = C.jdnToJalaaliParts(state.assistantRefJdn);
  monthSel.value = String(jm);
  fillDaysForMonth();
  $('#ref-day').value = String(jd);
}

function fillDaysForMonth() {
  const jm = parseInt($('#ref-month').value || '1', 10);
  const len = C.jalaaliMonthLength(state.refYear, jm);
  const prev = $('#ref-day').value;
  $('#ref-day').innerHTML = Array.from({ length: len }, (_, i) =>
    `<option value="${i + 1}">${C.toPersianDigits(i + 1)}</option>`).join('');
  if (prev && +prev <= len) $('#ref-day').value = prev;
}

function syncAssistantRefFromSelects() {
  const jm = parseInt($('#ref-month').value, 10);
  const jd = parseInt($('#ref-day').value, 10);
  state.assistantRefJdn = C.jalaaliToJdn(state.refYear, jm, jd);
  renderAssistantPreview();
}

function renderAssistantPreview() {
  const isToday = state.assistantRefJdn === state.todayJdn;
  $('#window-preview').innerHTML = Asst.renderWindowPreview(state.assistantRefJdn, state.dataset, { isToday });
}

function wireAssistant() {
  $('#ref-month').addEventListener('change', () => { fillDaysForMonth(); syncAssistantRefFromSelects(); });
  $('#ref-day').addEventListener('change', syncAssistantRefFromSelects);
  $('#ref-today').addEventListener('click', () => {
    state.assistantRefJdn = state.todayJdn;
    const { jm, jd } = C.jdnToJalaaliParts(state.todayJdn);
    $('#ref-month').value = String(jm); fillDaysForMonth(); $('#ref-day').value = String(jd);
    renderAssistantPreview();
  });

  // Advanced section toggle.
  const adv = $('#advanced');
  $('#adv-toggle').addEventListener('click', () => adv.classList.toggle('is-open'));

  // Chip visual state.
  $('#asst-form').addEventListener('change', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) chip.classList.toggle('is-on', e.target.checked);
    clearFieldError(e.target.closest('.field'));
  });

  $('#asst-form').addEventListener('submit', onGenerate);

  // Results delegation (toggle details, copy).
  $('#results').addEventListener('click', onResultsClick);
}

function readForm() {
  const val = (id) => ($(id).value || '').trim();
  const checked = (name) => $$(`input[name="${name}"]:checked`).map((i) => ({ id: i.value, label: i.dataset.label }));
  const goals = checked('goal');
  const channels = checked('channel');
  const toneOpt = $('#f-tone').selectedOptions[0];
  return {
    field: val('#f-field'),
    product: val('#f-product'),
    audience: val('#f-audience'),
    goals,
    channels,
    tone: toneOpt ? toneOpt.dataset.label : '',
    constraints: val('#f-constraints')
  };
}

function validateForm(data) {
  const errors = {};
  if (data.field.length < 6) errors['#field-field'] = 'لطفاً حوزهٔ فعالیت را کمی کامل‌تر توضیح دهید.';
  if (data.product.length < 3) errors['#field-product'] = 'محصول یا خدمت اصلی را وارد کنید.';
  if (data.audience.length < 3) errors['#field-audience'] = 'مخاطب هدف را وارد کنید.';
  if (!data.goals.length) errors['#field-goals'] = 'حداقل یک هدف محتوا انتخاب کنید.';
  if (!data.channels.length) errors['#field-channels'] = 'حداقل یک کانال انتشار انتخاب کنید.';
  return errors;
}

function showFieldErrors(errors) {
  $$('.field.has-error').forEach((f) => f.classList.remove('has-error'));
  Object.entries(errors).forEach(([sel, msg]) => {
    const field = $(sel);
    if (!field) return;
    field.classList.add('has-error');
    const err = field.querySelector('.field__err');
    if (err) err.textContent = msg;
  });
  const first = Object.keys(errors)[0];
  if (first) $(first).scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function clearFieldError(field) {
  if (field) field.classList.remove('has-error');
}

async function onGenerate(e) {
  e.preventDefault();
  if (state.isGenerating) return;

  const data = readForm();
  const errors = validateForm(data);
  if (Object.keys(errors).length) { showFieldErrors(errors); return; }
  $$('.field.has-error').forEach((f) => f.classList.remove('has-error'));

  const { jy, jm, jd } = C.jdnToJalaaliParts(state.assistantRefJdn);
  const payload = {
    business: {
      field: data.field,
      product: data.product,
      audience: data.audience,
      goals: data.goals.map((g) => g.label),
      channels: data.channels.map((c) => c.label),
      tone: data.tone,
      constraints: data.constraints
    },
    referenceDate: { jy, jm, jd }
  };
  await generate(payload);
}

async function generate(payload, { regenerate = false } = {}) {
  state.isGenerating = true;
  setGenerating(true);
  renderResults(loadingState());
  setSection('assistant');

  if (state.abortController) state.abortController.abort();
  state.abortController = new AbortController();

  if (regenerate) payload = { ...payload, nonce: Date.now() };

  try {
    const result = await requestSuggestions(payload, { signal: state.abortController.signal });
    state.lastResult = result;
    state.lastPayload = payload;
    renderResultsSuccess(result);
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    renderResults(errorState(err));
  } finally {
    state.isGenerating = false;
    setGenerating(false);
  }
}

function setGenerating(on) {
  const btn = $('#btn-generate');
  btn.disabled = on;
  btn.innerHTML = on
    ? `<span class="spinner"></span> در حال تولید پیشنهاد…`
    : `${icons.sparkles} تولید پیشنهاد محتوا`;
}

// ===========================================================================
// Results rendering
// ===========================================================================
function renderResults(html) { $('#results').innerHTML = html; }

function renderResultsSuccess(result) {
  const head = `<div class="results__head">
    <h2>${icons.sparkles} پیشنهادهای محتوا</h2>
    <span class="results__meta">مبنا: ${esc(C.toPersianDigits(result.window.startShamsi))} • مدل: ${esc(result.model || '')}</span>
    <span style="flex:1"></span>
    <button type="button" class="btn btn--sm" id="btn-regen">${icons.refresh} تولید دوباره</button>
  </div>`;
  renderResults(head + Asst.renderSuggestions(result));
  const regen = $('#btn-regen');
  if (regen) regen.addEventListener('click', () => {
    if (state.lastPayload) generate(state.lastPayload, { regenerate: true });
  });
}

function idleState() {
  return `<div class="results"><div class="state state--idle">
    <div class="state__icon">${icons.sparkles}</div>
    <h3>دستیار آمادهٔ کمک است</h3>
    <p>اطلاعات کسب‌وکارتان را در فرم سمت راست کامل کنید و دکمهٔ «تولید پیشنهاد محتوا» را بزنید. دستیار مناسبت‌های واقعی هفت روز آینده را بررسی می‌کند و برای موارد مرتبط، ایدهٔ محتوایی اجرایی می‌سازد.</p>
  </div></div>`;
}
function loadingState() {
  const sk = () => `<div class="skeleton"><div class="sk-line w-40"></div><div class="sk-line w-80"></div><div class="sk-line w-60"></div><div class="sk-line w-30"></div></div>`;
  return `<div class="results__head"><h2>${icons.sparkles} در حال تحلیل مناسبت‌ها…</h2>
    <span class="results__meta">استخراج مناسبت‌های واقعی و ساخت پیشنهاد</span></div>${sk()}${sk()}${sk()}`;
}
function errorState(err) {
  const code = err instanceof ApiError ? err.code : 'UNKNOWN';
  const msg = (err && err.message) || 'خطای نامشخص';
  return `<div class="results"><div class="state state--error">
    <div class="state__icon">${icons.alert}</div>
    <h3>تولید پیشنهاد ناموفق بود</h3>
    <p>${esc(msg)}</p>
    <div class="state__actions">
      <button type="button" class="btn btn--primary" id="btn-retry">${icons.refresh} تلاش دوباره</button>
    </div>
    <p style="margin-top:14px;color:var(--text-3);font-size:0.75rem">کد خطا: ${esc(code)}</p>
  </div></div>`;
}

function onResultsClick(e) {
  const retry = e.target.closest('#btn-retry');
  if (retry && state.lastPayload) { generate(state.lastPayload); return; }

  const toggle = e.target.closest('[data-toggle]');
  if (toggle) {
    toggle.closest('.sugg').classList.toggle('is-open');
    return;
  }
  const copySample = e.target.closest('[data-copy-sample]');
  if (copySample) {
    const body = copySample.parentElement.querySelector('.sample-text__body');
    copyText(body ? body.textContent : '');
    return;
  }
  const copyAll = e.target.closest('[data-copy-all]');
  if (copyAll) {
    const card = copyAll.closest('.sugg');
    const kind = card.dataset.kind;
    const idx = parseInt(card.dataset.index, 10);
    const arr = kind === 'event' ? state.lastResult.eventSuggestions : state.lastResult.independentIdeas;
    const sugg = arr && arr[idx];
    if (sugg) copyText(Asst.composeText(sugg, kind));
  }
}

// ===========================================================================
// Utilities
// ===========================================================================
function esc(s) { return Cal.esc(s); }

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    toast('متن کپی شد', 'success');
  } catch {
    toast('کپی انجام نشد؛ متن را دستی انتخاب کنید.', 'error');
  }
}

let toastTimer;
function toast(message, type = '') {
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast--' + type : '');
  el.innerHTML = `${type === 'success' ? icons.check : type === 'error' ? icons.alert : icons.info}<span>${esc(message)}</span>`;
  wrap.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 2600);
}

function showFatal(err) {
  document.body.innerHTML = `<div style="max-width:560px;margin:80px auto;padding:32px;font-family:var(--font-sans);text-align:center">
    <h2 style="margin-bottom:12px">خطا در بارگذاری داده‌ها</h2>
    <p style="color:#555;line-height:1.8">${esc((err && err.message) || 'فایل مناسبت‌ها بارگذاری نشد.')}</p>
  </div>`;
}

document.addEventListener('DOMContentLoaded', init);
