import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { isValidMonthKey } from '@/lib/month';
import { round2, SAVINGS_TX_TYPES } from '@/lib/savings';
import {
  getBucketBalance,
  getOrCreateGeneralBucket,
  SavingsRequestError,
  transferBetweenBuckets,
} from '@/lib/savings-server';

/** Ledger types whose amount adds to a bucket; every other type takes money out. */
const INFLOW_TYPES: ReadonlySet<string> = new Set(['DEPOSIT', 'TRANSFER_IN', 'ADJUSTMENT_IN']);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: true },
        },
        categories: true,
      },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = wallet.members.find((m) => m.userId === user.id);
    if (!membership || membership.role === 'VIEWER') {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to import into this wallet' },
        { status: 403 }
      );
    }

    const body = await req.json();

    const categoriesToImport = Array.isArray(body.categories) ? body.categories : [];
    const expensesToImport = Array.isArray(body.expenses) ? body.expenses : [];
    const invoicesToImport = Array.isArray(body.invoices) ? body.invoices : [];
    const plannedExpensesToImport = Array.isArray(body.plannedExpenses) ? body.plannedExpenses : [];
    const logsToImport = Array.isArray(body.activityLogs) ? body.activityLogs : [];
    const bucketsToImport = Array.isArray(body.savingsBuckets) ? body.savingsBuckets : [];
    const savingsTxToImport = Array.isArray(body.savingsTransactions) ? body.savingsTransactions : [];
    const bonusesToImport = Array.isArray(body.monthBonuses) ? body.monthBonuses : [];

    // Map existing members by email and id for user attribution
    const memberByEmail = new Map<string, { id: string; name: string; email: string }>();
    const memberById = new Set<string>();
    for (const m of wallet.members) {
      memberById.add(m.userId);
      if (m.user && m.user.email) {
        memberByEmail.set(m.user.email.trim().toLowerCase(), m.user);
      }
    }
    if (user.email) {
      memberByEmail.set(user.email.trim().toLowerCase(), user);
    }
    memberById.add(user.id);

    const resolveUserId = (email?: string | null): string => {
      if (typeof email === 'string' && email.trim()) {
        const found = memberByEmail.get(email.trim().toLowerCase());
        if (found) return found.id;
      }
      return user.id;
    };

    // Execute the entire import atomically within a single interactive transaction
    const importResult = await prisma.$transaction(
      async (tx) => {
        // 1. Categories: Map existing categories by normalized name to prevent duplicate creation
        const categoryMap = new Map<string, { id: string; name: string }>(
          wallet.categories.map((c) => [c.name.trim().toLowerCase(), c])
        );

        let importedCategoriesCount = 0;
        for (const cat of categoriesToImport) {
          if (!cat || typeof cat !== 'object') continue;
          if (typeof cat.name !== 'string' || !cat.name.trim()) continue;
          const key = cat.name.trim().toLowerCase();
          if (!categoryMap.has(key)) {
            const monthlyLimit =
              typeof cat.monthlyLimit === 'number' && !isNaN(cat.monthlyLimit)
                ? cat.monthlyLimit
                : null;
            const createdCat = await tx.category.create({
              data: {
                walletId: id,
                name: cat.name.trim(),
                icon: typeof cat.icon === 'string' && cat.icon.trim() ? cat.icon.trim() : 'Tag',
                color: typeof cat.color === 'string' && cat.color.trim() ? cat.color.trim() : '#3b82f6',
                monthlyLimit,
              },
            });
            categoryMap.set(key, createdCat);
            importedCategoriesCount++;
          }
        }

        // 2. Invoices / Bills / Subscriptions
        const invoiceRefMap = new Map<string, string>();
        const seriesIdMap = new Map<string, string>();
        let importedInvoicesCount = 0;

        for (const inv of invoicesToImport) {
          if (!inv || typeof inv !== 'object') continue;
          if (typeof inv.title !== 'string' || !inv.title.trim()) continue;

          const amount =
            typeof inv.amount === 'number'
              ? inv.amount
              : typeof inv.amount === 'string' && inv.amount.trim() !== ''
                ? Number(inv.amount)
                : NaN;
          if (isNaN(amount) || !isFinite(amount)) continue;

          if (!inv.dueDate) continue;
          const dueDate = new Date(inv.dueDate);
          if (isNaN(dueDate.getTime())) continue;

          const rawCategoryName =
            typeof inv.categoryName === 'string'
              ? inv.categoryName
              : typeof inv.category === 'string'
                ? inv.category
                : null;
          const catKey = rawCategoryName ? rawCategoryName.trim().toLowerCase() : null;
          const categoryId = catKey && categoryMap.has(catKey) ? categoryMap.get(catKey)!.id : null;

          const invType =
            typeof inv.type === 'string' && inv.type.toUpperCase() === 'SUBSCRIPTION'
              ? 'SUBSCRIPTION'
              : 'BILL';

          let status = 'PENDING';
          if (typeof inv.status === 'string') {
            const upper = inv.status.trim().toUpperCase();
            if (upper === 'PAID' || upper === 'PENDING' || upper === 'OVERDUE') {
              status = upper;
            } else {
              status = inv.paidAt ? 'PAID' : (dueDate < new Date() ? 'OVERDUE' : 'PENDING');
            }
          } else if (inv.paidAt) {
            status = 'PAID';
          } else {
            status = dueDate < new Date() ? 'OVERDUE' : 'PENDING';
          }

          let paidAt: Date | null = null;
          let paidByUserId: string | null = null;
          if (status === 'PAID') {
            if (inv.paidAt) {
              const pDate = new Date(inv.paidAt);
              paidAt = !isNaN(pDate.getTime()) ? pDate : new Date();
            } else {
              paidAt = new Date();
            }

            if (inv.paidBy && typeof inv.paidBy === 'object' && typeof inv.paidBy.email === 'string') {
              paidByUserId = resolveUserId(inv.paidBy.email);
            } else if (typeof inv.paidByUserId === 'string' && memberById.has(inv.paidByUserId)) {
              paidByUserId = inv.paidByUserId;
            } else if (inv.userEmail) {
              paidByUserId = resolveUserId(inv.userEmail);
            } else {
              paidByUserId = user.id;
            }
          }

          const authorId = resolveUserId(inv.userEmail);
          const isRecurring = invType === 'SUBSCRIPTION' ? true : !!inv.isRecurring;
          const recurrenceInterval =
            typeof inv.recurrenceInterval === 'string' && inv.recurrenceInterval.trim()
              ? inv.recurrenceInterval.trim()
              : invType === 'SUBSCRIPTION'
                ? 'MONTHLY'
                : 'NONE';

          // 2.3+ files carry seriesRef; older files group recurring rows by type + title (pre-seriesId identity).
          const seriesKey =
            typeof inv.seriesRef === 'string' && inv.seriesRef
              ? `ref:${inv.seriesRef}`
              : invType === 'SUBSCRIPTION' || (isRecurring && recurrenceInterval !== 'NONE')
                ? `legacy:${invType}\u0000${inv.title.trim()}`
                : null;
          let seriesId: string | undefined;
          if (seriesKey) {
            seriesId = seriesIdMap.get(seriesKey) ?? randomUUID();
            seriesIdMap.set(seriesKey, seriesId);
          }

          const reminderDaysBefore =
            typeof inv.reminderDaysBefore === 'number' && !isNaN(inv.reminderDaysBefore)
              ? Math.max(0, Math.floor(inv.reminderDaysBefore))
              : typeof inv.reminderDaysBefore === 'string' && !isNaN(parseInt(inv.reminderDaysBefore, 10))
                ? Math.max(0, parseInt(inv.reminderDaysBefore, 10))
                : 3;

          const createdAt =
            inv.createdAt && !isNaN(new Date(inv.createdAt).getTime())
              ? new Date(inv.createdAt)
              : undefined;

          const createdInvoice = await tx.invoiceBill.create({
            data: {
              walletId: id,
              userId: authorId,
              categoryId,
              title: inv.title.trim(),
              amount,
              type: invType,
              dueDate,
              status,
              isRecurring,
              recurrenceInterval,
              reminderDaysBefore,
              invoiceNumber:
                typeof inv.invoiceNumber === 'string' && inv.invoiceNumber.trim()
                  ? inv.invoiceNumber.trim()
                  : null,
              notes: typeof inv.notes === 'string' && inv.notes.trim() ? inv.notes.trim() : null,
              paidAt,
              paidByUserId,
              ...(seriesId ? { seriesId } : {}),
              ...(createdAt ? { createdAt } : {}),
            },
          });

          if (inv.ref) {
            invoiceRefMap.set(String(inv.ref), createdInvoice.id);
          }
          importedInvoicesCount++;
        }

        // 3. Expenses (rebuilding invoice link via invoiceRefMap)
        const expenseRefMap = new Map<string, string>();
        let importedExpensesCount = 0;

        for (const exp of expensesToImport) {
          if (!exp || typeof exp !== 'object') continue;
          if (typeof exp.title !== 'string' || !exp.title.trim()) continue;

          const amount =
            typeof exp.amount === 'number'
              ? exp.amount
              : typeof exp.amount === 'string' && exp.amount.trim() !== ''
                ? Number(exp.amount)
                : NaN;
          if (isNaN(amount) || !isFinite(amount)) continue;

          let date = new Date();
          if (exp.date) {
            const parsedDate = new Date(exp.date);
            if (!isNaN(parsedDate.getTime())) {
              date = parsedDate;
            }
          }

          const rawCategoryName =
            typeof exp.categoryName === 'string'
              ? exp.categoryName
              : typeof exp.category === 'string'
                ? exp.category
                : null;
          const catKey = rawCategoryName ? rawCategoryName.trim().toLowerCase() : null;
          const categoryId = catKey && categoryMap.has(catKey) ? categoryMap.get(catKey)!.id : null;

          const authorId = resolveUserId(exp.userEmail);

          let invoiceId: string | null = null;
          const invCandidate = exp.invoiceRef ?? exp.invoiceId;
          if (invCandidate && invoiceRefMap.has(String(invCandidate))) {
            invoiceId = invoiceRefMap.get(String(invCandidate))!;
          }

          const createdAt =
            exp.createdAt && !isNaN(new Date(exp.createdAt).getTime())
              ? new Date(exp.createdAt)
              : undefined;

          // Part of the amount paid from savings (only valid alongside the savings ledger of the same file).
          const rawFunded = typeof exp.savingsFundedAmount === 'number' ? exp.savingsFundedAmount : 0;
          const savingsFundedAmount =
            Number.isFinite(rawFunded) && rawFunded > 0 ? round2(Math.min(rawFunded, amount)) : 0;

          const createdExpense = await tx.expense.create({
            data: {
              walletId: id,
              userId: authorId,
              categoryId,
              invoiceId,
              title: exp.title.trim(),
              amount,
              savingsFundedAmount,
              date,
              notes: typeof exp.notes === 'string' && exp.notes.trim() ? exp.notes.trim() : null,
              isRecurring: !!exp.isRecurring,
              ...(createdAt ? { createdAt } : {}),
            },
          });

          if (exp.ref) {
            expenseRefMap.set(String(exp.ref), createdExpense.id);
          }
          importedExpensesCount++;
        }

        // 3b. Savings buckets: sub-buckets are created; an imported GENERAL merges into this wallet's General.
        const bucketRefMap = new Map<string, string>();
        const importedGoalBucketIds: string[] = [];
        const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
        for (const b of bucketsToImport) {
          if (!b || typeof b !== 'object' || b.ref === undefined || b.ref === null) continue;
          if (b.kind === 'GENERAL') {
            bucketRefMap.set(String(b.ref), (await getOrCreateGeneralBucket(tx, id)).id);
            continue;
          }
          if (typeof b.name !== 'string' || !b.name.trim()) continue;
          const closedAt = b.closedAt && !isNaN(new Date(b.closedAt).getTime()) ? new Date(b.closedAt) : null;
          const createdAt = b.createdAt && !isNaN(new Date(b.createdAt).getTime()) ? new Date(b.createdAt) : undefined;
          const created = await tx.savingsBucket.create({
            data: {
              walletId: id,
              kind: 'GOAL',
              name: b.name.trim().slice(0, 60),
              color: typeof b.color === 'string' && HEX_COLOR.test(b.color) ? b.color : '#10b981',
              icon: typeof b.icon === 'string' && b.icon.trim() ? b.icon.trim().slice(0, 40) : 'PiggyBank',
              status: b.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
              closedAt: b.status === 'CLOSED' ? closedAt ?? new Date() : null,
              ...(createdAt ? { createdAt } : {}),
            },
          });
          bucketRefMap.set(String(b.ref), created.id);
          importedGoalBucketIds.push(created.id);
        }
        const goalBucketIds = new Set(importedGoalBucketIds);

        // 4. Planned Expenses (rebuilding realized expense + savings bucket links)
        const plannedRefMap = new Map<string, string>();
        const usedRealizedExpenseIds = new Set<string>();
        let importedPlannedExpensesCount = 0;

        for (const entry of plannedExpensesToImport) {
          if (!entry || typeof entry !== 'object') continue;
          if (typeof entry.title !== 'string' || !entry.title.trim()) continue;

          const numAmount =
            typeof entry.amount === 'number'
              ? entry.amount
              : typeof entry.amount === 'string' && entry.amount.trim() !== ''
                ? Number(entry.amount)
                : NaN;
          if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) continue;

          if (!entry.expectedDate) continue;
          const parsedExpectedDate = new Date(entry.expectedDate);
          if (isNaN(parsedExpectedDate.getTime())) continue;

          const rawCategoryName =
            typeof entry.category === 'string'
              ? entry.category
              : typeof entry.categoryName === 'string'
                ? entry.categoryName
                : null;
          const catKey = rawCategoryName ? rawCategoryName.trim().toLowerCase() : null;
          const categoryId = catKey && categoryMap.has(catKey) ? categoryMap.get(catKey)!.id : null;

          const authorId = resolveUserId(entry.userEmail);
          const status =
            typeof entry.status === 'string' && entry.status.trim().toUpperCase() === 'REALIZED'
              ? 'REALIZED'
              : 'PENDING';

          let realizedExpenseId: string | null = null;
          if (status === 'REALIZED') {
            const realCandidate = entry.realizedExpenseRef ?? entry.realizedExpenseId;
            if (realCandidate && expenseRefMap.has(String(realCandidate))) {
              const targetExpenseId = expenseRefMap.get(String(realCandidate))!;
              if (!usedRealizedExpenseIds.has(targetExpenseId)) {
                realizedExpenseId = targetExpenseId;
                usedRealizedExpenseIds.add(targetExpenseId);
              }
            }
          }

          const notes =
            typeof entry.notes === 'string' && entry.notes.trim() ? entry.notes.trim() : null;
          const createdAt =
            entry.createdAt && !isNaN(new Date(entry.createdAt).getTime())
              ? new Date(entry.createdAt)
              : undefined;

          const bucketCandidate = entry.savingsBucketRef ? bucketRefMap.get(String(entry.savingsBucketRef)) : undefined;
          const savingsBucketId = bucketCandidate && goalBucketIds.has(bucketCandidate) ? bucketCandidate : null;
          const trackFromMonth =
            typeof entry.trackFromMonth === 'string' && isValidMonthKey(entry.trackFromMonth)
              ? entry.trackFromMonth
              : null;

          const createdPlanned = await tx.plannedExpense.create({
            data: {
              walletId: id,
              userId: authorId,
              categoryId,
              title: entry.title.trim(),
              amount: numAmount,
              expectedDate: parsedExpectedDate,
              trackFromMonth,
              notes,
              status,
              realizedExpenseId,
              savingsBucketId,
              ...(createdAt ? { createdAt } : {}),
            },
          });
          if (entry.ref) plannedRefMap.set(String(entry.ref), createdPlanned.id);
          importedPlannedExpensesCount++;
        }

        // 4b. Savings ledger (signs normalised by type; transfer pairs get fresh group ids)
        const groupIdMap = new Map<string, string>();
        let importedSavingsTxCount = 0;
        for (const entry of savingsTxToImport) {
          if (!entry || typeof entry !== 'object') continue;
          const bucketId = entry.bucketRef ? bucketRefMap.get(String(entry.bucketRef)) : undefined;
          if (!bucketId) continue;
          if (typeof entry.type !== 'string' || !(SAVINGS_TX_TYPES as readonly string[]).includes(entry.type)) continue;
          const raw = typeof entry.amount === 'number' ? entry.amount : Number(entry.amount);
          if (!Number.isFinite(raw) || raw === 0) continue;
          const date = entry.date ? new Date(entry.date) : null;
          if (!date || isNaN(date.getTime())) continue;
          const magnitude = round2(Math.abs(raw));
          let transferGroupId: string | null = null;
          if (typeof entry.transferGroupId === 'string' && entry.transferGroupId) {
            transferGroupId = groupIdMap.get(entry.transferGroupId) ?? randomUUID();
            groupIdMap.set(entry.transferGroupId, transferGroupId);
          }
          const createdAt =
            entry.createdAt && !isNaN(new Date(entry.createdAt).getTime()) ? new Date(entry.createdAt) : undefined;
          await tx.savingsTransaction.create({
            data: {
              walletId: id,
              bucketId,
              userId: resolveUserId(entry.userEmail),
              type: entry.type,
              amount: INFLOW_TYPES.has(entry.type) ? magnitude : -magnitude,
              date,
              transferGroupId,
              plannedExpenseId: entry.plannedExpenseRef ? plannedRefMap.get(String(entry.plannedExpenseRef)) ?? null : null,
              expenseId: entry.expenseRef ? expenseRefMap.get(String(entry.expenseRef)) ?? null : null,
              note: typeof entry.note === 'string' && entry.note.trim() ? entry.note.trim().slice(0, 200) : null,
              ...(createdAt ? { createdAt } : {}),
            },
          });
          importedSavingsTxCount++;
        }

        // 4c. Savings invariants: no negative balances; an ACTIVE bucket needs a pending expense —
        //     otherwise it closes and its money moves to General (never silently lost).
        const generalId = bucketRefMap.size > 0 || importedSavingsTxCount > 0 ? (await getOrCreateGeneralBucket(tx, id)).id : null;
        for (const bucketId of [...importedGoalBucketIds, ...(generalId ? [generalId] : [])]) {
          if (round2(await getBucketBalance(tx, bucketId)) < 0) {
            throw new SavingsRequestError('Savings data in this file is inconsistent', 400);
          }
        }
        for (const bucketId of importedGoalBucketIds) {
          const bucket = await tx.savingsBucket.findUnique({ where: { id: bucketId } });
          if (!bucket) continue;
          const pending = await tx.plannedExpense.count({ where: { savingsBucketId: bucketId, status: 'PENDING' } });
          if (bucket.status === 'ACTIVE' && pending > 0) continue;
          const balance = await getBucketBalance(tx, bucketId);
          if (balance > 0 && generalId) {
            await transferBetweenBuckets(tx, {
              walletId: id,
              fromBucketId: bucketId,
              toBucketId: generalId,
              amount: balance,
              userId: user.id,
              note: 'Leftover from imported bucket',
            });
          }
          if (bucket.status === 'ACTIVE') {
            await tx.savingsBucket.update({ where: { id: bucketId }, data: { status: 'CLOSED', closedAt: new Date() } });
          }
        }

        // 5. Activity Logs
        let importedLogsCount = 0;
        for (const log of logsToImport) {
          if (!log || typeof log !== 'object') continue;
          const action =
            typeof log.action === 'string' && log.action.trim() ? log.action.trim() : 'UNKNOWN_ACTION';
          const baseDetails = typeof log.details === 'string' ? log.details : '';
          let timestamp = new Date();
          if (log.timestamp) {
            const parsedTimestamp = new Date(log.timestamp);
            if (!isNaN(parsedTimestamp.getTime())) {
              timestamp = parsedTimestamp;
            }
          }

          let logUserId = user.id;
          let finalDetails = baseDetails;
          const authorEmail =
            typeof log.userEmail === 'string' ? log.userEmail.trim().toLowerCase() : null;

          if (authorEmail && memberByEmail.has(authorEmail)) {
            logUserId = memberByEmail.get(authorEmail)!.id;
          } else {
            logUserId = user.id;
            if (typeof log.userName === 'string' && log.userName.trim()) {
              const authorName = log.userName.trim();
              finalDetails = baseDetails ? `${baseDetails} (by ${authorName})` : `(by ${authorName})`;
            }
          }

          await tx.activityLog.create({
            data: {
              walletId: id,
              userId: logUserId,
              action,
              details: finalDetails,
              timestamp,
            },
          });
          importedLogsCount++;
        }

        // 5b. Month bonuses (2.2+; older files have none)
        let importedBonusCount = 0;
        for (const entry of bonusesToImport) {
          if (!entry || typeof entry !== 'object') continue;
          if (!isValidMonthKey(entry.monthKey)) continue;
          const amount = typeof entry.amount === 'number' ? entry.amount : Number(entry.amount);
          if (!Number.isFinite(amount) || amount <= 0) continue;
          const createdAt =
            entry.createdAt && !isNaN(new Date(entry.createdAt).getTime()) ? new Date(entry.createdAt) : undefined;
          await tx.monthBonus.create({
            data: {
              walletId: id,
              userId: resolveUserId(entry.userEmail),
              monthKey: entry.monthKey,
              amount: round2(amount),
              label: typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim().slice(0, 80) : null,
              ...(createdAt ? { createdAt } : {}),
            },
          });
          importedBonusCount++;
        }

        // 6. Record DATA_IMPORTED activity log
        await tx.activityLog.create({
          data: {
            walletId: id,
            userId: user.id,
            action: 'DATA_IMPORTED',
            details: `${user.name} imported ${importedCategoriesCount} new categories, ${importedExpensesCount} expenses, ${importedInvoicesCount} invoices/subscriptions, ${importedPlannedExpensesCount} planned expenses, ${importedGoalBucketIds.length} savings buckets, ${importedSavingsTxCount} savings movements, and ${importedLogsCount} history logs`,
          },
        });

        return {
          categories: importedCategoriesCount,
          expenses: importedExpensesCount,
          invoices: importedInvoicesCount,
          plannedExpenses: importedPlannedExpensesCount,
          history: importedLogsCount,
          activityLogs: importedLogsCount,
          savingsBuckets: importedGoalBucketIds.length,
          savingsTransactions: importedSavingsTxCount,
          monthBonuses: importedBonusCount,
        };
      },
      {
        maxWait: 10000,
        timeout: 60000,
      }
    );

    return NextResponse.json({
      success: true,
      imported: importResult,
    });
  } catch (error) {
    if (error instanceof SavingsRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error importing wallet data:', error);
    return NextResponse.json({ error: 'Failed to import wallet data' }, { status: 500 });
  }
}
