const axios = require('axios');
const nodemailer = require('nodemailer');

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
const EMAIL_SENDER = process.env.EMAIL_SENDER || process.env.GMAIL_USER || 'noreply@nucleus.local';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

let gmailTransporter = null;

function getGmailTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return null;
  }

  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }

  return gmailTransporter;
}

function resolveFromAddress() {
  if (EMAIL_SENDER.includes('@')) {
    return EMAIL_SENDER;
  }

  if (GMAIL_USER) {
    return `NUCLEUS <${GMAIL_USER}>`;
  }

  return EMAIL_SENDER;
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

async function sendViaGmail({ to, subject, text, html }) {
  const transporter = getGmailTransporter();
  if (!transporter) {
    return {
      delivered: false,
      skipped: true,
      provider: 'gmail',
      reason: 'GMAIL_NOT_CONFIGURED',
      message:
        'Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env. ' +
        'Create an App Password at https://myaccount.google.com/apppasswords (requires 2-Step Verification).',
    };
  }

  try {
    const info = await transporter.sendMail({
      from: resolveFromAddress(),
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text: text || htmlToPlainText(html),
      html,
    });

    return {
      delivered: true,
      skipped: false,
      provider: 'gmail',
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Gmail delivery failed:', error.message);
    return {
      delivered: false,
      skipped: false,
      provider: 'gmail',
      reason: 'DELIVERY_FAILED',
      message: error.message,
    };
  }
}

async function sendViaResend({ to, subject, text, html }) {
  if (!RESEND_API_KEY) {
    return { delivered: false, skipped: true, provider: 'resend', reason: 'RESEND_API_KEY_NOT_CONFIGURED' };
  }

  try {
    const response = await axios.post(
      RESEND_API_URL,
      {
        from: resolveFromAddress(),
        to: Array.isArray(to) ? to : [to],
        subject,
        text: text || htmlToPlainText(html),
        html,
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return {
      delivered: true,
      skipped: false,
      provider: 'resend',
      messageId: response?.data?.id,
    };
  } catch (error) {
    const status = error?.response?.status;
    const providerError = error?.response?.data;
    const providerMessage = String(providerError?.message || error.message || '');
    const isSandboxSender = resolveFromAddress().includes('@resend.dev');
    const isSandboxRestriction =
      isSandboxSender &&
      (status === 403 ||
        /only send testing emails to your own email|verify a domain/i.test(providerMessage));

    console.error('Resend delivery failed:', status || '', providerError || error.message);

    if (isSandboxRestriction) {
      return {
        delivered: false,
        skipped: false,
        provider: 'resend',
        reason: 'RESEND_SANDBOX_RESTRICTION',
        status,
        providerError,
        message:
          'EMAIL_SENDER uses onboarding@resend.dev, which can only deliver to the Resend account owner. ' +
          'Switch to EMAIL_PROVIDER=gmail or verify a domain at https://resend.com/domains.',
      };
    }

    return {
      delivered: false,
      skipped: false,
      provider: 'resend',
      reason: 'DELIVERY_FAILED',
      status,
      providerError,
    };
  }
}

const sendTransactionalEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject || (!text && !html)) {
    return { delivered: false, skipped: true, reason: 'INVALID_PAYLOAD' };
  }

  if (EMAIL_PROVIDER === 'resend') {
    return sendViaResend({ to, subject, text, html });
  }

  return sendViaGmail({ to, subject, text, html });
};

module.exports = { sendTransactionalEmail };
