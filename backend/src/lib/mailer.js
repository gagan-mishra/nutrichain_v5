const nodemailer = require('nodemailer');

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

function useResend() {
  return (process.env.MAIL_PROVIDER || '').toLowerCase() === 'resend' || !!process.env.RESEND_API_KEY;
}

function toBase64Content(content) {
  if (Buffer.isBuffer(content)) return content.toString('base64');
  if (content instanceof ArrayBuffer) return Buffer.from(content).toString('base64');
  if (ArrayBuffer.isView && ArrayBuffer.isView(content)) return Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString('base64');
  return content;
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

async function sendWithResend({ to, bcc, subject, text, html, attachments, replyTo }) {
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

async function sendWithSmtp({ to, bcc, subject, text, html, attachments, replyTo }) {
  const from = getFrom();
  if (!from) throw new Error('MAIL_FROM missing');
  const transporter = createSmtpTransport();
  const info = await transporter.sendMail({
    from,
    to: normalizeList(to).join(', ') || undefined,
    bcc: normalizeList(bcc).join(', ') || undefined,
    replyTo: replyTo || undefined,
    subject,
    text,
    html,
    attachments,
  });
  return { messageId: info?.messageId || null, raw: info };
}

async function sendMail({ to, bcc, subject, text, html, attachments }) {
  const replyTo = process.env.MAIL_REPLY_TO || '';
  if (useResend()) {
    return sendWithResend({ to, bcc, subject, text, html, attachments, replyTo });
  }
  return sendWithSmtp({ to, bcc, subject, text, html, attachments, replyTo });
}

module.exports = { sendMail };
