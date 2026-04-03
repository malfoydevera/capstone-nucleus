const { sendTransactionalEmail } = require('./mailer');
const { buildFullName } = require('./name');

const sendPaperStatusEmail = async ({ user, paperTitle, statusLabel, message }) => {
  if (!user?.email) return { delivered: false, skipped: true, reason: 'MISSING_EMAIL' };

  const recipientName = buildFullName(user) || user.email;
  const subject = `NUCLEUS Update: ${statusLabel}`;
  const text = [
    `Hello ${recipientName},`,
    '',
    `Your paper \"${paperTitle}\" has a new update: ${statusLabel}.`,
    message || '',
    '',
    'Please log in to NUCLEUS to view full details.',
  ]
    .filter(Boolean)
    .join('\n');

  return sendTransactionalEmail({
    to: user.email,
    subject,
    text,
  });
};

const sendReviewAssignmentEmail = async ({ user, paperTitle }) => {
  if (!user?.email) return { delivered: false, skipped: true, reason: 'MISSING_EMAIL' };

  const recipientName = buildFullName(user) || user.email;
  return sendTransactionalEmail({
    to: user.email,
    subject: 'NUCLEUS Review Assignment',
    text: `Hello ${recipientName},\n\nA paper titled \"${paperTitle}\" is ready for your review.\n\nPlease log in to NUCLEUS to continue.`,
  });
};

module.exports = {
  sendPaperStatusEmail,
  sendReviewAssignmentEmail,
};
