import dotenv from 'dotenv';
import { query } from './db';
import { sendReminderEmail } from './email';
import { AccountBalance } from './types';

dotenv.config();

const DEBT_THRESHOLD = -5; // Send reminders for balance < -5€

export const sendReminders = async (): Promise<void> => {
  console.log(`[${new Date().toISOString()}] Running reminder job...`);

  try {
    // Get all users with balance < threshold
    const debtors = await query<AccountBalance>(
      'SELECT * FROM account_balances WHERE balance_eur < $1 ORDER BY balance_eur ASC',
      [DEBT_THRESHOLD]
    );

    console.log(`Found ${debtors.length} debtors with balance below ${DEBT_THRESHOLD}€`);

    let successCount = 0;
    let failCount = 0;

    for (const debtor of debtors) {
      try {
        await sendReminderEmail(debtor.email, debtor.balance_eur, debtor.name);
        console.log(`  ✓ Sent reminder to ${debtor.email} (${Number(debtor.balance_eur).toFixed(2)}€)`);
        successCount++;
      } catch (error) {
        console.error(`  ✗ Failed to send reminder to ${debtor.email}:`, error);
        failCount++;
      }
    }

    console.log(`Reminder job completed: ${successCount} sent, ${failCount} failed`);
  } catch (error) {
    console.error('Reminder job error:', error);
  }
};

// CLI: bun run src/reminder.ts --once
if (require.main === module) {
  console.log('Running reminder job manually...');
  sendReminders().then(() => {
    console.log('Done.');
    process.exit(0);
  });
}
