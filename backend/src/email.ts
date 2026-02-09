import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const isConsoleMode = process.env.SMTP_MODE === 'console';

const createTransporter = () => {
  if (isConsoleMode) return null;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log(`SMTP Config: host=${host}, port=${port}, secure=${secure}, auth=${user ? 'yes' : 'no'}`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    // Only include auth if credentials are provided
    ...(user && pass ? { auth: { user, pass } } : {}),
    // Accept self-signed certificates (for internal postfix)
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

const transporter = createTransporter();

export const sendOTPEmail = async (email: string, code: string): Promise<void> => {
  const subject = 'Aston Bufet 2.0 - Prihlasovací kód';
  const text = `Ahoj,\n\nTvoj prihlasovací kód je: ${code}\n\nKód je platný 10 minút.`;
  const html = `
    <h2>Aston Bufet 2.0</h2>
    <p>Ahoj,</p>
    <p>Tvoj prihlasovací kód je:</p>
    <h1 style="font-size: 32px; letter-spacing: 8px; color: #10b981;">${code}</h1>
    <p>Kód je platný 10 minút.</p>
  `;

  if (isConsoleMode) {
    console.log('=== EMAIL (Console Mode) ===');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Code: ${code}`);
    console.log('============================');
    return;
  }

  try {
    await transporter!.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    throw new Error(`Nepodarilo sa odoslať email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export interface DepositEmailData {
  email: string;
  name?: string | null;
  totalPaidCents: number;
  depositedCents: number;
  contributionCents: number;
  previousBalanceCents: number;
  newBalanceCents: number;
}

export const sendDepositEmail = async (data: DepositEmailData): Promise<void> => {
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

  // Build text content
  let textLines = [
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

  textLines.push('');
  textLines.push('Ďakujeme,');
  textLines.push('Aston Bufet 2.0');

  const text = textLines.join('\n');

  // Build HTML content
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

  if (isConsoleMode) {
    console.log('=== DEPOSIT EMAIL (Console Mode) ===');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Total paid: ${totalPaid} €`);
    console.log(`Deposited: ${deposited} €`);
    console.log(`Contribution: ${contribution} €`);
    console.log(`Previous balance: ${previousBalance} €`);
    console.log(`New balance: ${newBalance} €`);
    console.log('====================================');
    return;
  }

  try {
    await transporter!.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`Deposit email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send deposit email:', error);
    // Don't throw - deposit was successful, email is just notification
  }
};

export const sendReminderEmail = async (
  email: string,
  balanceEur: number | string,
  name?: string | null
): Promise<void> => {
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

  if (isConsoleMode) {
    console.log('=== REMINDER EMAIL (Console Mode) ===');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Balance: ${balance.toFixed(2)} €`);
    console.log('=====================================');
    return;
  }

  try {
    await transporter!.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject,
      text,
      html,
    });
    console.log(`Reminder email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    throw new Error(`Nepodarilo sa odoslať email: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
