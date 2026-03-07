import type { Env } from './types';

/**
 * Email service for Cloudflare Workers.
 * Uses MailChannels API (free for CF Workers) or Resend/other HTTP API.
 *
 * In console mode, logs emails to console (for development).
 * In production, sends via MailChannels or configured SMTP API.
 */

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

async function sendEmail(env: Env, options: EmailOptions): Promise<void> {
  if (env.SMTP_MODE === 'console') {
    console.log('=== EMAIL (Console Mode) ===');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Text: ${options.text.substring(0, 200)}...`);
    console.log('============================');
    return;
  }

  const response = await fetch('https://api.smtp2go.com/v3/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.SMTP_API_KEY,
      to: [options.to],
      sender: env.SMTP_FROM || 'noreply@bufet.aston.sk',
      subject: options.subject,
      text_body: options.text,
      html_body: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email send failed (${response.status}): ${body}`);
  }

  const result = await response.json() as { data?: { succeeded?: number; failed?: number } };
  if (result.data?.failed && result.data.failed > 0) {
    throw new Error(`SMTP2GO: email delivery failed`);
  }
}

export async function sendOTPEmail(env: Env, email: string, code: string): Promise<void> {
  const subject = 'Aston Bufet 2.0 - Prihlasovaci kod';
  const text = `Ahoj,\n\nTvoj prihlasovaci kod je: ${code}\n\nKod je platny 10 minut.`;
  const html = `
    <h2>Aston Bufet 2.0</h2>
    <p>Ahoj,</p>
    <p>Tvoj prihlasovaci kod je:</p>
    <h1 style="font-size: 32px; letter-spacing: 8px; color: #10b981;">${code}</h1>
    <p>Kod je platny 10 minut.</p>
  `;

  await sendEmail(env, { to: email, subject, text, html });
  console.log(`OTP email sent to ${email}`);
}

export interface DepositEmailData {
  email: string;
  name?: string | null;
  totalPaidCents: number;
  depositedCents: number;
  contributionCents: number;
  previousBalanceCents: number;
  newBalanceCents: number;
}

export async function sendDepositEmail(env: Env, data: DepositEmailData): Promise<void> {
  const {
    email,
    name,
    totalPaidCents,
    depositedCents,
    contributionCents,
    previousBalanceCents,
    newBalanceCents,
  } = data;

  const greeting = name ? `Ahoj ${name}` : 'Ahoj';
  const totalPaid = (totalPaidCents / 100).toFixed(2);
  const deposited = (depositedCents / 100).toFixed(2);
  const contribution = (contributionCents / 100).toFixed(2);
  const previousBalance = (previousBalanceCents / 100).toFixed(2);
  const newBalance = (newBalanceCents / 100).toFixed(2);

  const subject = 'Aston Bufet 2.0 - Potvrdenie vkladu';

  let textLines = [
    `${greeting},`,
    '',
    'Na tvoj ucet v bufete bol prave zaznamenany vklad.',
    '',
    `Zaplatena suma: ${totalPaid} EUR`,
  ];

  if (contributionCents > 0) {
    textLines.push(`  - Na ucet: ${deposited} EUR`);
    textLines.push(`  - Prispevok na manko: ${contribution} EUR`);
  }

  textLines.push('');
  textLines.push(`Predchadzajuci zostatok: ${previousBalance} EUR`);
  textLines.push(`Novy zostatok: ${newBalance} EUR`);
  textLines.push('');
  textLines.push('Dakujeme,');
  textLines.push('Aston Bufet 2.0');

  const text = textLines.join('\n');

  let detailsHtml = `<p><strong>Zaplatena suma:</strong> ${totalPaid} EUR</p>`;
  if (contributionCents > 0) {
    detailsHtml += `
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li>Na ucet: ${deposited} EUR</li>
        <li>Prispevok na manko: ${contribution} EUR</li>
      </ul>
    `;
  }

  const balanceColor = newBalanceCents >= 0 ? '#10b981' : '#ef4444';
  const creditNote = newBalanceCents > 0
    ? `<p style="color: #10b981; font-weight: 500;">Mas kredit ${newBalance} EUR na dalsie nakupy.</p>`
    : '';

  const html = `
    <h2>Aston Bufet 2.0 - Potvrdenie vkladu</h2>
    <p>${greeting},</p>
    <p>Na tvoj ucet v bufete bol prave zaznamenany vklad.</p>
    ${detailsHtml}
    <table style="margin: 16px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px 16px 4px 0; color: #666;">Predchadzajuci zostatok:</td>
        <td style="padding: 4px 0; font-weight: 500;">${previousBalance} EUR</td>
      </tr>
      <tr>
        <td style="padding: 4px 16px 4px 0; color: #666;">Novy zostatok:</td>
        <td style="padding: 4px 0; font-weight: bold; font-size: 18px; color: ${balanceColor};">${newBalance} EUR</td>
      </tr>
    </table>
    ${creditNote}
    <p>Dakujeme,<br/>Aston Bufet 2.0</p>
  `;

  try {
    await sendEmail(env, { to: email, subject, text, html });
    console.log(`Deposit email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send deposit email:', error);
  }
}

export async function sendReminderEmail(
  env: Env,
  email: string,
  balanceEur: number | string,
  name?: string | null
): Promise<void> {
  const balance = Number(balanceEur);
  const greeting = name ? `Ahoj ${name}` : 'Ahoj';
  const subject = 'Aston Bufet 2.0 - Pripomienka dlhu';
  const text = `${greeting},\n\nTvoj aktualny zostatok v bufete je: ${balance.toFixed(2)} EUR\n\nNezabudni si prosim vyrovnat dlh u office asistentky.\n\nDakujeme,\nAston Bufet 2.0`;
  const html = `
    <h2>Aston Bufet 2.0 - Pripomienka</h2>
    <p>${greeting},</p>
    <p>Tvoj aktualny zostatok v bufete je:</p>
    <h1 style="font-size: 28px; color: #ef4444;">${balance.toFixed(2)} EUR</h1>
    <p>Nezabudni si prosim vyrovnat dlh u office asistentky.</p>
    <p>Dakujeme,<br/>Aston Bufet 2.0</p>
  `;

  await sendEmail(env, { to: email, subject, text, html });
  console.log(`Reminder email sent to ${email}`);
}
