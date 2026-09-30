export interface IcsBillItem {
  id: string;
  title: string;
  amount: number;
  currency: string;
  dueDate: Date | string;
  status: string;
  type?: string;
  invoiceNumber?: string | null;
  notes?: string | null;
  categoryName?: string | null;
  isRecurring?: boolean;
  recurrenceInterval?: string;
  reminderDaysBefore?: number;
}

export function generateIcsCalendar(
  walletName: string,
  bills: IcsBillItem[]
): string {
  const formatDateUtc = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const formatDateValue = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const cleanText = (str: string) => {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aura Budget//Invoice Reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${cleanText(walletName)} - Bills & Invoices`,
    'X-WR-TIMEZONE:UTC',
  ];

  const nowStamp = formatDateUtc(new Date());

  // Identify the bill with the latest dueDate in each recurring series
  const seriesLatestBillId = new Map<string, string>();
  const seriesLatestDueTime = new Map<string, number>();

  for (const bill of bills) {
    const isRecurring = Boolean(
      (bill.isRecurring || bill.type === 'SUBSCRIPTION') &&
      bill.recurrenceInterval &&
      bill.recurrenceInterval !== 'NONE'
    );
    if (!isRecurring) continue;

    const key = `${bill.title}____${bill.type || ''}____${bill.recurrenceInterval}____${bill.amount}`;
    const dueTime = new Date(bill.dueDate).getTime();
    const currentMax = seriesLatestDueTime.get(key);

    if (currentMax === undefined || dueTime > currentMax) {
      seriesLatestDueTime.set(key, dueTime);
      seriesLatestBillId.set(key, bill.id);
    }
  }

  for (const bill of bills) {
    const statusPrefix = bill.status === 'PAID' ? '✓ [PAID] ' : bill.status === 'OVERDUE' ? '⚠️ [OVERDUE] ' : '📅 [DUE] ';
    const summary = `${statusPrefix}${bill.title} (${bill.currency} ${bill.amount.toFixed(2)})`;
    const dtstart = formatDateValue(new Date(bill.dueDate));

    let desc = `Amount: ${bill.currency} ${bill.amount.toFixed(2)}\\nStatus: ${bill.status}`;
    if (bill.categoryName) desc += `\\nCategory: ${bill.categoryName}`;
    if (bill.invoiceNumber) desc += `\\nInvoice #: ${bill.invoiceNumber}`;
    if (bill.notes) desc += `\\nNotes: ${bill.notes}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:bill-${bill.id}@aurabudget.app`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtstart}`);
    lines.push(`SUMMARY:${cleanText(summary)}`);
    lines.push(`DESCRIPTION:${desc}`);
    lines.push(`STATUS:${bill.status === 'PAID' ? 'CANCELLED' : 'CONFIRMED'}`);

    // If bill is recurring, add RRULE ONLY on the row with the latest dueDate in its series
    const isRecurring = Boolean(
      (bill.isRecurring || bill.type === 'SUBSCRIPTION') &&
      bill.recurrenceInterval &&
      bill.recurrenceInterval !== 'NONE'
    );

    if (isRecurring) {
      const key = `${bill.title}____${bill.type || ''}____${bill.recurrenceInterval}____${bill.amount}`;
      const isLatestInSeries = seriesLatestBillId.get(key) === bill.id;

      if (isLatestInSeries) {
        if (bill.recurrenceInterval === 'MONTHLY') {
          lines.push('RRULE:FREQ=MONTHLY');
        } else if (bill.recurrenceInterval === 'WEEKLY') {
          lines.push('RRULE:FREQ=WEEKLY');
        } else if (bill.recurrenceInterval === 'YEARLY') {
          lines.push('RRULE:FREQ=YEARLY');
        }
      }
    }

    // Add Alarms if not paid
    if (bill.status !== 'PAID') {
      const reminderDays = bill.reminderDaysBefore || 3;
      // 1st alarm: X days before
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-P${reminderDays}D`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${cleanText(`Reminder: ${bill.title} is due in ${reminderDays} days!`)}`);
      lines.push('END:VALARM');

      // 2nd alarm: 1 day before
      lines.push('BEGIN:VALARM');
      lines.push('TRIGGER:-P1D');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${cleanText(`Urgent: ${bill.title} is due tomorrow!`)}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
