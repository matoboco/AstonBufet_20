import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const isConsoleMode = process.env.SMTP_MODE === 'console';

const transporter = isConsoleMode
  ? null
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

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

  await transporter!.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject,
    text,
    html,
  });
};

export const sendReminderEmail = async (
  email: string,
  balanceEur: number
): Promise<void> => {
  const subject = 'Firemný Bufet - Pripomienka dlhu';
  const text = `Dobrý deň,\n\nVáš aktuálny zostatok v bufete je: ${balanceEur.toFixed(2)} €\n\nProsím, vyrovnajte svoj dlh u office assistant.\n\nĎakujeme,\nFiremný Bufet`;
  const html = `
    <h2>Firemný Bufet - Pripomienka</h2>
    <p>Dobrý deň,</p>
    <p>Váš aktuálny zostatok v bufete je:</p>
    <h1 style="font-size: 28px; color: #ef4444;">${balanceEur.toFixed(2)} €</h1>
    <p>Prosím, vyrovnajte svoj dlh u office assistant.</p>
    <p>Ďakujeme,<br/>Firemný Bufet</p>
  `;

  if (isConsoleMode) {
    console.log('=== REMINDER EMAIL (Console Mode) ===');
    console.log(`To: ${email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Balance: ${balanceEur.toFixed(2)} €`);
    console.log('=====================================');
    return;
  }

  await transporter!.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject,
    text,
    html,
  });
};
