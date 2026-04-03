jest.mock('../../config/supabase', () => ({
  from: jest.fn(),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: null } })),
      createSignedUrl: jest.fn(),
    })),
  },
  getPublicFileUrl: jest.fn(() => null),
  createSignedFileUrl: jest.fn(async () => null),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

const express = require('express');
const request = require('supertest');
const authRoutes = require('../../routes/auth.routes');
const researchRoutes = require('../../routes/research.routes');

describe('route smoke tests', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/research', researchRoutes);

  test('protected auth route blocks missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  test('protected research route blocks missing token', async () => {
    const res = await request(app).get('/api/research/faculty/assigned');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

});
