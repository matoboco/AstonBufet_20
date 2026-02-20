import { connect } from 'cloudflare:sockets';
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

// --- Minimal SMTP client using Cloudflare Workers TCP sockets ---

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readResponse(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<{ code: number; text: string }> {
  let full = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    // SMTP multi-line responses have '-' after code, last line has ' '
    const lines = full.split('\r\n').filter(l => l.length > 0);
    const lastLine = lines[lines.length - 1];
    if (lastLine && lastLine.length >= 4 && lastLine[3] === ' ') {
      break;
    }
  }
  const code = parseInt(full.substring(0, 3), 10);
  return { code, text: full.trim() };
}

async function sendCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  command: string
): Promise<{ code: number; text: string }> {
  await writer.write(encoder.encode(command + '\r\n'));
  return readResponse(reader);
}

function buildMimeMessage(from: string, to: string, subject: string, text: string, html: string): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@aston.sk>`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(text))),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(html))),
    '',
    `--${boundary}--`,
    '',
  ];

  return headers.join('\r\n');
}

/**
 * Send SMTP commands over a given writer/reader pair.
 * Handles EHLO, optional AUTH LOGIN, MAIL FROM, RCPT TO, DATA, QUIT.
 */
async function smtpSession(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  from: string,
  to: string,
  subject: string,
  text: string,
  html: string,
  user?: string,
  pass?: string,
): Promise<void> {
  // EHLO
  let resp = await sendCommand(writer, reader, 'EHLO worker.cloudflare.com');
  if (resp.code !== 250) throw new Error(`EHLO failed: ${resp.text}`);

  // AUTH LOGIN if credentials provided
  if (user && pass) {
    resp = await sendCommand(writer, reader, 'AUTH LOGIN');
    if (resp.code !== 334) throw new Error(`AUTH LOGIN failed: ${resp.text}`);
    resp = await sendCommand(writer, reader, btoa(user));
    if (resp.code !== 334) throw new Error(`AUTH username failed: ${resp.text}`);
    resp = await sendCommand(writer, reader, btoa(pass));
    if (resp.code !== 235) throw new Error(`AUTH password failed: ${resp.text}`);
  }

  // MAIL FROM
  resp = await sendCommand(writer, reader, `MAIL FROM:<${from}>`);
  if (resp.code !== 250) throw new Error(`MAIL FROM failed: ${resp.text}`);

  // RCPT TO
  resp = await sendCommand(writer, reader, `RCPT TO:<${to}>`);
  if (resp.code !== 250) throw new Error(`RCPT TO failed: ${resp.text}`);

  // DATA
  resp = await sendCommand(writer, reader, 'DATA');
  if (resp.code !== 354) throw new Error(`DATA failed: ${resp.text}`);

  // Send MIME message, terminated with <CR><LF>.<CR><LF>
  const message = buildMimeMessage(from, to, subject, text, html);
  await writer.write(encoder.encode(message + '\r\n.\r\n'));
  resp = await readResponse(reader);
  if (resp.code !== 250) throw new Error(`Message send failed: ${resp.text}`);

  // QUIT
  await sendCommand(writer, reader, 'QUIT');
}

async function sendViaSMTP(
  env: Env,
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const host = env.SMTP_HOST!;
  const port = parseInt(env.SMTP_PORT || '587', 10);
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASS;
  const from = env.SMTP_FROM || 'noreply@aston.sk';
  const secure = port === 465;

  // Connect via TCP socket (implicit TLS for port 465)
  const socket = connect({
    hostname: host,
    port,
  }, {
    secureTransport: secure ? 'on' : 'off',
    allowHalfOpen: false,
  });

  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();

  try {
    // Read server greeting
    const greeting = await readResponse(reader);
    if (greeting.code !== 220) throw new Error(`SMTP greeting failed: ${greeting.text}`);

    // Check if STARTTLS is needed (port 587)
    if (!secure) {
      // EHLO first to discover capabilities
      let resp = await sendCommand(writer, reader, 'EHLO worker.cloudflare.com');
      if (resp.code !== 250) throw new Error(`EHLO failed: ${resp.text}`);

      if (resp.text.includes('STARTTLS')) {
        resp = await sendCommand(writer, reader, 'STARTTLS');
        if (resp.code !== 220) throw new Error(`STARTTLS failed: ${resp.text}`);

        // Upgrade to TLS and use new streams
        const tlsSocket = socket.startTls();
        const tlsWriter = tlsSocket.writable.getWriter();
        const tlsReader = tlsSocket.readable.getReader();

        try {
          await smtpSession(tlsWriter, tlsReader, from, to, subject, text, html, user, pass);
        } finally {
          tlsWriter.releaseLock();
          tlsReader.releaseLock();
        }
        return;
      }

      // No STARTTLS available on plain connection — proceed without TLS
      // We already did EHLO, so go straight to AUTH + send
      if (user && pass) {
        resp = await sendCommand(writer, reader, 'AUTH LOGIN');
        if (resp.code !== 334) throw new Error(`AUTH LOGIN failed: ${resp.text}`);
        resp = await sendCommand(writer, reader, btoa(user));
        if (resp.code !== 334) throw new Error(`AUTH username failed: ${resp.text}`);
        resp = await sendCommand(writer, reader, btoa(pass));
        if (resp.code !== 235) throw new Error(`AUTH password failed: ${resp.text}`);
      }

      resp = await sendCommand(writer, reader, `MAIL FROM:<${from}>`);
      if (resp.code !== 250) throw new Error(`MAIL FROM failed: ${resp.text}`);
      resp = await sendCommand(writer, reader, `RCPT TO:<${to}>`);
      if (resp.code !== 250) throw new Error(`RCPT TO failed: ${resp.text}`);
      resp = await sendCommand(writer, reader, 'DATA');
      if (resp.code !== 354) throw new Error(`DATA failed: ${resp.text}`);

      const message = buildMimeMessage(from, to, subject, text, html);
      await writer.write(encoder.encode(message + '\r\n.\r\n'));
      resp = await readResponse(reader);
      if (resp.code !== 250) throw new Error(`Message send failed: ${resp.text}`);
      await sendCommand(writer, reader, 'QUIT');
    } else {
      // Implicit TLS (port 465) — already encrypted
      await smtpSession(writer, reader, from, to, subject, text, html, user, pass);
    }
  } finally {
    writer.releaseLock();
    reader.releaseLock();
    socket.close();
  }
}

// --- Main sendEmail dispatcher ---

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

  if (!env.SMTP_HOST) {
    throw new Error('SMTP_HOST is not configured');
  }

  await sendViaSMTP(env, to, subject, text, html);
  console.log(`SMTP email sent to ${to} via ${env.SMTP_HOST}:${env.SMTP_PORT || 587}`);
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
