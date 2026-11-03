import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { en } from '../src/lib/i18n/dictionaries/en';
import { el } from '../src/lib/i18n/dictionaries/el';
import { NAV_GROUPS } from '../src/lib/navigation';

/*
 * Guards the mobile-layout conventions. Layout itself is verified visually; this
 * script stops regressions that can be seen in source: lists that went back to
 * hand-rolled rows, modals that bypass the shared Dialog, sub-11px text, and the
 * old "Pay" wording for marking a bill as paid.
 *
 * Phase 2 of the mobile sweep appends to MIGRATED_LISTS / MIGRATED_DIALOGS.
 */
const ROOT = path.resolve(__dirname, '..');

const MIGRATED_LISTS = [
  'src/components/unpaid-bills-banner.tsx',
  'src/components/upcoming-bills-card.tsx',
  'src/components/calendar/bills-list-view.tsx',
  'src/components/urgent-reminders-banner.tsx',
];

const MIGRATED_DIALOGS = ['src/components/savings/deposit-modal.tsx'];

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function appSourceFiles(dir = path.join(ROOT, 'src')): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'landing' ? [] : appSourceFiles(full);
    return entry.name.endsWith('.tsx') ? [path.relative(ROOT, full)] : [];
  });
}

function run() {
  console.log('🧪 Starting mobile layout guard suite...\n');

  assert.equal(en.common.markPaid, 'Mark paid');
  assert.equal(el.common.markPaid, 'Εξόφληση');
  const oldPayLabel = /common\.pay\b|markAsPaidAction|unpaidBanner\.markPaid\b|bills\.markAsPaid\b/;
  const stillUsingOldLabel = appSourceFiles().filter((f) => oldPayLabel.test(read(f)));
  assert.deepEqual(stillUsingOldLabel, [], 'bills are marked paid with "Mark paid / Εξόφληση" everywhere');
  console.log('✓ Test 1: one "Mark paid / Εξόφληση" label');

  const barItems = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.mobileBar);
  assert.deepEqual(
    barItems.map((i) => el.navShort[i.labelKey as keyof typeof el.navShort]),
    ['Αρχική', 'Έξοδα', 'Κουμπαράς', 'Ημερολόγιο', 'Πάγιες']
  );
  assert.deepEqual(
    barItems.map((i) => en.navShort[i.labelKey as keyof typeof en.navShort]),
    ['Home', 'Expenses', 'Savings', 'Calendar', 'Recurring']
  );
  assert.doesNotMatch(read('src/components/sidebar.tsx'), /\.split\(' '\)\[0\]/);
  console.log('✓ Test 2: bottom bar uses dedicated short labels');

  for (const file of MIGRATED_LISTS) {
    const src = read(file);
    assert.match(src, /from '@\/components\/ui\/item-row'/, `${file} renders rows with ItemRow`);
    assert.doesNotMatch(src, /text-\[(9|10|11)px\]/, `${file} uses text-chip/text-xs, not raw sub-12px sizes`);
  }
  console.log('✓ Test 3: migrated lists use ItemRow and the text-size floor');

  for (const file of MIGRATED_DIALOGS) {
    const src = read(file);
    assert.match(src, /from '@\/components\/ui\/dialog'/, `${file} renders through Dialog`);
    assert.doesNotMatch(src, /fixed inset-0/, `${file} has no hand-rolled overlay`);
  }
  console.log('✓ Test 4: migrated modals use Dialog');

  console.log('\n✅ Mobile layout guards passed');
}

run();
