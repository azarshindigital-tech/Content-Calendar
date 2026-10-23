/*
 * calendar.js — the single source of truth for date math in the UI.
 *
 * A "day" is represented internally by its Julian Day Number (JDN), an integer.
 * Shamsi (Jalali) and Gregorian are simply two *views* of the same JDN, so
 * switching the displayed calendar can never move the user to a different real
 * day. All conversions go through the vendored jalaali-js algorithm.
 */
import {
  toJalaali, toGregorian, jalaaliMonthLength, isLeapJalaaliYear,
  isValidJalaaliDate, jalaaliToJDN, gregorianToJDN, jdnToJalaali, jdnToGregorian
} from './vendor/jalaali.js';

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const GREGORIAN_MONTHS_FA = [
  'ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن',
  'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'
];

// Week starts on Saturday (شنبه) in the Iranian calendar.
export const WEEKDAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input) {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

export function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

// ---- Canonical conversions --------------------------------------------------

export { jalaaliMonthLength, isLeapJalaaliYear, isValidJalaaliDate };

export function jalaaliToJdn(jy, jm, jd) {
  return jalaaliToJDN(jy, jm, jd);
}

export function gregorianToJdn(gy, gm, gd) {
  return gregorianToJDN(gy, gm, gd);
}

export function jdnToJalaaliParts(jdn) {
  return jdnToJalaali(jdn); // { jy, jm, jd }
}

export function jdnToGregorianParts(jdn) {
  return jdnToGregorian(jdn); // { gy, gm, gd }
}

export function jalaaliFromGregorian(gy, gm, gd) {
  return toJalaali(gy, gm, gd);
}

export function gregorianFromJalaali(jy, jm, jd) {
  return toGregorian(jy, jm, jd);
}

// ---- "Today" in a specific timezone ----------------------------------------

/** Gregorian Y/M/D for "now" in the given IANA timezone (default Asia/Tehran). */
export function gregorianTodayInTZ(timeZone = 'Asia/Tehran', now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric'
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parseInt(parts.find((p) => p.type === t).value, 10);
  return { gy: get('year'), gm: get('month'), gd: get('day') };
}

export function todayJdn(timeZone = 'Asia/Tehran', now = new Date()) {
  const { gy, gm, gd } = gregorianTodayInTZ(timeZone, now);
  return gregorianToJDN(gy, gm, gd);
}

// ---- Weekday ----------------------------------------------------------------

/** 0 = شنبه (Saturday) … 6 = جمعه (Friday). */
export function weekdayIndex(jdn) {
  const { gy, gm, gd } = jdnToGregorian(jdn);
  const dow = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay(); // 0=Sun..6=Sat
  return (dow + 1) % 7;
}

export function weekdayName(jdn) {
  return WEEKDAYS[weekdayIndex(jdn)];
}

// ---- Arithmetic -------------------------------------------------------------

export function addDays(jdn, n) {
  return jdn + n;
}

/** `count` consecutive JDNs starting at `startJdn` (inclusive). */
export function rangeJdns(startJdn, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(startJdn + i);
  return out;
}

// ---- Views (month grid / week) ---------------------------------------------

/**
 * Build a month grid (array of week-rows, each 7 cells) for a Jalali month.
 * Every cell: { jdn, jy, jm, jd, inMonth }.
 */
export function jalaaliMonthGrid(jy, jm) {
  const firstJdn = jalaaliToJDN(jy, jm, 1);
  const offset = weekdayIndex(firstJdn); // how many leading days from previous month
  const monthLen = jalaaliMonthLength(jy, jm);
  const totalCells = Math.ceil((offset + monthLen) / 7) * 7;
  const gridStart = firstJdn - offset;

  const weeks = [];
  for (let c = 0; c < totalCells; c++) {
    if (c % 7 === 0) weeks.push([]);
    const jdn = gridStart + c;
    const p = jdnToJalaali(jdn);
    weeks[weeks.length - 1].push({
      jdn, jy: p.jy, jm: p.jm, jd: p.jd,
      inMonth: p.jy === jy && p.jm === jm
    });
  }
  return weeks;
}

export function gregorianMonthLength(gy, gm) {
  // Day 0 of the next month == last day of this month.
  return new Date(Date.UTC(gy, gm, 0)).getUTCDate();
}

/** Gregorian month grid, Saturday-first to match Iranian week layout. */
export function gregorianMonthGrid(gy, gm) {
  const firstJdn = gregorianToJDN(gy, gm, 1);
  const offset = weekdayIndex(firstJdn);
  const monthLen = gregorianMonthLength(gy, gm);
  const totalCells = Math.ceil((offset + monthLen) / 7) * 7;
  const gridStart = firstJdn - offset;

  const weeks = [];
  for (let c = 0; c < totalCells; c++) {
    if (c % 7 === 0) weeks.push([]);
    const jdn = gridStart + c;
    const p = jdnToGregorian(jdn);
    weeks[weeks.length - 1].push({
      jdn, gy: p.gy, gm: p.gm, gd: p.gd,
      inMonth: p.gy === gy && p.gm === gm
    });
  }
  return weeks;
}

/** The 7 days (Sat→Fri) of the week that contains `jdn`. */
export function weekOf(jdn) {
  const offset = weekdayIndex(jdn);
  const start = jdn - offset;
  return rangeJdns(start, 7).map((d) => {
    const p = jdnToJalaali(d);
    return { jdn: d, jy: p.jy, jm: p.jm, jd: p.jd };
  });
}

// ---- Formatting -------------------------------------------------------------

export function formatShamsi(jdn, { withWeekday = false, long = false, fa = true } = {}) {
  const { jy, jm, jd } = jdnToJalaali(jdn);
  let s;
  if (long) {
    s = `${jd} ${PERSIAN_MONTHS[jm - 1]} ${jy}`;
  } else {
    s = `${jy}/${pad2(jm)}/${pad2(jd)}`;
  }
  if (withWeekday) s = `${weekdayName(jdn)}، ${s}`;
  return fa ? toPersianDigits(s) : s;
}

export function formatGregorian(jdn, { long = false, fa = false } = {}) {
  const { gy, gm, gd } = jdnToGregorian(jdn);
  let s;
  if (long) {
    s = `${gd} ${GREGORIAN_MONTHS_FA[gm - 1]} ${gy}`;
    return fa ? toPersianDigits(s) : s;
  }
  s = `${gy}-${pad2(gm)}-${pad2(gd)}`; // ISO, matches the data's gregorian_date
  return s;
}

/** The "YYYY/MM/DD" shamsi key used to match records in events.json. */
export function shamsiKey(jdn) {
  const { jy, jm, jd } = jdnToJalaali(jdn);
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

/** The "YYYY-MM-DD" gregorian key (matches events.json gregorian_date). */
export function gregorianKey(jdn) {
  const { gy, gm, gd } = jdnToGregorian(jdn);
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}
