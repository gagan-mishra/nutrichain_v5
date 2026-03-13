const nodemailer = require('nodemailer');
const { google } = require('googleapis');

function normalizeList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  return String(v)
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getFrom() {
  return process.env.MAIL_FROM || process.env.SMTP_USER || '';
}

function selectedProvider() {
  return (process.env.MAIL_PROVIDER || '').toLowerCase();
}

function useGmailApi() {
  const provider = selectedProvider();
  if (provider === 'gmail_api') return true;
  return !!(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  );
}

function useResend() {
  return selectedProvider() === 'resend' || !!process.env.RESEND_API_KEY;
}

function toBase64Content(content) {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  if (content instanceof ArrayBuffer) return Buffer.from(content).toString('base64');
  if (ArrayBuffer.isView && ArrayBuffer.isView(content)) {
    return Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString('base64');
  }
  return content;
}

function toBase64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createSmtpTransport() {
  if (process.env.SMTP_SERVICE === 'gmail') {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP_USER / SMTP_PASS missing for Gmail transport');
    }
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  if (!process.env.SMTP_HOST) {
    throw new Error('SMTP_HOST missing for generic SMTP transport');
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function createGmailClient() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN are required for Gmail API');
  }

  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth });
}

async function buildRawMime({ from, to, cc, bcc, replyTo, subject, text, html, attachments }) {
  // streamTransport composes RFC822 MIME without opening SMTP connection.
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'unix',
  });

  const info = await transport.sendMail({
    from,
    to: normalizeList(to).join(', ') || undefined,
    cc: normalizeList(cc).join(', ') || undefined,
    bcc: normalizeList(bcc).join(', ') || undefined,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
    attachments,
  });

  return info.message;
}

async function sendWithGmailApi({ to, cc, bcc, subject, text, html, attachments, replyTo }) {
  const from = getFrom();
  if (!from) throw new Error('MAIL_FROM missing');

  const gmail = createGmailClient();
  const rawMime = await buildRawMime({
    from,
    to,
    cc,
    bcc,
    replyTo,
    subject,
    text,
    html,
    attachments,
  });

  const raw = toBase64Url(rawMime);
  const resp = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return { messageId: resp?.data?.id || null, raw: resp?.data || null };
}

async function sendWithResend({ to, cc, bcc, subject, text, html, attachments, replyTo }) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Use Node 18+ or add a fetch polyfill.');
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY missing');
  const from = getFrom();
  if (!from) throw new Error('MAIL_FROM missing');

  const payload = {
    from,
    to: normalizeList(to),
    subject,
    text,
    html,
  };
  const ccList = normalizeList(cc);
  if (ccList.length) payload.cc = ccList;
  const bccList = normalizeList(bcc);
  if (bccList.length) payload.bcc = bccList;
  if (replyTo) payload.reply_to = replyTo;
  if (attachments && attachments.length) {
    payload.attachments = attachments.map((a) => {
      const contentType = a.contentType || a.content_type || 'application/octet-stream';
      const content = toBase64Content(a.content);
      return {
        filename: a.filename,
        content,
        content_type: contentType,
      };
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(data)}`);
  }
  return { messageId: data?.id || null, raw: data };
}

async function sendWithSmtp({ to, cc, bcc, subject, text, html, attachments, replyTo }) {
  const from = getFrom();
  if (!from) throw new Error('MAIL_FROM missing');
  const transporter = createSmtpTransport();
  const info = await transporter.sendMail({
    from,
    to: normalizeList(to).join(', ') || undefined,
    cc: normalizeList(cc).join(', ') || undefined,
    bcc: normalizeList(bcc).join(', ') || undefined,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
    attachments,
  });
  return { messageId: info?.messageId || null, raw: info };
}

async function sendMail({ to, cc, bcc, subject, text, html, attachments }) {
  const replyTo = process.env.MAIL_REPLY_TO || '';
  const extraBcc = process.env.MAIL_BCC_SELF || '';
  const mergedBcc = normalizeList(bcc).concat(normalizeList(extraBcc));

  if (useGmailApi()) {
    return sendWithGmailApi({
      to,
      cc,
      bcc: mergedBcc,
      subject,
      text,
      html,
      attachments,
      replyTo,
    });
  }

  if (useResend()) {
    return sendWithResend({
      to,
      cc,
      bcc: mergedBcc,
      subject,
      text,
      html,
      attachments,
      replyTo,
    });
  }

  return sendWithSmtp({
    to,
    cc,
    bcc: mergedBcc,
    subject,
    text,
    html,
    attachments,
    replyTo,
  });
}

module.exports = { sendMail };
