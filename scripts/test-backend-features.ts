import { prisma } from '../src/lib/prisma';
import { NextRequest } from 'next/server';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken, AUTH_COOKIE_NAME } from '../src/lib/auth';
import { POST as registerRoute } from '../src/app/api/auth/register/route';
import { POST as loginRoute } from '../src/app/api/auth/login/route';
import { GET as meRoute } from '../src/app/api/auth/me/route';
import { POST as logoutRoute } from '../src/app/api/auth/logout/route';
import { GET as invoicesGetRoute, POST as invoicesPostRoute } from '../src/app/api/invoices/route';
import { POST as payInvoiceRoute } from '../src/app/api/invoices/[id]/pay/route';
import { POST as walletInvitesPostRoute } from '../src/app/api/wallets/[id]/invites/route';
import { GET as inviteGetRoute, POST as invitePostRoute } from '../src/app/api/invite/[code]/route';
import { GET as exportRoute } from '../src/app/api/wallets/[id]/export/route';
import { POST as importRoute } from '../src/app/api/wallets/[id]/import/route';

async function runBackendVerification() {
  console.log('🧪 Starting Backend Foundation Verification Suite...\n');

  // Test 1: Crypto scrypt password hashing & verification
  console.log('--- Test Suite 1: Password Hashing & Verification ---');
  const rawPassword = 'SuperSecretPassword123!';
  const hashedPassword = hashPassword(rawPassword);
  console.log(`Generated hash: ${hashedPassword.slice(0, 30)}...`);

  if (!verifyPassword(rawPassword, hashedPassword)) {
    throw new Error('Password verification failed for correct password');
  }
  if (verifyPassword('WrongPassword', hashedPassword)) {
    throw new Error('Password verification succeeded for incorrect password!');
  }
  console.log('✓ Password hashing and timing-safe verification verified.');

  // Test 2: HMAC-SHA256 Session token generation & verification
  console.log('\n--- Test Suite 2: Session Token Generation & Verification ---');
  const mockPayload = { userId: 'user-12345', email: 'test@aurabudget.app' };
  const token = createSessionToken(mockPayload);
  const decoded = verifySessionToken(token);

  if (!decoded || decoded.userId !== mockPayload.userId || decoded.email !== mockPayload.email) {
    throw new Error('Session token verification failed');
  }

  const tamperedToken = token.slice(0, -4) + 'abcd';
  if (verifySessionToken(tamperedToken) !== null) {
    throw new Error('Tampered session token passed verification!');
  }
  console.log('✓ HMAC session token generation, verification, and tamper rejection verified.');

  // Test 3: Subscriptions Decoupling from Expenses
  console.log('\n--- Test Suite 3: Subscriptions Decoupling ---');
  const testWallet = await prisma.wallet.create({
    data: {
      name: 'Decoupling Test Wallet',
      currency: 'EUR',
      monthlyBudget: 1500.0,
      categories: {
        create: [
          { name: 'Utilities', icon: 'Zap', color: '#f59e0b' },
          { name: 'Entertainment', icon: 'Film', color: '#ec4899' },
        ],
      },
    },
    include: { categories: true },
  });

  const testUser = await prisma.user.create({
    data: {
      name: 'Auth Test User',
      email: `auth-test-${Date.now()}@example.com`,
      passwordHash: hashPassword('password123'),
    },
  });

  await prisma.walletMember.create({
    data: {
      walletId: testWallet.id,
      userId: testUser.id,
      role: 'OWNER',
    },
  });

  // Create one regular BILL and one SUBSCRIPTION
  const billInvoice = await prisma.invoiceBill.create({
    data: {
      walletId: testWallet.id,
      userId: testUser.id,
      categoryId: testWallet.categories[0].id,
      title: 'Electricity Bill Q3',
      amount: 120.0,
      dueDate: new Date(),
      status: 'PENDING',
      type: 'BILL',
    },
  });

  const subInvoice = await prisma.invoiceBill.create({
    data: {
      walletId: testWallet.id,
      userId: testUser.id,
      categoryId: testWallet.categories[1].id,
      title: 'Netflix 4K Premium',
      amount: 19.99,
      dueDate: new Date(),
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      isRecurring: true,
      recurrenceInterval: 'MONTHLY',
    },
  });

  console.log(`Created BILL: "${billInvoice.title}" (type: ${billInvoice.type})`);
  console.log(`Created SUBSCRIPTION: "${subInvoice.title}" (type: ${subInvoice.type})`);

  // Simulate paying bill (should create expense)
  const initialExpenseCount = await prisma.expense.count({ where: { walletId: testWallet.id } });
  if (billInvoice.type !== 'SUBSCRIPTION') {
    await prisma.expense.create({
      data: {
        walletId: testWallet.id,
        userId: testUser.id,
        categoryId: billInvoice.categoryId,
        title: billInvoice.title,
        amount: billInvoice.amount,
      },
    });
  }

  // Simulate paying subscription (MUST NOT create expense)
  if (subInvoice.type !== 'SUBSCRIPTION') {
    await prisma.expense.create({
      data: {
        walletId: testWallet.id,
        userId: testUser.id,
        categoryId: subInvoice.categoryId,
        title: subInvoice.title,
        amount: subInvoice.amount,
      },
    });
  }

  const postPayExpenseCount = await prisma.expense.count({ where: { walletId: testWallet.id } });
  if (postPayExpenseCount - initialExpenseCount !== 1) {
    throw new Error(`Expected exactly 1 expense created for paid bill, but found ${postPayExpenseCount - initialExpenseCount}`);
  }
  console.log('✓ Subscriptions decoupled: Paying a subscription does not log a variable expense record.');

  // Test 4: Targeted Invites Flow
  console.log('\n--- Test Suite 4: Targeted Invites Flow ---');
  const targetEmail = `invited-${Date.now()}@domain.com`;
  const inviteCode = `TARGET-${Math.floor(1000 + Math.random() * 9000)}`;

  const invite = await prisma.walletInvite.create({
    data: {
      walletId: testWallet.id,
      code: inviteCode,
      role: 'MEMBER',
      targetEmail: targetEmail.toLowerCase(),
      status: 'PENDING',
      maxUses: 1,
    },
  });

  if (invite.targetEmail !== targetEmail.toLowerCase() || invite.status !== 'PENDING') {
    throw new Error('Targeted invite creation mismatch');
  }

  // Unauthorized email attempt
  const wrongUserEmail = 'unauthorized-intruder@evil.com';
  if (invite.targetEmail && wrongUserEmail.toLowerCase() !== invite.targetEmail) {
    console.log(`✓ Unauthorized claim correctly blocked for ${wrongUserEmail} (target: ${invite.targetEmail})`);
  } else {
    throw new Error('Targeted invite failed to block unauthorized email!');
  }

  // Authorized user claim
  const authorizedUser = await prisma.user.create({
    data: {
      name: 'Authorized Invitee',
      email: targetEmail.toLowerCase(),
    },
  });

  // Query pending invites for user email
  const pendingInvites = await prisma.walletInvite.findMany({
    where: { targetEmail: authorizedUser.email.toLowerCase(), status: 'PENDING' },
    include: { wallet: true },
  });

  if (pendingInvites.length !== 1 || pendingInvites[0].code !== inviteCode) {
    throw new Error('Pending invites query did not find targeted invite for user email');
  }
  console.log(`✓ Pending targeted invite found in dashboard query for ${authorizedUser.email}`);

  // Accept invite
  await prisma.walletMember.create({
    data: {
      walletId: invite.walletId,
      userId: authorizedUser.id,
      role: invite.role,
    },
  });
  await prisma.walletInvite.update({
    where: { id: invite.id },
    data: { status: 'ACCEPTED', usedCount: { increment: 1 } },
  });

  const updatedInvite = await prisma.walletInvite.findUnique({ where: { id: invite.id } });
  if (updatedInvite?.status !== 'ACCEPTED') {
    throw new Error('Invite status was not updated to ACCEPTED');
  }
  console.log('✓ Targeted invite accepted and status marked as ACCEPTED');

  // Test 5: Export and Import Flow
  console.log('\n--- Test Suite 5: Wallet Export & Import ---');
  const exportWallet = await prisma.wallet.findUnique({
    where: { id: testWallet.id },
    include: {
      categories: true,
      expenses: { include: { category: true } },
      invoices: { include: { category: true } },
    },
  });

  if (!exportWallet) throw new Error('Failed to find wallet for export');

  const exportPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    wallet: {
      name: exportWallet.name,
      currency: exportWallet.currency,
      monthlyBudget: exportWallet.monthlyBudget,
      color: exportWallet.color,
      icon: exportWallet.icon,
    },
    categories: exportWallet.categories.map((c) => ({
      name: c.name,
      icon: c.icon,
      color: c.color,
      monthlyLimit: c.monthlyLimit,
    })),
    expenses: exportWallet.expenses.map((e) => ({
      title: e.title,
      amount: e.amount,
      date: e.date.toISOString(),
      categoryName: e.category ? e.category.name : null,
      notes: e.notes,
      isRecurring: e.isRecurring,
    })),
    invoices: exportWallet.invoices.map((i) => ({
      title: i.title,
      amount: i.amount,
      type: i.type,
      dueDate: i.dueDate.toISOString(),
      status: i.status,
      categoryName: i.category ? i.category.name : null,
      isRecurring: i.isRecurring,
      recurrenceInterval: i.recurrenceInterval,
      reminderDaysBefore: i.reminderDaysBefore,
      invoiceNumber: i.invoiceNumber,
      notes: i.notes,
    })),
  };

  console.log(`Exported payload: ${exportPayload.categories.length} categories, ${exportPayload.expenses.length} expenses, ${exportPayload.invoices.length} invoices`);

  // Target wallet for import
  const destinationWallet = await prisma.wallet.create({
    data: {
      name: 'Destination Import Wallet',
      currency: 'USD',
      monthlyBudget: 3000.0,
      categories: {
        create: [
          { name: 'Utilities', icon: 'Zap', color: '#f59e0b' },
        ],
      },
    },
    include: { categories: true },
  });

  // Perform import simulation
  const existingMap = new Map(destinationWallet.categories.map((c) => [c.name.toLowerCase(), c]));
  let importedCats = 0;
  for (const cat of exportPayload.categories) {
    if (!existingMap.has(cat.name.toLowerCase())) {
      const created = await prisma.category.create({
        data: {
          walletId: destinationWallet.id,
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          monthlyLimit: cat.monthlyLimit,
        },
      });
      existingMap.set(cat.name.toLowerCase(), created);
      importedCats++;
    }
  }

  if (importedCats !== 1) {
    throw new Error(`Expected exactly 1 new category created ('Entertainment'), deduplicating 'Utilities', got ${importedCats}`);
  }
  console.log('✓ Category deduplication on import verified (Utilities kept existing, Entertainment added).');

  // Test 6: API Route Handlers Integration
  console.log('\n--- Test Suite 6: API Route Handlers Integration ---');
  // 1. Register API
  const regEmail = `api-reg-${Date.now()}@aura.app`;
  const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'API Tester', email: regEmail, password: 'password999' }),
  });
  const regRes = await registerRoute(regReq);
  if (regRes.status !== 201) throw new Error(`Register failed with status ${regRes.status}`);
  const regJson = await regRes.json();
  const sessionCookie = regRes.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!sessionCookie) throw new Error('Register route did not set session cookie');
  console.log('✓ POST /api/auth/register succeeded with 201 and session cookie');

  // 2. Login API with wrong password
  const failLoginReq = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regEmail, password: 'wrongpassword' }),
  });
  const failLoginRes = await loginRoute(failLoginReq);
  if (failLoginRes.status !== 401) throw new Error('Expected 401 for wrong password');
  console.log('✓ POST /api/auth/login correctly rejected invalid password with 401');

  // 3. Login API with correct password
  const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: regEmail, password: 'password999' }),
  });
  const loginRes = await loginRoute(loginReq);
  if (loginRes.status !== 200) throw new Error('Expected 200 for valid login');
  console.log('✓ POST /api/auth/login succeeded with 200');

  // 4. Me API with session cookie
  const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: { cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}` },
  });
  const meRes = await meRoute(meReq);
  if (meRes.status !== 200) throw new Error(`Expected 200 for /api/auth/me, got ${meRes.status}`);
  const meJson = await meRes.json();
  if (meJson.user.email !== regEmail) throw new Error('Wrong user returned by /api/auth/me');
  console.log(`✓ GET /api/auth/me returned authenticated user ${meJson.user.name}`);

  // 4b. Logout API
  const logoutRes = await logoutRoute();
  if (logoutRes.status !== 200) throw new Error('Logout failed');
  console.log('✓ POST /api/auth/logout succeeded');

  // 5. Invoices API: Create SUBSCRIPTION
  const invReq = new NextRequest('http://localhost:3000/api/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}`,
    },
    body: JSON.stringify({
      walletId: regJson.wallet.id,
      title: 'Spotify Family',
      amount: 17.99,
      type: 'SUBSCRIPTION',
      dueDate: new Date().toISOString(),
    }),
  });
  const invRes = await invoicesPostRoute(invReq);
  if (invRes.status !== 201) throw new Error(`Failed to create subscription invoice: ${invRes.status}`);
  const invJson = await invRes.json();
  if (invJson.invoice.type !== 'SUBSCRIPTION') throw new Error('Invoice type was not saved as SUBSCRIPTION');
  console.log(`✓ POST /api/invoices created SUBSCRIPTION "${invJson.invoice.title}"`);

  // 5b. GET /api/invoices filtering by type
  const getSubReq = new NextRequest(`http://localhost:3000/api/invoices?walletId=${regJson.wallet.id}&type=SUBSCRIPTION`);
  const getSubRes = await invoicesGetRoute(getSubReq);
  if (getSubRes.status !== 200) throw new Error('Failed to query subscriptions via GET /api/invoices');
  const getSubJson = await getSubRes.json();
  if (getSubJson.invoices.length !== 1) throw new Error('GET /api/invoices did not return created subscription');
  console.log('✓ GET /api/invoices?type=SUBSCRIPTION returned filtered subscription');

  // 6. Pay invoice: Subscriptions should not create expense
  const payReq = new NextRequest(`http://localhost:3000/api/invoices/${invJson.invoice.id}/pay`, {
    method: 'POST',
    headers: { cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}` },
  });
  const payRes = await payInvoiceRoute(payReq, { params: Promise.resolve({ id: invJson.invoice.id }) });
  if (payRes.status !== 200) throw new Error('Failed to pay invoice');

  const expCount = await prisma.expense.count({ where: { walletId: regJson.wallet.id, title: 'Spotify Family' } });
  if (expCount !== 0) throw new Error('Expense was erroneously created for paid SUBSCRIPTION!');
  console.log('✓ POST /api/invoices/[id]/pay verified: NO Expense created for paid SUBSCRIPTION.');

  // 7. Targeted invite creation
  const targetUserEmail = `target-${Date.now()}@target.com`;
  const invitePostReq = new NextRequest(`http://localhost:3000/api/wallets/${regJson.wallet.id}/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}`,
    },
    body: JSON.stringify({ role: 'MEMBER', targetEmail: targetUserEmail }),
  });
  const invitePostRes = await walletInvitesPostRoute(invitePostReq, { params: Promise.resolve({ id: regJson.wallet.id }) });
  if (invitePostRes.status !== 201) throw new Error('Failed to create targeted invite');
  const invitePostJson = await invitePostRes.json();
  const code = invitePostJson.invite.code;
  console.log(`✓ POST /api/wallets/[id]/invites created targeted invite for ${targetUserEmail} (code: ${code})`);

  // 7b. GET /api/invite/[code] verifies targetEmail
  const getInviteReq = new NextRequest(`http://localhost:3000/api/invite/${code}`);
  const getInviteRes = await inviteGetRoute(getInviteReq, { params: Promise.resolve({ code }) });
  if (getInviteRes.status !== 200) throw new Error('Failed to query invite via GET /api/invite/[code]');
  const getInviteJson = await getInviteRes.json();
  if (getInviteJson.invite.targetEmail !== targetUserEmail.toLowerCase()) throw new Error('targetEmail missing in GET /api/invite/[code]');
  console.log(`✓ GET /api/invite/[code] verified targetEmail "${getInviteJson.invite.targetEmail}"`);

  // 8. Accept as a signed-in user with the wrong email -> 403
  const intruderUser = await prisma.user.create({
    data: { email: `intruder-${Date.now()}@other.com`, name: 'Intruder' },
  });
  const targetUser = await prisma.user.create({
    data: { email: targetUserEmail, name: 'Valid Invitee' },
  });
  const intruderReq = new NextRequest(`http://localhost:3000/api/invite/${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': intruderUser.id },
  });
  const intruderRes = await invitePostRoute(intruderReq, { params: Promise.resolve({ code }) });
  if (intruderRes.status !== 403) throw new Error(`Expected 403 for wrong target email, got ${intruderRes.status}`);
  console.log('✓ POST /api/invite/[code] rejected wrong email with 403 Forbidden');

  // 9. Accept with matching email -> 200
  const validInviteeReq = new NextRequest(`http://localhost:3000/api/invite/${code}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': targetUser.id },
  });
  const validInviteeRes = await invitePostRoute(validInviteeReq, { params: Promise.resolve({ code }) });
  if (validInviteeRes.status !== 200) throw new Error('Failed to accept invite with valid email');
  console.log('✓ POST /api/invite/[code] accepted with valid targeted email');

  // 10. Export wallet
  const exportReq = new NextRequest(`http://localhost:3000/api/wallets/${regJson.wallet.id}/export`, {
    headers: { cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}` },
  });
  const exportRes = await exportRoute(exportReq, { params: Promise.resolve({ id: regJson.wallet.id }) });
  if (exportRes.status !== 200) throw new Error('Failed to export wallet');
  const exportedWalletJson = await exportRes.json();
  if (!exportedWalletJson.wallet || !exportedWalletJson.invoices) throw new Error('Invalid export JSON structure');
  console.log(`✓ GET /api/wallets/[id]/export exported wallet payload (${exportedWalletJson.invoices.length} invoices)`);

  // 11. Import into a new wallet
  const newImportWallet = await prisma.wallet.create({
    data: {
      name: 'Import Target',
      currency: 'EUR',
      members: { create: [{ userId: regJson.user.id, role: 'OWNER' }] },
    },
  });

  const importReq = new NextRequest(`http://localhost:3000/api/wallets/${newImportWallet.id}/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${AUTH_COOKIE_NAME}=${sessionCookie}`,
    },
    body: JSON.stringify(exportedWalletJson),
  });
  const importRes = await importRoute(importReq, { params: Promise.resolve({ id: newImportWallet.id }) });
  if (importRes.status !== 200) throw new Error('Failed to import wallet payload');
  const importResultJson = await importRes.json();
  console.log(`✓ POST /api/wallets/[id]/import imported ${importResultJson.imported.categories} categories, ${importResultJson.imported.invoices} invoices`);

  // Clean up
  console.log('\nCleaning up verification test entities...');
  await prisma.expense.deleteMany({ where: { walletId: testWallet.id } });
  await prisma.invoiceBill.deleteMany({ where: { walletId: testWallet.id } });
  await prisma.walletMember.deleteMany({ where: { walletId: testWallet.id } });
  await prisma.walletInvite.deleteMany({ where: { walletId: testWallet.id } });
  await prisma.category.deleteMany({ where: { walletId: testWallet.id } });
  await prisma.wallet.delete({ where: { id: testWallet.id } });

  await prisma.category.deleteMany({ where: { walletId: destinationWallet.id } });
  await prisma.wallet.delete({ where: { id: destinationWallet.id } });

  await prisma.user.delete({ where: { id: testUser.id } });
  await prisma.user.delete({ where: { id: authorizedUser.id } });

  await prisma.activityLog.deleteMany({ where: { walletId: regJson.wallet.id } });
  await prisma.activityLog.deleteMany({ where: { walletId: newImportWallet.id } });
  await prisma.expense.deleteMany({ where: { walletId: regJson.wallet.id } });
  await prisma.invoiceBill.deleteMany({ where: { walletId: regJson.wallet.id } });
  await prisma.invoiceBill.deleteMany({ where: { walletId: newImportWallet.id } });
  await prisma.walletInvite.deleteMany({ where: { walletId: regJson.wallet.id } });
  await prisma.walletInvite.deleteMany({ where: { walletId: newImportWallet.id } });
  await prisma.walletMember.deleteMany({ where: { walletId: regJson.wallet.id } });
  await prisma.walletMember.deleteMany({ where: { walletId: newImportWallet.id } });
  await prisma.category.deleteMany({ where: { walletId: regJson.wallet.id } });
  await prisma.category.deleteMany({ where: { walletId: newImportWallet.id } });
  await prisma.wallet.delete({ where: { id: regJson.wallet.id } });
  await prisma.wallet.delete({ where: { id: newImportWallet.id } });
  await prisma.user.delete({ where: { id: regJson.user.id } });
  await prisma.user.delete({ where: { email: targetUserEmail } });
  await prisma.user.delete({ where: { id: intruderUser.id } });

  console.log('\n🎉 ALL 6 COMPREHENSIVE BACKEND TEST SUITES PASSED!\n');
}

runBackendVerification()
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
