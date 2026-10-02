import assert from 'node:assert/strict';
import { addRecurrenceInterval, monthlyEquivalent, pickNextOccurrences, pickSeriesOccurrences } from '../src/lib/recurrence';
import { generateIcsCalendar, IcsBillItem } from '../src/lib/ics-generator';

function run() {
  console.log('🧪 Starting recurrence & ICS de-duplication unit test suite...\n');

  try {
    // 1. NONE -> null
    assert.equal(addRecurrenceInterval(new Date('2026-05-15T00:00:00.000Z'), 'NONE'), null);
    console.log('✓ Test 1: recurrenceInterval "NONE" returns null');

    // 2. weekly -> +7 days
    const weekStart = new Date('2026-03-01T00:00:00.000Z');
    const weekNext = addRecurrenceInterval(weekStart, 'WEEKLY');
    assert.ok(weekNext);
    assert.equal(weekNext.toISOString(), '2026-03-08T00:00:00.000Z');
    console.log('✓ Test 2: WEEKLY recurrence adds exactly 7 days');

    // 3. monthly Jan 31 2026 -> Feb 28 2026 (non-leap year)
    const jan31NonLeap = new Date('2026-01-31T00:00:00.000Z');
    const feb28NonLeap = addRecurrenceInterval(jan31NonLeap, 'MONTHLY');
    assert.ok(feb28NonLeap);
    assert.equal(feb28NonLeap.toISOString(), '2026-02-28T00:00:00.000Z');
    console.log('✓ Test 3: MONTHLY clamps Jan 31 2026 to Feb 28 2026 (non-leap year)');

    // 4. Jan 31 2024 -> Feb 29 2024 (leap year)
    const jan31Leap = new Date('2024-01-31T00:00:00.000Z');
    const feb29Leap = addRecurrenceInterval(jan31Leap, 'MONTHLY');
    assert.ok(feb29Leap);
    assert.equal(feb29Leap.toISOString(), '2024-02-29T00:00:00.000Z');
    console.log('✓ Test 4: MONTHLY clamps Jan 31 2024 to Feb 29 2024 (leap year)');

    // 5. Dec 15 -> Jan 15 next year (year rollover)
    const dec15 = new Date('2026-12-15T00:00:00.000Z');
    const jan15NextYear = addRecurrenceInterval(dec15, 'MONTHLY');
    assert.ok(jan15NextYear);
    assert.equal(jan15NextYear.toISOString(), '2027-01-15T00:00:00.000Z');
    console.log('✓ Test 5: MONTHLY handles December to January year rollover');

    // 6. quarterly Nov 30 -> Feb 28 (clamps to end of Feb in non-leap year)
    const nov30 = new Date('2025-11-30T00:00:00.000Z');
    const feb28Quarterly = addRecurrenceInterval(nov30, 'QUARTERLY');
    assert.ok(feb28Quarterly);
    assert.equal(feb28Quarterly.toISOString(), '2026-02-28T00:00:00.000Z');
    console.log('✓ Test 6: QUARTERLY (+3 months) clamps Nov 30 2025 to Feb 28 2026');

    // 7. yearly Feb 29 2024 -> Feb 28 2025 (leap day + 1 year clamps to Feb 28)
    const feb29Yearly = new Date('2024-02-29T00:00:00.000Z');
    const feb28NextYear = addRecurrenceInterval(feb29Yearly, 'YEARLY');
    assert.ok(feb28NextYear);
    assert.equal(feb28NextYear.toISOString(), '2025-02-28T00:00:00.000Z');
    console.log('✓ Test 7: YEARLY (+12 months) clamps Feb 29 2024 to Feb 28 2025');

    // 8. monthly Mar 31 -> Apr 30 (clamps to 30 days)
    const mar31 = new Date('2026-03-31T00:00:00.000Z');
    const apr30 = addRecurrenceInterval(mar31, 'MONTHLY');
    assert.ok(apr30);
    assert.equal(apr30.toISOString(), '2026-04-30T00:00:00.000Z');
    console.log('✓ Test 8: MONTHLY clamps Mar 31 to Apr 30');

    // 9. input UTC-midnight stays UTC-midnight (and non-midnight time-of-day is preserved)
    const utcMidnight = new Date('2026-05-10T00:00:00.000Z');
    const resMidnight = addRecurrenceInterval(utcMidnight, 'MONTHLY');
    assert.ok(resMidnight);
    assert.equal(resMidnight.getUTCHours(), 0);
    assert.equal(resMidnight.getUTCMinutes(), 0);
    assert.equal(resMidnight.getUTCSeconds(), 0);
    assert.equal(resMidnight.getUTCMilliseconds(), 0);
    assert.equal(resMidnight.toISOString(), '2026-06-10T00:00:00.000Z');

    const utcTime = new Date('2026-01-31T15:45:30.500Z');
    const resTime = addRecurrenceInterval(utcTime, 'MONTHLY');
    assert.ok(resTime);
    assert.equal(resTime.toISOString(), '2026-02-28T15:45:30.500Z');
    console.log('✓ Test 9: Input UTC-midnight stays UTC-midnight and UTC time-of-day is strictly preserved');

    // 10. unknown interval -> null
    assert.equal(addRecurrenceInterval(new Date('2026-01-01T00:00:00.000Z'), 'unknown'), null);
    assert.equal(addRecurrenceInterval(new Date('2026-01-01T00:00:00.000Z'), 'DAILY'), null);
    assert.equal(addRecurrenceInterval(new Date('2026-01-01T00:00:00.000Z'), ''), null);
    // @ts-expect-error test non-string runtime guard
    assert.equal(addRecurrenceInterval(new Date('2026-01-01T00:00:00.000Z'), null), null);
    console.log('✓ Test 10: Unknown and unsupported recurrence intervals return null');

    // 11. ICS de-duplication: three rows of one monthly series (Aug PAID, Sep PAID, Oct PENDING) -> exactly ONE RRULE line on Oct
    const bills: IcsBillItem[] = [
      {
        id: 'bill-aug',
        seriesId: 'series-netflix',
        title: 'Netflix',
        amount: 17.99,
        currency: 'EUR',
        dueDate: new Date('2026-08-15T00:00:00.000Z'),
        status: 'PAID',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
      {
        id: 'bill-sep',
        seriesId: 'series-netflix',
        title: 'Netflix',
        amount: 17.99,
        currency: 'EUR',
        dueDate: new Date('2026-09-15T00:00:00.000Z'),
        status: 'PAID',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
      {
        id: 'bill-oct',
        seriesId: 'series-netflix',
        title: 'Netflix',
        amount: 17.99,
        currency: 'EUR',
        dueDate: new Date('2026-10-15T00:00:00.000Z'),
        status: 'PENDING',
        type: 'SUBSCRIPTION',
        isRecurring: true,
        recurrenceInterval: 'MONTHLY',
      },
    ];

    const icsContent = generateIcsCalendar('Household & Living', bills);
    const rruleLines = icsContent.split('\r\n').filter((l) => l.startsWith('RRULE:'));
    assert.equal(rruleLines.length, 1, `Expected exactly 1 RRULE line in entire ICS, found ${rruleLines.length}`);
    assert.equal(rruleLines[0], 'RRULE:FREQ=MONTHLY');

    // Verify which event contains the RRULE line
    const eventChunks = icsContent.split('BEGIN:VEVENT').slice(1);
    assert.equal(eventChunks.length, 3, 'Expected 3 VEVENT blocks in calendar');

    const augChunk = eventChunks.find((c) => c.includes('bill-aug@aurabudget.app'));
    const sepChunk = eventChunks.find((c) => c.includes('bill-sep@aurabudget.app'));
    const octChunk = eventChunks.find((c) => c.includes('bill-oct@aurabudget.app'));

    assert.ok(augChunk, 'Aug event chunk exists');
    assert.ok(sepChunk, 'Sep event chunk exists');
    assert.ok(octChunk, 'Oct event chunk exists');

    assert.equal(augChunk.includes('RRULE:'), false, 'Aug event must NOT contain RRULE');
    assert.equal(sepChunk.includes('RRULE:'), false, 'Sep event must NOT contain RRULE');
    assert.equal(octChunk.includes('RRULE:FREQ=MONTHLY'), true, 'Oct event MUST contain RRULE:FREQ=MONTHLY');

    console.log('✓ Test 11: ICS de-duplication: series of 3 occurrences emits RRULE only on the latest event (Oct)');

    // 12. Series grouping by seriesId: paid Oct + rolled-forward (renamed) Nov -> one card, counted once;
    //     two distinct series sharing a title stay separate
    const occ = (seriesId: string, title: string, due: string, status: string, amount: number, recurrenceInterval = 'MONTHLY') => ({
      seriesId,
      title,
      type: 'SUBSCRIPTION',
      status,
      amount,
      recurrenceInterval,
      dueDate: new Date(`${due}T00:00:00.000Z`),
    });
    const rows = [
      occ('s-ai', 'AI', '2026-09-01', 'PAID', 40),
      occ('s-ai', 'AI', '2026-10-01', 'PAID', 40),
      occ('s-ai', 'AI Pro', '2026-11-01', 'PENDING', 40),
      occ('s-water', 'Water', '2026-11-14', 'PENDING', 30, 'QUARTERLY'),
      occ('s-gym-a', 'Gym', '2026-08-05', 'PAID', 25),
      occ('s-gym-b', 'Gym', '2026-10-20', 'PENDING', 20),
    ];
    const oct = pickSeriesOccurrences(rows, new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59, 59, 999));
    assert.deepEqual(
      oct.map((r) => `${r.seriesId}@${r.dueDate.toISOString().slice(0, 10)}`),
      ['s-gym-a@2026-08-05', 's-ai@2026-10-01', 's-gym-b@2026-10-20', 's-water@2026-11-14'],
      'Oct view: paid Oct occurrence of AI, both Gym series, next unpaid Water'
    );
    const total = oct.reduce((s, r) => s + monthlyEquivalent(r.amount, r.recurrenceInterval), 0);
    assert.equal(Math.round(total * 100) / 100, 95, 'Monthly cost counts each series once (40 + 30/3 + 25 + 20)');
    const nov = pickSeriesOccurrences(rows, new Date(2026, 10, 1), new Date(2026, 10, 30, 23, 59, 59, 999));
    const novAi = nov.filter((r) => r.seriesId === 's-ai');
    assert.equal(novAi.length, 1, 'Renamed occurrence stays in its series');
    assert.equal(novAi[0].title, 'AI Pro', 'Nov view shows the pending (renamed) Nov occurrence');
    console.log('✓ Test 12: Recurring series collapse to one occurrence per month view; monthly cost is payment-independent');

    // 13. pickNextOccurrences:
    // (a) series with PAID Aug, PAID Sep, PENDING Oct -> Oct row
    // (b) series with all rows PAID -> latest row
    // (c) an OVERDUE row earlier than a PENDING row -> the OVERDUE one
    // (d) two series with the same title but different seriesId stay separate
    // (e) output ordered by dueDate
    const t13Rows = [
      // (a) Series Netflix (PAID Aug, PAID Sep, PENDING Oct) -> Oct row
      occ('s-netflix', 'Netflix', '2026-08-15', 'PAID', 17.99),
      occ('s-netflix', 'Netflix', '2026-09-15', 'PAID', 17.99),
      occ('s-netflix', 'Netflix', '2026-10-15', 'PENDING', 17.99),
      // (b) Series Spotify (all PAID) -> latest row (2026-06-01)
      occ('s-spotify', 'Spotify', '2026-05-01', 'PAID', 10.99),
      occ('s-spotify', 'Spotify', '2026-06-01', 'PAID', 10.99),
      // (c) Series Electricity (OVERDUE Sep, PENDING Oct) -> OVERDUE Sep row
      occ('s-elec', 'Electricity', '2026-10-10', 'PENDING', 80),
      occ('s-elec', 'Electricity', '2026-09-10', 'OVERDUE', 75),
      // (d) Two series with same title 'Gym' but different seriesId ('s-gym-1', 's-gym-2')
      occ('s-gym-1', 'Gym', '2026-11-01', 'PENDING', 30),
      occ('s-gym-2', 'Gym', '2026-11-15', 'PENDING', 25),
    ];

    const nextPicked = pickNextOccurrences(t13Rows);

    // Verify (a): Oct row picked for Netflix
    const netflixPicked = nextPicked.find((r) => r.seriesId === 's-netflix');
    assert.ok(netflixPicked, 'Netflix series was picked');
    assert.equal(netflixPicked.status, 'PENDING');
    assert.equal(netflixPicked.dueDate.toISOString().slice(0, 10), '2026-10-15');

    // Verify (b): latest row picked for Spotify (2026-06-01)
    const spotifyPicked = nextPicked.find((r) => r.seriesId === 's-spotify');
    assert.ok(spotifyPicked, 'Spotify series was picked');
    assert.equal(spotifyPicked.status, 'PAID');
    assert.equal(spotifyPicked.dueDate.toISOString().slice(0, 10), '2026-06-01');

    // Verify (c): OVERDUE row picked for Electricity (earlier than PENDING)
    const elecPicked = nextPicked.find((r) => r.seriesId === 's-elec');
    assert.ok(elecPicked, 'Electricity series was picked');
    assert.equal(elecPicked.status, 'OVERDUE');
    assert.equal(elecPicked.dueDate.toISOString().slice(0, 10), '2026-09-10');

    // Verify (d): both Gym series stay separate (both present)
    const gymPicked = nextPicked.filter((r) => r.title === 'Gym');
    assert.equal(gymPicked.length, 2, 'Two series with same title remain separate');
    assert.deepEqual(
      gymPicked.map((r) => r.seriesId).sort(),
      ['s-gym-1', 's-gym-2']
    );

    // Verify (e): output ordered by dueDate ascending
    assert.equal(nextPicked.length, 5, 'Total picked occurrences is 5');
    assert.deepEqual(
      nextPicked.map((r) => `${r.seriesId}@${r.dueDate.toISOString().slice(0, 10)}`),
      [
        's-spotify@2026-06-01',
        's-elec@2026-09-10',
        's-netflix@2026-10-15',
        's-gym-1@2026-11-01',
        's-gym-2@2026-11-15',
      ],
      'pickNextOccurrences returns items sorted strictly by dueDate ascending'
    );

    console.log('✓ Test 13: pickNextOccurrences selects earliest unpaid or latest paid per series, handles overdue, isolates seriesId, and orders by dueDate');

    console.log('\n🎉 All recurrence & ICS unit tests passed successfully!\n');
  } catch (err) {
    console.error('❌ Recurrence test failed:', err);
    process.exit(1);
  }
}

run();
