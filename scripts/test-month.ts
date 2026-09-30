import assert from 'node:assert/strict';
import {
  parseMonthKey,
  isValidMonthKey,
  formatMonthKey,
  getMonthKey,
  getCurrentMonthKey,
  addMonthsToKey,
  getMonthBounds,
  toDateKey,
  getPacingReferenceDate,
  isCurrentMonthKey,
  compareMonthKeys,
} from '../src/lib/month';

function run() {
  console.log('🧪 Starting month helper unit test suite...\n');

  try {
    // 1. parseMonthKey & isValidMonthKey: valid and invalid
    assert.deepEqual(parseMonthKey('2026-08'), { year: 2026, monthIndex: 7 });
    assert.deepEqual(parseMonthKey('2026-01'), { year: 2026, monthIndex: 0 });
    assert.deepEqual(parseMonthKey('2026-12'), { year: 2026, monthIndex: 11 });
    assert.equal(isValidMonthKey('2026-08'), true);
    assert.equal(isValidMonthKey('2024-02'), true);

    // Invalid formats: '2026-13', '2026-1', 'abc', etc.
    assert.equal(parseMonthKey('2026-13'), null);
    assert.equal(isValidMonthKey('2026-13'), false);
    assert.equal(parseMonthKey('2026-1'), null);
    assert.equal(isValidMonthKey('2026-1'), false);
    assert.equal(parseMonthKey('abc'), null);
    assert.equal(isValidMonthKey('abc'), false);
    assert.equal(parseMonthKey(''), null);
    assert.equal(isValidMonthKey(''), false);
    assert.equal(parseMonthKey('2026-00'), null);
    assert.equal(isValidMonthKey('2026-00'), false);
    assert.equal(isValidMonthKey(null), false);
    assert.equal(isValidMonthKey(undefined), false);
    assert.equal(isValidMonthKey(202608), false);
    console.log('✓ Test 1: parseMonthKey & isValidMonthKey handle valid and invalid inputs strictly');

    // 2. formatMonthKey overflow and underflow
    assert.equal(formatMonthKey(2026, 0), '2026-01');
    assert.equal(formatMonthKey(2026, 11), '2026-12');
    assert.equal(formatMonthKey(2026, 12), '2027-01');
    assert.equal(formatMonthKey(2026, -1), '2025-12');
    assert.equal(formatMonthKey(2026, 24), '2028-01');
    assert.equal(formatMonthKey(2026, -13), '2024-12');
    console.log('✓ Test 2: formatMonthKey properly handles overflow and underflow in both directions');

    // 3. addMonthsToKey Dec->Jan, Jan->Dec, +/-12, and invalid fallback
    assert.equal(addMonthsToKey('2026-12', 1), '2027-01');
    assert.equal(addMonthsToKey('2026-01', -1), '2025-12');
    assert.equal(addMonthsToKey('2026-05', 12), '2027-05');
    assert.equal(addMonthsToKey('2026-05', -12), '2025-05');
    assert.equal(addMonthsToKey('2026-05', 0), '2026-05');
    assert.equal(addMonthsToKey('invalid-key', 3), getCurrentMonthKey());
    console.log('✓ Test 3: addMonthsToKey handles rollover (Dec->Jan, Jan->Dec, +/-12) and invalid fallback');

    // 4. getMonthBounds: Feb 2024 (29 days), Feb 2026 (28 days), Dec (ends 31st 23:59:59.999), 30-day month
    const feb2024 = getMonthBounds('2024-02');
    assert.equal(feb2024.start.getFullYear(), 2024);
    assert.equal(feb2024.start.getMonth(), 1);
    assert.equal(feb2024.start.getDate(), 1);
    assert.equal(feb2024.start.getHours(), 0);
    assert.equal(feb2024.start.getMinutes(), 0);
    assert.equal(feb2024.start.getSeconds(), 0);
    assert.equal(feb2024.start.getMilliseconds(), 0);

    assert.equal(feb2024.end.getFullYear(), 2024);
    assert.equal(feb2024.end.getMonth(), 1);
    assert.equal(feb2024.end.getDate(), 29); // Leap year 29 days
    assert.equal(feb2024.end.getHours(), 23);
    assert.equal(feb2024.end.getMinutes(), 59);
    assert.equal(feb2024.end.getSeconds(), 59);
    assert.equal(feb2024.end.getMilliseconds(), 999);

    const feb2026 = getMonthBounds('2026-02');
    assert.equal(feb2026.end.getDate(), 28); // Non-leap 28 days

    const dec2026 = getMonthBounds('2026-12');
    assert.equal(dec2026.start.getDate(), 1);
    assert.equal(dec2026.end.getDate(), 31);
    assert.equal(dec2026.end.getHours(), 23);
    assert.equal(dec2026.end.getMinutes(), 59);
    assert.equal(dec2026.end.getSeconds(), 59);
    assert.equal(dec2026.end.getMilliseconds(), 999);

    const apr2026 = getMonthBounds('2026-04');
    assert.equal(apr2026.end.getDate(), 30); // 30-day month

    // end is strictly before next month's start
    const jan2027 = getMonthBounds('2027-01');
    assert(dec2026.end < jan2027.start, 'Dec end must be strictly before Jan start');
    assert.equal(jan2027.start.getTime() - dec2026.end.getTime(), 1);

    const may2026 = getMonthBounds('2026-05');
    assert(apr2026.end < may2026.start, 'Apr end must be strictly before May start');
    assert.equal(may2026.start.getTime() - apr2026.end.getTime(), 1);

    // Fallback for invalid key
    const invalidBounds = getMonthBounds('bad-key');
    const currentBounds = getMonthBounds(getCurrentMonthKey());
    assert.equal(invalidBounds.start.getTime(), currentBounds.start.getTime());
    assert.equal(invalidBounds.end.getTime(), currentBounds.end.getTime());
    console.log('✓ Test 4: getMonthBounds calculates exact boundaries, leap years, and strictly precedes next month');

    // 5. toDateKey of local midnight equals the local date
    const mid1 = new Date(2026, 8, 15, 0, 0, 0, 0); // 2026-09-15
    assert.equal(toDateKey(mid1), '2026-09-15');

    const mid2 = new Date(2026, 0, 1, 0, 0, 0, 0); // 2026-01-01
    assert.equal(toDateKey(mid2), '2026-01-01');

    const mid3 = new Date(2026, 1, 28, 0, 0, 0, 0); // 2026-02-28
    assert.equal(toDateKey(mid3), '2026-02-28');

    const mid4 = new Date(2024, 1, 29, 0, 0, 0, 0); // 2024-02-29
    assert.equal(toDateKey(mid4), '2024-02-29');

    const mid5 = new Date(2026, 11, 31, 0, 0, 0, 0); // 2026-12-31
    assert.equal(toDateKey(mid5), '2026-12-31');
    console.log('✓ Test 5: toDateKey of local midnight preserves local YYYY-MM-DD');

    // 6. getPacingReferenceDate for past, current, future
    const fixedNow = new Date(2026, 8, 15, 14, 30, 0, 0); // 2026-09-15 14:30:00
    // Past month -> end of that month
    const pastRef = getPacingReferenceDate('2026-08', fixedNow);
    assert.equal(pastRef.getTime(), getMonthBounds('2026-08').end.getTime());

    // Current month -> now
    const currentRef = getPacingReferenceDate('2026-09', fixedNow);
    assert.equal(currentRef.getTime(), fixedNow.getTime());

    // Future month -> start of that month
    const futureRef = getPacingReferenceDate('2026-10', fixedNow);
    assert.equal(futureRef.getTime(), getMonthBounds('2026-10').start.getTime());

    // Invalid key fallback -> now
    const invalidRef = getPacingReferenceDate('invalid-month', fixedNow);
    assert.equal(invalidRef.getTime(), fixedNow.getTime());
    console.log('✓ Test 6: getPacingReferenceDate returns expected dates for past, current, future, and invalid');

    // 7. compareMonthKeys & isCurrentMonthKey & getMonthKey
    assert.equal(compareMonthKeys('2026-01', '2026-02'), -1);
    assert.equal(compareMonthKeys('2026-02', '2026-01'), 1);
    assert.equal(compareMonthKeys('2026-05', '2026-05'), 0);
    assert.equal(compareMonthKeys('2025-12', '2026-01'), -1);

    assert.equal(isCurrentMonthKey('2026-09', fixedNow), true);
    assert.equal(isCurrentMonthKey('2026-08', fixedNow), false);
    assert.equal(isCurrentMonthKey('2026-10', fixedNow), false);

    assert.equal(getMonthKey(new Date(2026, 0, 5)), '2026-01');
    assert.equal(getMonthKey(new Date(2026, 11, 25)), '2026-12');
    console.log('✓ Test 7: compareMonthKeys, isCurrentMonthKey, and getMonthKey operate correctly');

    console.log('\n🎉 All month helper tests passed successfully!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

run();
