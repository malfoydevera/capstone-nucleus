const jwt = require('jsonwebtoken');
const {
  authenticate,
  authorize,
  isFaculty,
  isStaffOrAdmin,
  isDean,
  isDeanOrProgramChair,
} = require('../../middleware/auth.middleware');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('auth.middleware', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
  });

  test('authenticate sets req.user for valid token', () => {
    const token = jwt.sign({ id: 'u1', role: 'student' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 'u1', role: 'student' });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('authenticate rejects when token is missing', () => {
    const req = { headers: {} };
    const res = createRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
  });

  test('authenticate rejects invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid' } };
    const res = createRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  test('authorize allows required role', () => {
    const req = { user: { role: 'staff' } };
    const res = createRes();
    const next = jest.fn();

    authorize('staff', 'admin')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  test('authorize blocks disallowed role', () => {
    const req = { user: { role: 'student' } };
    const res = createRes();
    const next = jest.fn();

    authorize('staff', 'admin')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
  });

  test('role helpers enforce expected access', () => {
    const res = createRes();
    const next = jest.fn();

    isFaculty({ user: { role: 'faculty' } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const res2 = createRes();
    const next2 = jest.fn();
    isStaffOrAdmin({ user: { role: 'student' } }, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(403);

    const res3 = createRes();
    const next3 = jest.fn();
    isDean({ user: { role: 'dean' } }, res3, next3);
    expect(next3).toHaveBeenCalledTimes(1);

    const res4 = createRes();
    const next4 = jest.fn();
    isDeanOrProgramChair({ user: { role: 'program_chair' } }, res4, next4);
    expect(next4).toHaveBeenCalledTimes(1);
  });
});
