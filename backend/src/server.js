const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const multer = require('multer');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/auth.routes');
const researchRoutes = require('./routes/research.routes');
const aiRoutes = require('./routes/ai.routes');
const departmentRoutes = require('./routes/department.routes');
dotenv.config();

// --- S-004: Startup validation for JWT_SECRET ---
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// --- M-004: Swagger / OpenAPI spec ---
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Capstone Research Repository API',
      version: '1.0.0',
      description: 'Backend API for the Capstone Research Repository Management System',
    },
    servers: [{ url: `/api`, description: 'API base' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [`${__dirname}/routes/*.js`],
});

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// --- S-001: HTTP Security Headers via helmet ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allow swagger-ui inline scripts on /api/docs
        scriptSrc:  ["'self'", "'unsafe-inline'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'blob:', '*.supabase.co'],
        connectSrc: ["'self'", '*.supabase.co', 'generativelanguage.googleapis.com'],
        frameSrc:   ["'none'"],
        objectSrc:  ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);

// --- S-002: Rate Limiting on auth routes ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again after 15 minutes.' },
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin denied'));
  },
  credentials: true,
}));
app.use(express.json());

// Apply rate limiter specifically to login and register
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/departments', departmentRoutes);

// M-004: Swagger UI at /api/docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get('/api/docs.json', (req, res) => { res.json(swaggerSpec); });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
    }
  }
  console.error('Server error:', err);
  // S-007: Don't leak internal error details in production
  const message = isProduction ? 'Internal server error' : (err.message || 'Server error');
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

