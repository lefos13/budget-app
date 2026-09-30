import assert from 'node:assert/strict';
import {
  scanSource,
  checkDictionaries,
  compareDictionaries,
} from './check-i18n';
import {
  formatDate,
  formatRelativeDueDate,
  calculateBudgetPacing,
  elLocale,
  enUS,
} from '../src/lib/formatters';
import { getTranslator, createTranslator } from '../src/lib/i18n/translator';
import { fallbackTranslationContext } from '../src/context/LanguageContext';
import { en } from '../src/lib/i18n/dictionaries/en';

function run() {
  console.log('🧪 Starting i18n checker & formatters test suite...\n');

  try {
    // 1. JSX text literal flagged
    const textVios = scanSource('test.tsx', '<div><span>Hello world</span></div>');
    assert.equal(textVios.length, 1);
    assert.equal(textVios[0].kind, 'jsx-text');
    assert.equal(textVios[0].text, 'Hello world');
    console.log('✓ Test 1: JSX text literal flagged correctly');

    // 2. {t('a.b')} not flagged
    const translatedVios = scanSource('test.tsx', '<div><span>{t("a.b")}</span></div>');
    assert.equal(translatedVios.length, 0);
    console.log('✓ Test 2: {t("a.b")} inside JSX is not flagged');

    // 3. <input placeholder="Search" /> flagged, placeholder={t('x')} not flagged
    const attrVios = scanSource('test.tsx', '<input placeholder="Search" />');
    assert.equal(attrVios.length, 1);
    assert.equal(attrVios[0].kind, 'jsx-attribute');
    assert.equal(attrVios[0].text, 'Search');

    const attrTranslatedVios = scanSource('test.tsx', '<input placeholder={t("x")} />');
    assert.equal(attrTranslatedVios.length, 0);
    console.log('✓ Test 3: Hardcoded placeholder flagged, placeholder={t("x")} not flagged');

    // 4. showToast('Saved') flagged, showToast(t('x')) not
    const toastVios = scanSource('test.tsx', 'function f() { showToast("Saved"); }');
    assert.equal(toastVios.length, 1);
    assert.equal(toastVios[0].kind, 'toast');
    assert.equal(toastVios[0].text, 'Saved');

    const toastTranslatedVios = scanSource('test.tsx', 'function f() { showToast(t("x")); }');
    assert.equal(toastTranslatedVios.length, 0);
    console.log('✓ Test 4: showToast("Saved") flagged, showToast(t("x")) not flagged');

    // 5. {cond ? 'Yes' : 'No'} flagged
    const condVios = scanSource('test.tsx', '<div>{cond ? "Yes" : "No"}</div>');
    assert.equal(condVios.length, 2);
    assert.deepEqual(condVios.map((v) => v.text), ['Yes', 'No']);
    console.log('✓ Test 5: Conditional expression branches {cond ? "Yes" : "No"} flagged');

    // 6. className="flex" not flagged (nor other non-target attributes)
    const classVios = scanSource('test.tsx', '<div className="flex" id="root" data-test="ok" />');
    assert.equal(classVios.length, 0);
    console.log('✓ Test 6: Non-target attributes (className, id, data-*) not flagged');

    // 7. // i18n-ignore same-line and previous-line suppress (also {/* i18n-ignore */} in JSX)
    const ignoreLineSame = scanSource('test.tsx', '<div>Hello</div> // i18n-ignore');
    assert.equal(ignoreLineSame.length, 0);

    const ignoreLinePrev = scanSource('test.tsx', '// i18n-ignore\n<div>Hello</div>');
    assert.equal(ignoreLinePrev.length, 0);

    const ignoreJsxSame = scanSource('test.tsx', '<div>Hello {/* i18n-ignore */}</div>');
    assert.equal(ignoreJsxSame.length, 0);

    const ignoreJsxPrev = scanSource('test.tsx', '<div>\n{/* i18n-ignore */}\n<span>Hello</span>\n</div>');
    assert.equal(ignoreJsxPrev.length, 0);
    console.log('✓ Test 7: // i18n-ignore and {/* i18n-ignore */} suppress violations on same and previous line');

    // 8. Aura/EUR/·/€ not flagged
    const allowedTokens = scanSource(
      'test.tsx',
      '<div><span>Aura</span><span>EUR</span><span>·</span><span>€</span><span>USD</span><span>JSON</span></div>'
    );
    assert.equal(allowedTokens.length, 0);
    console.log('✓ Test 8: Aura, EUR, USD, JSON, ·, € are not flagged');

    // 9. Greek JSX text flagged
    const greekVios = scanSource('test.tsx', '<div><span>Ελληνικά κείμενα</span></div>');
    assert.equal(greekVios.length, 1);
    assert.equal(greekVios[0].text, 'Ελληνικά κείμενα');
    console.log('✓ Test 9: Greek JSX text flagged correctly');

    // 10. checkDictionaries() returns [] on actual en & el dictionaries
    const dictErrors = checkDictionaries();
    assert.deepEqual(dictErrors, []);
    console.log('✓ Test 10: Real dictionaries parity check returns 0 errors');

    // 11. Synthetic parity comparison on two small objects
    const dictA = {
      common: {
        save: 'Save',
        items: '{count} items left',
      },
      nested: {
        msg: 'Hello',
      },
    };
    const dictB = {
      common: {
        save: 'Αποθήκευση',
        items: '{count} αντικείμενα απομένουν',
      },
      nested: {
        msg: 'Γεια',
      },
    };
    assert.deepEqual(compareDictionaries(dictA, dictB), []);

    // Missing key in B
    const missingInB = compareDictionaries({ a: '1', b: '2' }, { a: '1' }, '', 'A', 'B');
    assert.equal(missingInB.length, 1);
    assert.ok(missingInB[0].includes('Missing key in B: b'));

    // Missing key in A
    const missingInA = compareDictionaries({ a: '1' }, { a: '1', c: '3' }, '', 'A', 'B');
    assert.equal(missingInA.length, 1);
    assert.ok(missingInA[0].includes('Missing key in A: c'));

    // Empty string
    const emptyString = compareDictionaries({ a: ' ' }, { a: 'ok' }, '', 'A', 'B');
    assert.equal(emptyString.length, 1);
    assert.ok(emptyString[0].includes('Empty string in A: a'));

    // Mismatched placeholders
    const mismatchPh = compareDictionaries(
      { a: 'Welcome {user}' },
      { a: 'Καλώς ήρθατε {name}' },
      '',
      'A',
      'B'
    );
    assert.equal(mismatchPh.length, 1);
    assert.ok(mismatchPh[0].includes('Placeholder mismatch at a'));

    // Type mismatch
    const typeMismatch = compareDictionaries({ a: 'val' }, { a: 123 }, '', 'A', 'B');
    assert.equal(typeMismatch.length, 1);
    assert.ok(typeMismatch[0].includes('Type mismatch at a'));
    console.log('✓ Test 11: Synthetic dictionary parity comparisons detect differences accurately');

    // 12. Formatters tests: formatRelativeDueDate
    const tEn = getTranslator('en');
    const tEl = getTranslator('el');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);
    const in2Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 12, 0, 0);
    const in5Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 12, 0, 0);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0, 0);
    const overdue3Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 12, 0, 0);

    // Old English outputs (no t passed)
    const oldYesterday = formatRelativeDueDate(yesterday);
    assert.equal(oldYesterday.text, '1 day overdue');
    assert.equal(oldYesterday.isOverdue, true);

    const oldOverdue3 = formatRelativeDueDate(overdue3Days);
    assert.equal(oldOverdue3.text, '3 days overdue');
    assert.equal(oldOverdue3.isOverdue, true);

    const oldToday = formatRelativeDueDate(today);
    assert.equal(oldToday.text, 'Due today');
    assert.equal(oldToday.isImminent, true);

    const oldTomorrow = formatRelativeDueDate(tomorrow);
    assert.equal(oldTomorrow.text, 'Due tomorrow');
    assert.equal(oldTomorrow.isImminent, true);

    const oldIn2Days = formatRelativeDueDate(in2Days);
    assert.equal(oldIn2Days.text, 'Due in 2 days');
    assert.equal(oldIn2Days.isImminent, true);

    const oldIn5Days = formatRelativeDueDate(in5Days);
    assert.equal(oldIn5Days.text, 'Due in 5 days');
    assert.equal(oldIn5Days.isImminent, false);

    // With getTranslator('en') -> byte-identical to old English output
    assert.equal(formatRelativeDueDate(yesterday, tEn).text, oldYesterday.text);
    assert.equal(formatRelativeDueDate(overdue3Days, tEn).text, oldOverdue3.text);
    assert.equal(formatRelativeDueDate(today, tEn).text, oldToday.text);
    assert.equal(formatRelativeDueDate(tomorrow, tEn).text, oldTomorrow.text);
    assert.equal(formatRelativeDueDate(in2Days, tEn).text, oldIn2Days.text);
    assert.equal(formatRelativeDueDate(in5Days, tEn).text, oldIn5Days.text);

    // With getTranslator('el') -> natural Greek
    assert.equal(formatRelativeDueDate(yesterday, tEl).text, '1 ημέρα εκπρόθεσμο');
    assert.equal(formatRelativeDueDate(overdue3Days, tEl).text, '3 ημέρες εκπρόθεσμο');
    assert.equal(formatRelativeDueDate(today, tEl).text, 'Λήγει σήμερα');
    assert.equal(formatRelativeDueDate(tomorrow, tEl).text, 'Λήγει αύριο');
    assert.equal(formatRelativeDueDate(in2Days, tEl).text, 'Λήγει σε 2 ημέρες');
    assert.equal(formatRelativeDueDate(in5Days, tEl).text, 'Λήγει σε 5 ημέρες');
    console.log('✓ Test 12: formatRelativeDueDate produces identical English output and natural Greek output');

    // 13. formatDate with date-fns Locale
    const fixedDate = new Date(2026, 8, 5); // September 5, 2026
    const elFormatted = formatDate(fixedDate, 'MMMM d', elLocale);
    assert.ok(elFormatted.includes('Σεπτεμβρίου'), `Expected to contain Σεπτεμβρίου, got "${elFormatted}"`);

    const enFormatted = formatDate(fixedDate, 'MMMM d', enUS);
    assert.ok(enFormatted.includes('September'), `Expected to contain September, got "${enFormatted}"`);

    const defaultFormatted = formatDate(fixedDate, 'MMMM d');
    assert.ok(defaultFormatted.includes('September'), 'Default locale should remain English');
    console.log('✓ Test 13: formatDate correctly supports elLocale and contains "Σεπτεμβρίου"');

    // 14. calculateBudgetPacing statusKey field and values
    const pExceeded = calculateBudgetPacing(1000, 1100, new Date(2026, 8, 15));
    assert.equal(pExceeded.statusKey, 'exceeded');
    assert.equal(pExceeded.statusText, 'Budget exceeded');

    const pOver = calculateBudgetPacing(1000, 800, new Date(2026, 8, 5));
    assert.equal(pOver.statusKey, 'overPace');
    assert.equal(pOver.statusText, 'Spending faster than expected');

    const pUnder = calculateBudgetPacing(1000, 50, new Date(2026, 8, 25));
    assert.equal(pUnder.statusKey, 'underPace');
    assert.equal(pUnder.statusText, 'Under budget pace');

    const pHealthy = calculateBudgetPacing(1000, 500, new Date(2026, 8, 15));
    assert.equal(pHealthy.statusKey, 'healthy');
    assert.equal(pHealthy.statusText, 'Pacing healthy');
    console.log('✓ Test 14: calculateBudgetPacing returns correct statusKey and statusText values');

    // 15. createTranslator handles dictionary path navigation and fallback
    const customTranslator = createTranslator(en);
    assert.equal(customTranslator('brand.name'), 'Aura');
    assert.equal(customTranslator('missing.key', 'Fallback'), 'Fallback');
    console.log('✓ Test 15: createTranslator navigates nested paths and handles fallbacks');

    // 16. fallbackTranslationContext outside provider
    assert.equal(fallbackTranslationContext.language, 'en');
    assert.equal(fallbackTranslationContext.dateLocale.code, 'en-US');
    assert.equal(typeof fallbackTranslationContext.t, 'function');
    console.log('✓ Test 16: Fallback context outside provider exposes dateLocale and translator');

    // 17. Weekday array flagged
    const weekVios = scanSource(
      'test.tsx',
      "const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];"
    );
    assert.equal(weekVios.length, 7);
    assert.equal(weekVios[0].kind, 'label-array');
    assert.equal(weekVios[0].text, 'Mon');
    console.log('✓ Test 17: Weekday array flagged as label-array');

    // 18. title={`Active wallet: ${n}`} flagged
    const titleVios = scanSource('test.tsx', '<button title={`Active wallet: ${n}`} />');
    assert.equal(titleVios.length, 1);
    assert.equal(titleVios[0].kind, 'jsx-attribute');
    assert.equal(titleVios[0].text, 'Active wallet:');
    console.log('✓ Test 18: Template literal with letters in title attribute flagged');

    // 19. title={`${n}%`} not flagged
    const noLetterTitleVios = scanSource('test.tsx', '<div title={`${n}%`} />');
    assert.equal(noLetterTitleVios.length, 0);
    console.log('✓ Test 19: Template literal without letters (${n}%) in title attribute not flagged');

    // 20. setError('Bad input') flagged, setError(t('x')) not flagged
    const errVios = scanSource('test.tsx', 'setError("Bad input");');
    assert.equal(errVios.length, 1);
    assert.equal(errVios[0].kind, 'user-call');
    assert.equal(errVios[0].text, 'Bad input');

    const errTranslatedVios = scanSource('test.tsx', 'setError(t("x"));');
    assert.equal(errTranslatedVios.length, 0);
    console.log('✓ Test 20: setError("Bad input") flagged and setError(t("x")) not flagged');

    // 21. label: 'Pending' flagged
    const labelVios = scanSource('test.tsx', 'const opt = { label: "Pending" };');
    assert.equal(labelVios.length, 1);
    assert.equal(labelVios[0].kind, 'label-property');
    assert.equal(labelVios[0].text, 'Pending');
    console.log('✓ Test 21: Object property label: "Pending" flagged as label-property');

    // 22. status === 'PENDING' not flagged
    const eqVios = scanSource('test.tsx', 'if (status === "PENDING") {}');
    assert.equal(eqVios.length, 0);
    console.log('✓ Test 22: Equality operand status === "PENDING" not flagged');

    // 23. ['ALL','PENDING'] not flagged
    const allCapsArrayVios = scanSource('test.tsx', 'const statuses = ["ALL", "PENDING"];');
    assert.equal(allCapsArrayVios.length, 0);
    console.log('✓ Test 23: Array of ALL-CAPS tokens ["ALL", "PENDING"] not flagged');

    // 24. return 'Paid in full' flagged
    const returnVios = scanSource('test.tsx', 'function f() { return "Paid in full"; }');
    assert.equal(returnVios.length, 1);
    assert.equal(returnVios[0].kind, 'sentence');
    assert.equal(returnVios[0].text, 'Paid in full');
    console.log('✓ Test 24: return "Paid in full" flagged as sentence');

    // 25. fetch('/api/x', { headers: { 'Content-Type': 'application/json' } }) not flagged
    const fetchVios = scanSource(
      'test.tsx',
      'fetch("/api/x", { headers: { "Content-Type": "application/json" } });'
    );
    assert.equal(fetchVios.length, 0);
    console.log('✓ Test 25: fetch with Content-Type header not flagged');

    // 26. className={cn('flex p-2', x && 'bg-red-500')} not flagged
    const cnVios = scanSource(
      'test.tsx',
      '<div className={cn("flex p-2", x && "bg-red-500")} />'
    );
    assert.equal(cnVios.length, 0);
    console.log('✓ Test 26: className={cn(...)} not flagged');

    // 27. case 'BILL': not flagged
    const caseVios = scanSource('test.tsx', 'switch (val) { case "BILL": break; }');
    assert.equal(caseVios.length, 0);
    console.log('✓ Test 27: case "BILL": not flagged');

    // 28. type X = 'Foo bar' not flagged
    const typeVios = scanSource('test.ts', 'type X = "Foo bar";');
    assert.equal(typeVios.length, 0);
    console.log('✓ Test 28: type X = "Foo bar" not flagged');

    // 29. import x from './Some file' not flagged
    const importVios = scanSource('test.ts', 'import x from "./Some file";');
    assert.equal(importVios.length, 0);
    console.log('✓ Test 29: import x from "./Some file" not flagged');

    // 30. // i18n-ignore suppresses new rules
    const ignoreNewVios = scanSource('test.tsx', 'const opt = { label: "Pending" }; // i18n-ignore');
    assert.equal(ignoreNewVios.length, 0);

    const ignoreWeekdayVios = scanSource(
      'test.tsx',
      '// i18n-ignore\nconst weekDayNames = ["Mon", "Tue"];'
    );
    assert.equal(ignoreWeekdayVios.length, 0);
    console.log('✓ Test 30: // i18n-ignore suppresses new rules');

    // 31. Ternary holding UI strings: isPaid ? 'Paid' : 'Pending'
    const ternaryVios = scanSource('test.tsx', 'const statusLabel = isPaid ? "Paid" : "Pending";');
    assert.equal(ternaryVios.length, 2);
    assert.deepEqual(ternaryVios.map((v) => v.text), ['Paid', 'Pending']);
    console.log('✓ Test 31: Ternary branches (isPaid ? "Paid" : "Pending") flagged');

    // 32. showToast(`Paid "${bill.title}"!`) flagged, new Error(...) not flagged
    const toastTmplVios = scanSource('test.tsx', 'showToast(`Paid "${bill.title}"!`);');
    assert.equal(toastTmplVios.length, 1);
    assert.equal(toastTmplVios[0].kind, 'toast');
    assert.equal(toastTmplVios[0].text, 'Paid "');

    const newErrVios = scanSource('test.tsx', 'throw new Error("Something went wrong");');
    assert.equal(newErrVios.length, 0);
    console.log('✓ Test 32: showToast template static text flagged, new Error(...) not flagged');

    console.log('\n🎉 All i18n checker & formatters tests passed successfully!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

run();
