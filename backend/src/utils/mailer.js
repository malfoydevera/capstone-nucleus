const axios = require('axios');

const EMAIL_WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';
const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || '').toLowerCase();
const EMAIL_SENDER = process.env.EMAIL_SENDER || 'noreply@nucleus.local';

const sendViaResend = async ({ to, subject, text, html }) => {
  if (!RESEND_API_KEY) {
    return { delivered: false, skipped: true, reason: 'RESEND_API_KEY_NOT_CONFIGURED' };
  }

  try {
    const response = await axios.post(
      RESEND_API_URL,
      {
        from: EMAIL_SENDER,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
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
    console.error('Resend delivery failed:', status || '', providerError || error.message);
    return {
      delivered: false,
      skipped: false,
      provider: 'resend',
      reason: 'DELIVERY_FAILED',
      status,
      providerError,
    };
  }
};

const sendViaWebhook = async ({ to, subject, text, html }) => {
  if (!EMAIL_WEBHOOK_URL) {
    return { delivered: false, skipped: true, reason: 'EMAIL_WEBHOOK_URL_NOT_CONFIGURED' };
  }

  try {
    await axios.post(
      EMAIL_WEBHOOK_URL,
      {
        from: EMAIL_SENDER,
        to,
        subject,
        text,
        html,
      },
      {
        timeout: 10000,
      }
    );

    return { delivered: true, skipped: false, provider: 'webhook' };
  } catch (error) {
    const status = error?.response?.status;
    const providerError = error?.response?.data;
    console.error('Webhook email delivery failed:', status || '', providerError || error.message);
    return {
      delivered: false,
      skipped: false,
      provider: 'webhook',
      reason: 'DELIVERY_FAILED',
      status,
      providerError,
    };
  }
};

const sendTransactionalEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject || (!text && !html)) {
    return { delivered: false, skipped: true, reason: 'INVALID_PAYLOAD' };
  }

  const resolvedProvider = EMAIL_PROVIDER || (RESEND_API_KEY ? 'resend' : 'webhook');

  if (resolvedProvider === 'resend') {
    return sendViaResend({ to, subject, text, html });
  }

  if (resolvedProvider === 'webhook') {
    return sendViaWebhook({ to, subject, text, html });
  }

  return { delivered: false, skipped: true, reason: 'EMAIL_PROVIDER_NOT_SUPPORTED' };
};

module.exports = {
  sendTransactionalEmail,
};
