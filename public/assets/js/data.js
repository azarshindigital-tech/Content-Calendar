/*
 * data.js — loads and normalizes events.json (the authoritative calendar data).
 *
 * The original file is treated as read-only truth: names and dates are never
 * changed. Normalization adds derived fields (stable id, JDN, category) in a
 * separate object so the source stays intact, and produces a validation report
 * that *flags* anomalies instead of silently correcting them.
 */
import { jalaaliToJdn, shamsiKey, isValidJalaaliDate, gregorianFromJalaali, pad2 } from './calendar.js';
import { categoryOf } from './categorize.js';

const SHAMSI_RE = /^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/;

export async function fetchRawEvents(url = 'data/events.json') {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`خطا در بارگذاری داده‌ها (HTTP ${res.status})`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('ساختار فایل داده نامعتبر است.');
  return json;
}

/** Turn a raw record + index into a normalized event, or null if unparseable. */
function normalizeOne(rec, index) {
  const name = (rec && rec.name || '').trim();
  const shamsiDate = (rec && rec.shamsi_date || '').trim();
  const gregorianDate = (rec && rec.gregorian_date || '').trim();
  const m = SHAMSI_RE.exec(shamsiDate);
  if (!m || !name) return null;
  const jy = +m[1], jm = +m[2], jd = +m[3];
  if (!isValidJalaaliDate(jy, jm, jd)) return null;
  const jdn = jalaaliToJdn(jy, jm, jd);
  return {
    id: 'e' + index,
    name,
    shamsiDate: `${jy}/${pad2(jm)}/${pad2(jd)}`,
    gregorianDate,
    jy, jm, jd, jdn,
    category: categoryOf(name)
  };
}

export function buildDataset(raw) {
  const events = [];
  const report = {
    total: raw.length,
    parsed: 0,
    invalidFormat: [],
    invalidDate: [],
    shamsiGregorianMismatch: [],
    duplicates: []
  };

  const seen = new Map(); // name|shamsi -> count (for exact-duplicate flagging only)

  raw.forEach((rec, i) => {
    const shamsiDate = (rec && rec.shamsi_date || '').trim();
    const m = SHAMSI_RE.exec(shamsiDate);
    if (!m) { report.invalidFormat.push({ i, rec }); return; }
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (!isValidJalaaliDate(jy, jm, jd)) { report.invalidDate.push({ i, rec }); return; }

    const ev = normalizeOne(rec, i);
    if (!ev) { report.invalidDate.push({ i, rec }); return; }

    // Cross-check shamsi -> gregorian against the stored gregorian_date (flag only).
    const g = gregorianFromJalaali(jy, jm, jd);
    const expectedGreg = `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
    if (ev.gregorianDate && ev.gregorianDate !== expectedGreg) {
      report.shamsiGregorianMismatch.push({
        i, name: ev.name, shamsi: ev.shamsiDate,
        stored: ev.gregorianDate, computed: expectedGreg
      });
    }

    const dupKey = ev.name + '|' + ev.shamsiDate;
    seen.set(dupKey, (seen.get(dupKey) || 0) + 1);

    events.push(ev);
  });
  report.parsed = events.length;
  for (const [k, c] of seen) if (c > 1) report.duplicates.push({ key: k, count: c });

  // Index by shamsi key for O(1) day lookups.
  const byKey = new Map();
  for (const ev of events) {
    const key = ev.shamsiDate;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(ev);
  }

  // Coverage bounds.
  let minJdn = Infinity, maxJdn = -Infinity;
  for (const ev of events) {
    if (ev.jdn < minJdn) minJdn = ev.jdn;
    if (ev.jdn > maxJdn) maxJdn = ev.jdn;
  }
  const years = Array.from(new Set(events.map((e) => e.jy))).sort((a, b) => a - b);

  return {
    events,
    byKey,
    report,
    coverage: { minJdn, maxJdn, years }
  };
}

export function eventsForJdn(dataset, jdn) {
  return dataset.byKey.get(shamsiKey(jdn)) || [];
}

export function eventsInRange(dataset, startJdn, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const day = startJdn + i;
    for (const ev of eventsForJdn(dataset, day)) out.push(ev);
  }
  return out;
}

export async function loadDataset(url = 'data/events.json') {
  const raw = await fetchRawEvents(url);
  return buildDataset(raw);
}
