import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../public/assets/js/calendar.js';
import { isLeapJalaaliYear, jalaaliMonthLength, toJalaali, toGregorian } from '../public/assets/js/vendor/jalaali.js';

test('Nowruz 1405/01/01 maps to 2026-03-21 and back', () => {
  const g = toGregorian(1405, 1, 1);
  assert.deepEqual(g, { gy: 2026, gm: 3, gd: 21 });
  const j = toJalaali(2026, 3, 21);
  assert.deepEqual(j, { jy: 1405, jm: 1, jd: 1 });
});

test('1405 is NOT a leap Jalali year (Esfand = 29 days)', () => {
  assert.equal(isLeapJalaaliYear(1405), false);
  assert.equal(jalaaliMonthLength(1405, 12), 29);
  assert.equal(jalaaliMonthLength(1405, 1), 31);
  assert.equal(jalaaliMonthLength(1405, 7), 30);
});

test('JDN round-trip is stable across Shamsi/Gregorian', () => {
  const jdn = C.jalaaliToJdn(1405, 8, 1);
  const g = C.jdnToGregorianParts(jdn);
  const j = C.jdnToJalaaliParts(jdn);
  assert.deepEqual(j, { jy: 1405, jm: 8, jd: 1 });
  // same JDN must convert back to the same Jalali date
  assert.equal(C.jalaaliToJdn(j.jy, j.jm, j.jd), jdn);
  // gregorian->jdn->gregorian round trip
  assert.equal(C.gregorianToJdn(g.gy, g.gm, g.gd), jdn);
});

test('weekday increments by 1 (mod 7) each day', () => {
  const start = C.jalaaliToJdn(1405, 1, 1);
  for (let i = 0; i < 20; i++) {
    const a = C.weekdayIndex(start + i);
    const b = C.weekdayIndex(start + i + 1);
    assert.equal(b, (a + 1) % 7);
  }
});

test('month grid has full weeks and contains the whole month', () => {
  const weeks = C.jalaaliMonthGrid(1405, 12); // 29-day month
  assert.ok(weeks.length >= 4 && weeks.length <= 6);
  weeks.forEach((w) => assert.equal(w.length, 7));
  const inMonth = weeks.flat().filter((c) => c.inMonth);
  assert.equal(inMonth.length, 29);
});

test('shamsiKey/gregorianKey match the data format', () => {
  const jdn = C.jalaaliToJdn(1405, 1, 1);
  assert.equal(C.shamsiKey(jdn), '1405/01/01');
  assert.equal(C.gregorianKey(jdn), '2026-03-21');
});

test('todayJdn in Tehran returns an integer', () => {
  const j = C.todayJdn('Asia/Tehran');
  assert.equal(typeof j, 'number');
  assert.ok(Number.isInteger(j));
});
