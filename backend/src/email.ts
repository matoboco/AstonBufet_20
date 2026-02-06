import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const isConsoleMode = process.env.SMTP_MODE === 'console';

const createTransporter = () => {
  if (isConsoleMode) return null;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = port === 465;

  console.log(`SMTP Config: host=${host}, port=${port}, secure=${secure}, user=${process.env.SMTP_USER}`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
};

const transporter = createTransporter();

export const sendOTPEmail = async (email: string, code: string): Promise<void> => {
  const subject = 'Firemný Bufet - Prihlasovací kód';
  const text = `Váš prihlasovací kód je: ${code}\n\nKód je platný 10 minút.`;
  const html = `
    <h2>Firemný Bufet</h2>
    <p>Váš prihlasovací kód je:</p>
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

export const sendReminderEmail = async (
  email: string,
  balanceEur: number | string
): Promise<void> => {
  const balance = Number(balanceEur);
  const subject = 'Firemný Bufet - Pripomienka dlhu';
  const text = `Dobrý deň,\n\nVáš aktuálny zostatok v bufete je: ${balance.toFixed(2)} €\n\nNezabudnite si prosím vyrovnať dlh u office asistentky.\n\nĎakujeme,\nFiremný Bufet`;
  const html = `
    <h2>Firemný Bufet - Pripomienka</h2>
    <p>Dobrý deň,</p>
    <p>Váš aktuálny zostatok v bufete je:</p>
    <h1 style="font-size: 28px; color: #ef4444;">${balance.toFixed(2)} €</h1>
    <p>Nezabudnite si prosím vyrovnať dlh u office asistentky.</p>
    <p>Ďakujeme,<br/>Firemný Bufet</p>
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
