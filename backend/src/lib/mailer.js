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

function toBase64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function assertGmailApiProvider() {
  const provider = String(process.env.MAIL_PROVIDER || '').toLowerCase();
  if (provider !== 'gmail_api') {
    throw new Error("MAIL_PROVIDER must be 'gmail_api'");
  }
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

async function sendMail({ to, cc, bcc, subject, text, html, attachments }) {
  assertGmailApiProvider();

  const from = process.env.MAIL_FROM || '';
  if (!from) throw new Error('MAIL_FROM missing');

  const replyTo = process.env.MAIL_REPLY_TO || '';
  const extraBcc = process.env.MAIL_BCC_SELF || '';
  const mergedBcc = normalizeList(bcc).concat(normalizeList(extraBcc));

  const gmail = createGmailClient();
  const rawMime = await buildRawMime({
    from,
    to,
    cc,
    bcc: mergedBcc,
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

module.exports = { sendMail };
