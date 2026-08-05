const {
  validateRecoveryEmail,
  isInstitutionalEmail,
  getStudentDomains,
  getStaffDomains,
} = require('../../utils/emailDomain');

describe('emailDomain', () => {
  const originalStudent = process.env.STUDENT_EMAIL_DOMAINS;
  const originalStaff = process.env.STAFF_EMAIL_DOMAINS;

  afterEach(() => {
    if (originalStudent === undefined) delete process.env.STUDENT_EMAIL_DOMAINS;
    else process.env.STUDENT_EMAIL_DOMAINS = originalStudent;

    if (originalStaff === undefined) delete process.env.STAFF_EMAIL_DOMAINS;
    else process.env.STAFF_EMAIL_DOMAINS = originalStaff;
  });

  test('accepts a personal Gmail address as recovery email', () => {
    process.env.STUDENT_EMAIL_DOMAINS = 'students.nu-dasma.edu.ph';
    process.env.STAFF_EMAIL_DOMAINS = 'nu-dasma.edu.ph';

    const result = validateRecoveryEmail(
      'malfoydevera3@gmail.com',
      'william@students.nu-dasma.edu.ph'
    );

    expect(result.valid).toBe(true);
  });

  test('rejects institutional domain as recovery email', () => {
    process.env.STUDENT_EMAIL_DOMAINS = 'students.nu-dasma.edu.ph';
    process.env.STAFF_EMAIL_DOMAINS = 'nu-dasma.edu.ph';

    const result = validateRecoveryEmail(
      'william@students.nu-dasma.edu.ph',
      'other@students.nu-dasma.edu.ph'
    );

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/personal inbox/i);
  });

  test('ignores consumer domains misconfigured in institutional allowlists', () => {
    process.env.STUDENT_EMAIL_DOMAINS = 'students.nu-dasma.edu.ph,gmail.com';
    process.env.STAFF_EMAIL_DOMAINS = 'nu-dasma.edu.ph,yahoo.com';

    expect(getStudentDomains()).toEqual(['students.nu-dasma.edu.ph']);
    expect(getStaffDomains()).toEqual(['nu-dasma.edu.ph']);
    expect(isInstitutionalEmail('you@gmail.com')).toBe(false);

    const result = validateRecoveryEmail(
      'you@gmail.com',
      'student@students.nu-dasma.edu.ph'
    );
    expect(result.valid).toBe(true);
  });
});
