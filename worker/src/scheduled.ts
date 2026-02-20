import { query } from './db';
import { sendReminderEmail } from './email';
import type { Env, AccountBalance } from './types';

const DEBT_THRESHOLD = -5;

export async function handleScheduled(env: Env): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running reminder job...`);

  try {
    const debtors = await query<AccountBalance>(
      env.DB,
      'SELECT * FROM account_balances WHERE balance_eur < ? ORDER BY balance_eur ASC',
      [DEBT_THRESHOLD]
    );

    console.log(`Found ${debtors.length} debtors with balance below ${DEBT_THRESHOLD}€`);

    let successCount = 0;
    let failCount = 0;

    for (const debtor of debtors) {
      try {
        await sendReminderEmail(env, debtor.email, debtor.balance_eur, debtor.name);
        console.log(`  Sent reminder to ${debtor.email} (${Number(debtor.balance_eur).toFixed(2)}€)`);
        successCount++;
      } catch (error) {
        console.error(`  Failed to send reminder to ${debtor.email}:`, error);
        failCount++;
      }
    }

    console.log(`Reminder job completed: ${successCount} sent, ${failCount} failed`);
  } catch (error) {
    console.error('Reminder job error:', error);
  }
}
