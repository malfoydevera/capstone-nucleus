const PASSWORD_MIN_LENGTH = 8;

// Keep this in sync with the frontend policy in
// frontend/src/utils/passwordPolicy.js
function validatePasswordStrength(password) {
  const value = String(password || '');

  if (value.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` };
  }
  if (!/[A-Za-z]/.test(value)) {
    return { valid: false, message: 'Password must include at least one letter' };
  }
  if (!/[0-9]/.test(value)) {
    return { valid: false, message: 'Password must include at least one number' };
  }

  return { valid: true, message: '' };
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  validatePasswordStrength,
};
