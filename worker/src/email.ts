import type { Env } from './types';

export interface DepositEmailData {
  email: string;
  name?: string | null;
  totalPaidCents: number;
  depositedCents: number;
  contributionCents: number;
  previousBalanceCents: number;
  newBalanceCents: number;
}

async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<void> {
  if (env.SMTP_MODE === 'console') {
    console.log('=== EMAIL (Console Mode) ===');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text: ${text.substring(0, 200)}...`);
    console.log('============================');
    return;
  }

  // Use Resend API if key is available
  if (env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.SMTP_FROM || 'noreply@aston.sk',
        to: [to],
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Resend API error: ${response.status} ${err}`);
    }
    console.log(`Email sent to ${to} via Resend`);
    return;
  }

  // Fallback: generic SMTP relay via HTTP (e.g., MailChannels on CF Workers)
  if (env.SMTP_HOST) {
    // MailChannels or similar HTTP-based email relay
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: env.SMTP_FROM || 'noreply@aston.sk' },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`MailChannels error: ${response.status} ${err}`);
    }
    console.log(`Email sent to ${to} via MailChannels`);
    return;
  }

  console.warn(`No email provider configured. Would send to ${to}: ${subject}`);
}

export async function sendOTPEmail(env: Env, email: string, code: string): Promise<void> {
  const subject = 'Aston Bufet 2.0 - Prihlasovací kód';
  const text = `Ahoj,\n\nTvoj prihlasovací kód je: ${code}\n\nKód je platný 10 minút.`;
  const html = `
    <h2>Aston Bufet 2.0</h2>
    <p>Ahoj,</p>
    <p>Tvoj prihlasovací kód je:</p>
    <h1 style="font-size: 32px; letter-spacing: 8px; color: #10b981;">${code}</h1>
    <p>Kód je platný 10 minút.</p>
  `;

  await sendEmail(env, email, subject, text, html);
}

export async function sendDepositEmail(env: Env, data: DepositEmailData): Promise<void> {
  const {
    email, name, totalPaidCents, depositedCents, contributionCents,
    previousBalanceCents, newBalanceCents,
  } = data;

  const greeting = name ? `Ahoj ${name}` : 'Ahoj';
  const totalPaid = (totalPaidCents / 100).toFixed(2);
  const deposited = (depositedCents / 100).toFixed(2);
  const contribution = (contributionCents / 100).toFixed(2);
  const previousBalance = (previousBalanceCents / 100).toFixed(2);
  const newBalance = (newBalanceCents / 100).toFixed(2);

  const subject = 'Aston Bufet 2.0 - Potvrdenie vkladu';

  const textLines = [
    `${greeting},`,
    '',
    'Na tvoj účet v bufete bol práve zaznamenaný vklad.',
    '',
    `Zaplatená suma: ${totalPaid} €`,
  ];

  if (contributionCents > 0) {
    textLines.push(`  - Na účet: ${deposited} €`);
    textLines.push(`  - Príspevok na manko: ${contribution} €`);
  }

  textLines.push('');
  textLines.push(`Predchádzajúci zostatok: ${previousBalance} €`);
  textLines.push(`Nový zostatok: ${newBalance} €`);

  if (newBalanceCents > 0) {
    textLines.push('');
    textLines.push(`Máš kredit ${newBalance} € na ďalšie nákupy.`);
  }

  textLines.push('', 'Ďakujeme,', 'Aston Bufet 2.0');
  const text = textLines.join('\n');

  let detailsHtml = `<p><strong>Zaplatená suma:</strong> ${totalPaid} €</p>`;
  if (contributionCents > 0) {
    detailsHtml += `
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li>Na účet: ${deposited} €</li>
        <li>Príspevok na manko: ${contribution} €</li>
      </ul>
    `;
  }

  const balanceColor = newBalanceCents >= 0 ? '#10b981' : '#ef4444';
  const creditNote = newBalanceCents > 0
    ? `<p style="color: #10b981; font-weight: 500;">Máš kredit ${newBalance} € na ďalšie nákupy.</p>`
    : '';

  const html = `
    <h2>Aston Bufet 2.0 - Potvrdenie vkladu</h2>
    <p>${greeting},</p>
    <p>Na tvoj účet v bufete bol práve zaznamenaný vklad.</p>
    ${detailsHtml}
    <table style="margin: 16px 0; border-collapse: collapse;">
      <tr>
        <td style="padding: 4px 16px 4px 0; color: #666;">Predchádzajúci zostatok:</td>
        <td style="padding: 4px 0; font-weight: 500;">${previousBalance} €</td>
      </tr>
      <tr>
        <td style="padding: 4px 16px 4px 0; color: #666;">Nový zostatok:</td>
        <td style="padding: 4px 0; font-weight: bold; font-size: 18px; color: ${balanceColor};">${newBalance} €</td>
      </tr>
    </table>
    ${creditNote}
    <p>Ďakujeme,<br/>Aston Bufet 2.0</p>
  `;

  await sendEmail(env, email, subject, text, html);
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
  const text = `${greeting},\n\nTvoj aktuálny zostatok v bufete je: ${balance.toFixed(2)} €\n\nNezabudni si prosím vyrovnať dlh u office asistentky.\n\nĎakujeme,\nAston Bufet 2.0`;
  const html = `
    <h2>Aston Bufet 2.0 - Pripomienka</h2>
    <p>${greeting},</p>
    <p>Tvoj aktuálny zostatok v bufete je:</p>
    <h1 style="font-size: 28px; color: #ef4444;">${balance.toFixed(2)} €</h1>
    <p>Nezabudni si prosím vyrovnať dlh u office asistentky.</p>
    <p>Ďakujeme,<br/>Aston Bufet 2.0</p>
  `;

  await sendEmail(env, email, subject, text, html);
}
