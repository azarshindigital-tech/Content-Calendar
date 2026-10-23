/* ui-calendar.js — pure render helpers for the calendar section. */
import * as C from './calendar.js';
import { CATEGORIES } from './categorize.js';
import { eventsForJdn } from './data.js';

const MAX_CELL_EVENTS = 3;

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

function visibleEvents(state, evs) {
  if (!state.hiddenCategories || state.hiddenCategories.size === 0) return evs;
  return evs.filter((e) => !state.hiddenCategories.has(e.category.id));
}

/** Days currently framed by the view (month = whole month, week = 7, day = 1). */
export function getVisibleRange(state) {
  const { view, calendarType, refJdn, selectedJdn } = state;
  if (view === 'day') return { startJdn: selectedJdn, days: [selectedJdn] };
  if (view === 'week') {
    const wk = C.weekOf(refJdn);
    return { startJdn: wk[0].jdn, days: wk.map((d) => d.jdn) };
  }
  if (calendarType === 'shamsi') {
    const { jy, jm } = C.jdnToJalaaliParts(refJdn);
    const start = C.jalaaliToJdn(jy, jm, 1);
    return { startJdn: start, days: C.rangeJdns(start, C.jalaaliMonthLength(jy, jm)) };
  }
  const { gy, gm } = C.jdnToGregorianParts(refJdn);
  const start = C.gregorianToJdn(gy, gm, 1);
  return { startJdn: start, days: C.rangeJdns(start, C.gregorianMonthLength(gy, gm)) };
}

// ---- Title ----------------------------------------------------------------
export function renderTitle(state) {
  const { view, calendarType, refJdn, selectedJdn } = state;
  if (view === 'day') {
    const main = C.formatShamsi(selectedJdn, { long: true, withWeekday: true });
    const sub = C.formatGregorian(selectedJdn, { long: true, fa: true });
    return `${esc(calendarType === 'shamsi' ? main : C.formatGregorian(selectedJdn, { long: true, fa: true }))}<small>${esc(calendarType === 'shamsi' ? sub : main)}</small>`;
  }
  if (view === 'week') {
    const wk = C.weekOf(refJdn);
    const a = wk[0].jdn, b = wk[6].jdn;
    const main = calendarType === 'shamsi'
      ? `${C.formatShamsi(a, { long: true })} تا ${C.formatShamsi(b, { long: true })}`
      : `${C.formatGregorian(a, { long: true, fa: true })} تا ${C.formatGregorian(b, { long: true, fa: true })}`;
    return `${esc(main)}<small>نمای هفته</small>`;
  }
  if (calendarType === 'shamsi') {
    const { jy, jm } = C.jdnToJalaaliParts(refJdn);
    return `${esc(C.PERSIAN_MONTHS[jm - 1])} ${esc(C.toPersianDigits(jy))}<small>تقویم شمسی</small>`;
  }
  const { gy, gm } = C.jdnToGregorianParts(refJdn);
  return `${esc(C.GREGORIAN_MONTHS_FA[gm - 1])} ${esc(C.toPersianDigits(gy))}<small>تقویم میلادی</small>`;
}

// ---- Legend ---------------------------------------------------------------
export function renderLegend(state) {
  return Object.values(CATEGORIES).map((c) => {
    const on = !(state.hiddenCategories && state.hiddenCategories.has(c.id));
    return `<button type="button" class="legend__item${on ? '' : ' is-off'}" data-cat="${c.id}" aria-pressed="${on}">
      <span class="legend__swatch" style="background:${c.color}"></span>${esc(c.label)}</button>`;
  }).join('');
}

// ---- Cells / grids --------------------------------------------------------
function cellSecondary(calendarType, jdn) {
  if (calendarType === 'shamsi') {
    const g = C.jdnToGregorianParts(jdn);
    return `${g.gm}/${g.gd}`;
  }
  const j = C.jdnToJalaaliParts(jdn);
  return C.toPersianDigits(`${j.jm}/${j.jd}`);
}

