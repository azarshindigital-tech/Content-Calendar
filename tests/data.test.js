import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDataset, eventsForJdn, eventsInRange } from '../public/assets/js/data.js';
import * as C from '../public/assets/js/calendar.js';

const raw = JSON.parse(readFileSync(new URL('../public/data/events.json', import.meta.url), 'utf-8'));
const ds = buildDataset(raw);

test('dataset parses all 1236 records with no invalid dates', () => {
  assert.equal(ds.report.total, 1236);
  assert.equal(ds.report.parsed, 1236);
  assert.equal(ds.report.invalidFormat.length, 0);
  assert.equal(ds.report.invalidDate.length, 0);
});

test('every stored gregorian_date matches the computed conversion (no mismatches)', () => {
  assert.equal(ds.report.shamsiGregorianMismatch.length, 0);
});

test('Nowruz day (1405/01/01) holds multiple real occasions', () => {
  const jdn = C.jalaaliToJdn(1405, 1, 1);
  const evs = eventsForJdn(ds, jdn);
  assert.equal(evs.length, 8);
  assert.ok(evs.some((e) => e.name.includes('نوروز')));
});

test('7-day extraction stays within the window and uses real data', () => {
  const start = C.jalaaliToJdn(1405, 1, 1);
  const win = eventsInRange(ds, start, 7);
  // every extracted event must fall on one of the 7 days
  const allowed = new Set(C.rangeJdns(start, 7));
  win.forEach((e) => assert.ok(allowed.has(e.jdn)));
  // and must equal the sum of per-day counts
  let manual = 0;
  for (let i = 0; i < 7; i++) manual += eventsForJdn(ds, start + i).length;
  assert.equal(win.length, manual);
});

test('stable ids are unique and in "e<index>" form', () => {
  const ids = new Set(ds.events.map((e) => e.id));
  assert.equal(ids.size, ds.events.length);
  assert.match(ds.events[0].id, /^e\d+$/);
});

test('every event has a category with a color', () => {
  ds.events.forEach((e) => {
    assert.ok(e.category && e.category.label && /^#/.test(e.category.color));
  });
});
