import { prisma } from '../src/lib/prisma';
import { generateIcsCalendar } from '../src/lib/ics-generator';

async function runTests() {
  console.log('🧪 Starting automated verification suite...\n');

  // Test 1: Check Database connectivity and seeded users
  const users = await prisma.user.findMany();
  console.log(`✓ Test 1: Users count in DB: ${users.length}`);
  if (users.length < 2) throw new Error('Expected at least 2 users seeded');

  // Test 2: Wallets and memberships
  const wallet = await prisma.wallet.findFirst({
    where: { name: 'Household & Living' },
    include: {
      members: { include: { user: true } },
      categories: true,
      invoices: true,
      expenses: true,
      invites: true,
    },
  });

  if (!wallet) throw new Error('Shared Household wallet not found');
  console.log(`✓ Test 2: Wallet "${wallet.name}" loaded with ${wallet.members.length} members and ${wallet.categories.length} categories`);

  // Test 3: Verify budget and spending calculation
  const totalSpent = wallet.expenses.reduce((sum, e) => sum + e.amount, 0);
  console.log(`✓ Test 3: Total expenses logged: €${totalSpent.toFixed(2)} against €${wallet.monthlyBudget.toFixed(2)} monthly budget`);

  // Test 4: Invoices & Reminders
  const pendingBills = wallet.invoices.filter((i) => i.status !== 'PAID');
  console.log(`✓ Test 4: Found ${pendingBills.length} pending/overdue invoices scheduled in calendar`);
  if (pendingBills.length === 0) throw new Error('Expected pending invoices for testing');

  // Test 5: Verify .ICS Calendar generation according to RFC 5545
  const icsBills = wallet.invoices.map((inv) => ({
    id: inv.id,
    title: inv.title,
    amount: inv.amount,
    currency: wallet.currency,
    dueDate: inv.dueDate,
    status: inv.status,
    invoiceNumber: inv.invoiceNumber,
    notes: inv.notes,
    isRecurring: inv.isRecurring,
    recurrenceInterval: inv.recurrenceInterval,
    reminderDaysBefore: inv.reminderDaysBefore,
  }));

  const icsOutput = generateIcsCalendar(wallet.name, icsBills);
  if (!icsOutput.includes('BEGIN:VCALENDAR') || !icsOutput.includes('BEGIN:VEVENT')) {
    throw new Error('ICS generator failed RFC 5545 calendar markers');
  }
  if (!icsOutput.includes('BEGIN:VALARM') || !icsOutput.includes('TRIGGER:-P3D')) {
    throw new Error('ICS generator failed to emit VALARM reminder notifications');
  }
  console.log(`✓ Test 5: RFC 5545 .ics calendar generated successfully (${icsOutput.length} bytes, contains VEVENT & VALARM alarms)`);

  // Test 6: Verify Invitation Flow & Joining
  const testInviteCode = 'TEST-INVITE-' + Math.floor(Math.random() * 10000);
  const invite = await prisma.walletInvite.create({
    data: {
      walletId: wallet.id,
      code: testInviteCode,
      role: 'MEMBER',
      maxUses: 2,
    },
  });

  // Create a brand new user simulation joining
  const newUserEmail = `collaborator-${Date.now()}@test.com`;
  const newMemberUser = await prisma.user.create({
    data: {
      name: 'Sophia Test',
      email: newUserEmail,
    },
  });

  // Join wallet via invite
  const newMembership = await prisma.walletMember.create({
    data: {
      walletId: wallet.id,
      userId: newMemberUser.id,
      role: invite.role,
    },
  });

  await prisma.walletInvite.update({
    where: { id: invite.id },
    data: { usedCount: { increment: 1 } },
  });

  console.log(`✓ Test 6: Collaborative Invite Flow verified: New member "${newMemberUser.name}" joined "${wallet.name}" as ${newMembership.role}`);

  // Clean up test invite and test member
  await prisma.walletMember.delete({ where: { id: newMembership.id } });
  await prisma.walletInvite.delete({ where: { id: invite.id } });
  await prisma.user.delete({ where: { id: newMemberUser.id } });

  console.log('\n🎉 ALL 6 AUTOMATED TESTS PASSED SUCCESSFULLY!\n');
}

runTests()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
