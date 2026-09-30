import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { getTranslator } from '../src/lib/i18n/translator';
import { translateApiError, API_ERROR_MAP } from '../src/lib/i18n/api-errors';

function runTests() {
  console.log('🧪 Starting API errors translation test suite...\n');

  const tEn = getTranslator('en');
  const tEl = getTranslator('el');

  // Test 1: Known message translation for EN and EL
  console.log('Test 1: Known messages translate to expected strings in en and el');
  const testKnown = 'Invalid email or password';
  const resEn = translateApiError(testKnown, 401, tEn);
  const resEl = translateApiError(testKnown, 401, tEl);

  assert.equal(resEn, 'Invalid email or password.');
  assert.equal(resEl, 'Μη έγκυρο email ή κωδικός πρόσβασης.');
  console.log('  ✓ Known message translated in both languages');

  // Test 2: Known messages all have non-empty translations in both dictionaries
  console.log('Test 2: Every key in API_ERROR_MAP resolves to a non-empty string in en and el');
  for (const [msg, key] of Object.entries(API_ERROR_MAP)) {
    const enVal = tEn(key);
    const elVal = tEl(key);
    assert.ok(enVal && enVal !== key, `en missing translation for key ${key} (from "${msg}")`);
    assert.ok(elVal && elVal !== key, `el missing translation for key ${key} (from "${msg}")`);
  }
  console.log(`  ✓ All ${Object.keys(API_ERROR_MAP).length} mapped messages have valid en and el translations`);

  // Test 3: Unknown message with status fallback
  console.log('Test 3: Unknown message falls back to status-specific translation');
  assert.equal(
    translateApiError('Some completely unseen random error', 404, tEn),
    'The requested resource was not found.'
  );
  assert.equal(
    translateApiError('Some completely unseen random error', 404, tEl),
    'Ο πόρος που ζητήθηκε δεν βρέθηκε.'
  );
  assert.equal(
    translateApiError(undefined, 403, tEn),
    'You do not have permission to perform this action.'
  );
  assert.equal(
    translateApiError(undefined, 403, tEl),
    'Δεν έχετε δικαίωμα για αυτή την ενέργεια.'
  );
  console.log('  ✓ Status fallback works for unknown or empty messages');

  // Test 4: Unknown message with unknown or no status falls back to generic error
  console.log('Test 4: Unknown message without matching status falls back to generic error');
  assert.equal(
    translateApiError('Unknown error', 418, tEn),
    'An unexpected error occurred. Please try again.'
  );
  assert.equal(
    translateApiError(undefined, undefined, tEl),
    'Παρουσιάστηκε μη αναμενόμενο σφάλμα. Δοκιμάστε ξανά.'
  );
  console.log('  ✓ Generic error fallback works');

  // Test 5: Dynamic targeted invite prefix handling
  console.log('Test 5: Dynamic targeted invite prefix translates properly');
  const dynamicInvite = 'This invitation was sent specifically to test@example.com.';
  assert.equal(
    translateApiError(dynamicInvite, 403, tEn),
    'This invitation was sent specifically to another email address.'
  );
  assert.equal(
    translateApiError(dynamicInvite, 403, tEl),
    'Αυτή η πρόσκληση στάλθηκε συγκεκριμένα σε άλλη διεύθυνση email.'
  );
  console.log('  ✓ Dynamic invitation error translated');

  // Test 6: Assert every error: '...' string literal in src/app/api/auth/**/route.ts has a map entry
  console.log('Test 6: Every error string literal in src/app/api/auth/**/route.ts has a map entry');
  function findAuthRoutes(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findAuthRoutes(full));
      } else if (entry.name === 'route.ts') {
        results.push(full);
      }
    }
    return results;
  }

  const authRoutes = findAuthRoutes(path.resolve('src/app/api/auth'));
  assert.ok(authRoutes.length > 0, 'No auth route files found!');

  const foundLiterals = new Set<string>();
  // Match error: '...' and error: condition ? a : '...'
  const regex = /error:\s*(?:[^\n,}]*?:\s*)?['"]([^'"]+)['"]/g;

  for (const file of authRoutes) {
    const content = fs.readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      foundLiterals.add(match[1]);
    }
  }

  assert.ok(foundLiterals.size > 0, 'No error literals found in auth routes!');
  for (const literal of foundLiterals) {
    assert.ok(
      literal in API_ERROR_MAP,
      `Error literal "${literal}" in auth routes is missing from API_ERROR_MAP!`
    );
  }
  console.log(`  ✓ All ${foundLiterals.size} auth route error literals verified in API_ERROR_MAP`);

  console.log('\n🎉 All API error tests passed successfully!\n');
}

runTests();
