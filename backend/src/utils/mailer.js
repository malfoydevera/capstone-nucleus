const axios = require('axios');

const EMAIL_WEBHOOK_URL = process.env.EMAIL_WEBHOOK_URL;
const EMAIL_SENDER = process.env.EMAIL_SENDER || 'noreply@nucleus.local';

const sendTransactionalEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject || (!text && !html)) {
    return { delivered: false, skipped: true, reason: 'INVALID_PAYLOAD' };
  }

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

    return { delivered: true, skipped: false };
  } catch (error) {
    console.error('Email delivery failed:', error.message);
    return { delivered: false, skipped: false, reason: 'DELIVERY_FAILED' };
  }
};

module.exports = {
  sendTransactionalEmail,
};