function renderCell(state, dataset, cell) {
  const num = state.calendarType === 'shamsi' ? cell.jd : cell.gd;
  const evs = visibleEvents(state, eventsForJdn(dataset, cell.jdn));

  // Out-of-month days: dimmed, minimal (number + small dots), still clickable to navigate.
  if (!cell.inMonth) {
    const dots = evs.slice(0, 4).map((e) =>
      `<span class="dot" style="background:${e.category.color}"></span>`).join('');
    return `<button type="button" class="cell is-out" data-jdn="${cell.jdn}" data-out="1" tabindex="-1">
      <div class="cell__top"><span class="cell__num">${C.toPersianDigits(num)}</span></div>
      <div class="cell__dots">${dots}</div>
    </button>`;
  }

  const cls = ['cell'];
  if (cell.jdn === state.todayJdn) cls.push('is-today');
  if (cell.jdn === state.selectedJdn) cls.push('is-selected');

  const topRight = evs.length
    ? `<span class="cell__count">${C.toPersianDigits(evs.length)}</span>`
    : `<span class="cell__greg">${esc(cellSecondary(state.calendarType, cell.jdn))}</span>`;

  const list = evs.slice(0, MAX_CELL_EVENTS).map((e) =>
    `<div class="cell__event"><span class="dot" style="background:${e.category.color}"></span>${esc(e.name)}</div>`
  ).join('');
  const more = evs.length > MAX_CELL_EVENTS
    ? `<div class="cell__more">و ${C.toPersianDigits(evs.length - MAX_CELL_EVENTS)} مورد دیگر</div>` : '';
  const dots = evs.slice(0, 6).map((e) =>
    `<span class="dot" style="background:${e.category.color}"></span>`).join('');

  return `<button type="button" class="${cls.join(' ')}" data-jdn="${cell.jdn}" data-out="0">
    <div class="cell__top"><span class="cell__num">${C.toPersianDigits(num)}</span>${topRight}</div>
    <div class="cell__events">${list}${more}</div>
    <div class="cell__dots">${dots}</div>
  </button>`;
}

export function renderMonth(state, dataset) {
  let weeks;
  if (state.calendarType === 'shamsi') {
    const { jy, jm } = C.jdnToJalaaliParts(state.refJdn);
    weeks = C.jalaaliMonthGrid(jy, jm);
  } else {
    const { gy, gm } = C.jdnToGregorianParts(state.refJdn);
    weeks = C.gregorianMonthGrid(gy, gm);
  }
  const head = C.WEEKDAYS.map((d) => `<div class="grid__dow">${esc(d)}</div>`).join('');
  const body = weeks.map((w) => w.map((cell) => renderCell(state, dataset, cell)).join('')).join('');
  return `<div class="grid__head">${head}</div><div class="grid">${body}</div>`;
}

export function renderWeek(state, dataset) {
  const wk = C.weekOf(state.refJdn);
  const cols = wk.map((d) => {
    const evs = visibleEvents(state, eventsForJdn(dataset, d.jdn));
    const isToday = d.jdn === state.todayJdn;
    const isSel = d.jdn === state.selectedJdn;
    const dow = C.WEEKDAYS[C.weekdayIndex(d.jdn)];
    const num = state.calendarType === 'shamsi'
      ? C.toPersianDigits(d.jd)
      : C.toPersianDigits(C.jdnToGregorianParts(d.jdn).gd);
    const alt = state.calendarType === 'shamsi'
      ? C.formatGregorian(d.jdn, { long: false })
      : C.formatShamsi(d.jdn);
    const body = evs.length
      ? evs.map((e) => `<div class="wevent" data-jdn="${d.jdn}"><span class="dot" style="background:${e.category.color}"></span><span>${esc(e.name)}</span></div>`).join('')
      : `<div class="cell__more" style="padding:10px 8px">—</div>`;
    return `<div class="weekcol ${isToday ? 'is-today' : ''} ${isSel ? 'is-selected' : ''}">
      <div class="weekcol__head" data-jdn="${d.jdn}" role="button" tabindex="0">
        <div class="weekcol__dow">${esc(dow)}</div>
        <div class="weekcol__num">${num}</div>
        <div class="weekcol__greg">${esc(alt)}</div>
      </div>
      <div class="weekcol__body">${body}</div>
    </div>`;
  }).join('');
  return `<div class="week">${cols}</div>`;
}

function renderEventItem(e) {
  return `<div class="ev">
    <span class="ev__bar" style="background:${e.category.color}"></span>
    <div class="ev__body">
      <div class="ev__name">${esc(e.name)}</div>
      <div class="ev__meta">
        <span class="ev__cat" style="color:${e.category.color}">${esc(e.category.label)}</span>
        <span class="badge badge--soft">${esc(C.formatShamsi(e.jdn))}</span>
        <span class="badge badge--soft">${esc(C.formatGregorian(e.jdn, { long: false }))}</span>
      </div>
    </div>
  </div>`;
}

