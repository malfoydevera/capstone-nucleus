const { z } = require('zod');

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message },
      message,
      requestId: req.id,
    });
  }
  req.body = result.data;
  return next();
};

const authSchemas = {
  register: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.string(),
    firstName: z.string().min(1).optional(),
    middleName: z.string().optional(),
    lastName: z.string().min(1).optional(),
    fullName: z.string().optional(),
    departmentId: z.string().optional(),
    programId: z.string().optional(),
    department: z.string().optional(),
    program: z.string().optional(),
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  forgotPasswordRequest: z.object({
    email: z.string().email(),
  }),
  forgotPasswordConfirm: z.object({
    email: z.string().email(),
    code: z.string().min(6),
    newPassword: z.string().min(8),
  }),
};

module.exports = { validateBody, authSchemas };