export function renderDay(state, dataset) {
  const j = state.selectedJdn;
  const evs = visibleEvents(state, eventsForJdn(dataset, j));
  const p = C.jdnToJalaaliParts(j);
  const head = `<div class="dayview__head">
    <div>
      <div class="dayview__big">${esc(C.weekdayName(j))}</div>
      <div class="dayview__sub">${esc(C.toPersianDigits(p.jd))} ${esc(C.PERSIAN_MONTHS[p.jm - 1])} ${esc(C.toPersianDigits(p.jy))} • ${esc(C.formatGregorian(j, { long: true, fa: true }))}</div>
    </div>
    <span class="badge badge--brand">${evs.length ? C.toPersianDigits(evs.length) + ' مناسبت' : 'بدون مناسبت'}</span>
  </div>`;
  const list = evs.length
    ? `<div class="detail__list">${evs.map(renderEventItem).join('')}</div>`
    : emptyDay();
  return `<div class="dayview">${head}${list}</div>`;
}

function emptyDay() {
  return `<div class="state state--empty"><div class="state__icon">${iconInbox()}</div>
    <h3>مناسبتی ثبت نشده است</h3>
    <p>برای این روز در داده‌های سال ۱۴۰۵ مناسبتی موجود نیست. این به معنای نبود مناسبت در دنیای واقعی نیست؛ تنها داده‌ای در فایل ثبت نشده است.</p></div>`;
}
function iconInbox() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>';
}

export function renderCalBody(state, dataset) {
  if (state.view === 'month') return renderMonth(state, dataset);
  if (state.view === 'week') return renderWeek(state, dataset);
  return renderDay(state, dataset);
}

// ---- Detail side panel ----------------------------------------------------
export function renderDetail(state, dataset) {
  const j = state.selectedJdn;
  const evs = visibleEvents(state, eventsForJdn(dataset, j));
  const p = C.jdnToJalaaliParts(j);
  const header = `<div class="detail__date">${esc(C.weekdayName(j))}، ${esc(C.toPersianDigits(p.jd))} ${esc(C.PERSIAN_MONTHS[p.jm - 1])} ${esc(C.toPersianDigits(p.jy))}
    <small>${esc(C.formatGregorian(j, { long: true, fa: true }))} • ${esc(C.formatShamsi(j))}</small></div>`;
  const body = evs.length
    ? `<div class="detail__list">${evs.map(renderEventItem).join('')}</div>`
    : `<div class="detail__list"><div class="state state--empty" style="padding:28px 8px"><div class="state__icon">${iconInbox()}</div><h3 style="font-size:1rem">بدون مناسبت</h3><p>برای این روز مناسبتی در داده‌ها نیست.</p></div></div>`;
  return header + body;
}

// ---- Range list (grouped by day, searchable) ------------------------------
export function renderRangeList(state, dataset) {
  const { days } = getVisibleRange(state);
  const q = (state.search || '').trim();
  let groups = '';
  let totalShown = 0;

  for (const jdn of days) {
    let evs = visibleEvents(state, eventsForJdn(dataset, jdn));
    if (q) evs = evs.filter((e) => e.name.includes(q) || e.category.label.includes(q));
    if (!evs.length) continue;
    totalShown += evs.length;
    const p = C.jdnToJalaaliParts(jdn);
    groups += `<div class="daygroup">
      <div class="daygroup__head">
        <span>${esc(C.weekdayName(jdn))}، ${esc(C.toPersianDigits(p.jd))} ${esc(C.PERSIAN_MONTHS[p.jm - 1])}</span>
        <span class="line"></span><span class="cnt">${C.toPersianDigits(evs.length)}</span>
      </div>
      <div class="detail__list">${evs.map(renderEventItem).join('')}</div>
    </div>`;
  }

  if (!totalShown) {
    return `<div class="state state--empty" style="padding:36px 8px">
      <div class="state__icon">${iconInbox()}</div>
      <h3 style="font-size:1rem">موردی یافت نشد</h3>
      <p>${q ? 'با عبارت جست‌وجوی واردشده مناسبتی در این بازه پیدا نشد.' : 'در این بازه و با فیلترهای فعلی مناسبتی برای نمایش نیست.'}</p>
    </div>`;
  }
  return groups;
}
