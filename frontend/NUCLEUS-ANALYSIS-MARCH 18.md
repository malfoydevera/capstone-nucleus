# Capstone Research Repository — ISO-Compliant Web System Analysis

**Project**: Capstone Research Repository Management System  
**Analysis Date**: March 18, 2026  
**Analyst**: Antigravity AI — Automated Code & Architecture Review  
**Standards Applied**: ISO/IEC 25010 · ISO/IEC 29119 · ISO 27001 · ISO 9001  

---

## Executive Summary

| Dimension | Score (1–5) | Status |
|---|---|---|
| Overall System Health | **3.8 / 5** | 🟡 Conditional Go |
| Functional Suitability | **4.5 / 5** | ✅ Strong |
| Security | **3.0 / 5** | 🟠 Needs Work |
| Maintainability | **3.2 / 5** | 🟡 Partial |
| Performance Efficiency | **3.3 / 5** | 🟡 Partial |
| Reliability | **3.5 / 5** | 🟡 Partial |
| Usability | **4.0 / 5** | ✅ Good |
| Portability | **3.5 / 5** | 🟡 Partial |
| Compatibility | **3.5 / 5** | 🟡 Partial |

**Deployment Recommendation**: **🟡 CONDITIONAL GO** — The system is functionally complete and demonstrates solid architecture, but three security gaps (missing HTTP security headers, no rate limiting, debug information leaking in production) must be addressed before production deployment.

### Key Strengths
- Sophisticated 6-role RBAC with Dean bypass and Program Chair workflows
- Google Gemini AI integration for document analysis with graceful fallback
- Centralized audit logging utility (`audit.js`) and response standardization (`response.js`)
- Clean MVC backend with clear separation of concerns across 4 controllers and 4 route files
- Frontend route protection enforced at both React Router level and API middleware level (defense-in-depth on routing)

### Critical Priorities (Pre-Deployment)
1. 🔴 **No HTTP Security Headers** — Missing `helmet` middleware on Express server
2. 🔴 **No Rate Limiting** — Login endpoint is open to brute-force attacks
3. 🟠 **Debug Logs in Production Code** — `console.log` calls throughout `ai.controller.js` expose internal details
4. 🟠 **Near-Zero Test Coverage** — Only 1 workflow test file exists; no unit or integration tests for controllers
5. 🟡 **No Error Boundaries in React** — Unhandled runtime errors will crash the entire UI

---

## 1. System Overview

### 1.1 Purpose & Audience
The system is an **Academic Research Repository Management System** that digitizes and enforces a multi-tier paper review and publication workflow for a higher education institution.

**User Roles (6 total)**:
| Role | Primary Function |
|---|---|
| Student | Submit research, track status, browse repository |
| Faculty (Adviser) | First-tier review: approve / reject / revise |
| Dean | Oversight, bypass approval, activity monitoring, audit logs |
| Program Chair | Second-tier review alongside Dean |
| Staff (Editor) | Editorial review, workflow management |
| Admin | Super-user: full CRUD, analytics, user management |

### 1.2 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| Styling | Tailwind CSS | 4.1.18 |
| Routing | React Router DOM | 7.11.0 |
| Animations | Framer Motion | 12.33.0 |
| PDF Viewing | react-pdf | 10.3.0 |
| Backend Framework | Express.js | 5.2.1 |
| Runtime | Node.js | (latest LTS) |
| Authentication | JWT (jsonwebtoken 9.0.3) + bcryptjs 3.0.3 |
| Database & Storage | Supabase (PostgreSQL + File Storage) |
| AI Integration | Google Gemini (`@google/generative-ai` 0.24.1) |
| Azure Auth | `@azure/msal-node` / `@azure/msal-browser` (optional) |
| Testing | Jest 30.0.5 + Supertest 7.1.1 |

### 1.3 Architecture
```
Browser (React SPA)
    │ HTTPS
    ▼
Express.js API Server (Node.js)
    ├── /api/auth       → auth.controller.js
    ├── /api/research   → research.controller.js (62KB — largest file)
    ├── /api/ai         → ai.controller.js
    └── /api/departments → department.controller.js
    │
    ▼
Supabase (PostgreSQL + Row Level Security + Storage)
    │
    ▼
Google Gemini AI (External)
```

---

## 2. Functional Testing Assessment

### 2.1 Core Functionality — Findings

| Feature | Status | Notes |
|---|---|---|
| Student submission (PDF + metadata) | ✅ Implemented | Multer memory storage, 10MB limit, PDF-only filter |
| Multi-tier review workflow (Faculty → Dean/Chair → Staff → Admin) | ✅ Implemented | Well-structured route protection per stage |
| Dean bypass approval | ✅ Implemented | Dedicated `deanBypassApprove` controller + route |
| Admin publish/unpublish | ✅ Implemented | Separate`adminPublishResearch`/`adminUnpublishResearch` |
| Co-author management | ✅ Implemented | `research_authors` junction table |
| AI-powered PDF Q&A (Gemini) | ✅ Implemented | With graceful failure and access control via `canAccessPaper()` |
| AI PDF metadata extraction | ✅ Implemented | Title/abstract extraction on upload |
| Audit logging | ✅ Implemented | `logAuditEvent()` used in login; needs expansion |
| Annotation on papers | ✅ Implemented | Add/delete annotations, role-restricted |
| Download + view tracking | ✅ Implemented | `trackView` and `trackDownload` endpoints |
| User management (Admin) | ✅ Implemented | CRUD with privileged user creation |
| Analytics (Admin) | ✅ Implemented | `AdminAnalytics` page |
| Activity monitoring (Dean) | ✅ Implemented | `DeanActivityMonitor` page |
| Secure PDF Viewer | ✅ Implemented | Right-click/copy-paste prevention, watermarking |

### 2.2 Identified Functional Issues

#### Finding F-001 — Login Email Not Normalized Before DB Lookup
- **Severity**: Medium | **Priority**: P2
- **Location**: `auth.controller.js` — `login()` at line 110
- **Issue**: On registration, email is normalized to lowercase (`normalizedEmail`). On login, the raw `email` is passed directly to Supabase `.eq('email', email)` without lowercase conversion.
- **Impact**: Users who register with `User@Domain.com` cannot log in with `user@domain.com`.
- **Fix**: Add `email.toLowerCase().trim()` in the login query, matching the registration pattern.

#### Finding F-002 — `research.controller.js` File Size (62KB)
- **Severity**: Low | **Priority**: P3
- **Location**: `backend/src/controllers/research.controller.js`
- **Issue**: At 62KB, this single file likely contains 1,000+ lines. This violates Single Responsibility and makes maintenance risky.
- **Impact**: Increased cognitive load, merge conflicts in team environments, harder to test.
- **Fix**: Split into `submission.controller.js`, `review.controller.js`, `admin.controller.js`, `annotation.controller.js`.

#### Finding F-003 — Public Route Exposes All Published Research Without Auth
- **Severity**: Low | **Priority**: P3
- **Location**: `research.routes.js` line 24 — `router.get('/published', ...getPublishedResearch)`
- **Issue**: Published research is accessible without any authentication token.
- **Impact**: Acceptable for a public repository, but if the institution requires all access to be authenticated, this should be gated.
- **Recommendation**: Confirm with stakeholders whether unauthenticated browsing is intentional.

---

## 3. Security Assessment (ISO 27001 Aligned)

### 3.1 Security Findings Register

#### Finding S-001 — Missing HTTP Security Headers 🔴 CRITICAL
- **Severity**: Critical | **Priority**: P0 | **ISO 27001 Control**: A.14.1.2
- **Evidence**: `server.js` uses only `cors` and `express.json()`. No `helmet` middleware.
- **Missing Headers**:
  - `Content-Security-Policy` — XSS prevention
  - `Strict-Transport-Security` (HSTS) — forces HTTPS
  - `X-Frame-Options` — clickjacking protection
  - `X-Content-Type-Options: nosniff` — MIME sniffing prevention
  - `Referrer-Policy`
  - `Permissions-Policy`
- **Fix**: Install and configure `helmet`:
```javascript
const helmet = require('helmet');
app.use(helmet());
// Customize CSP as needed for Supabase, Gemini origins
```
- **Effort**: 1–2 hours

#### Finding S-002 — No Rate Limiting on Authentication Endpoints 🔴 CRITICAL
- **Severity**: Critical | **Priority**: P0 | **ISO 27001 Control**: A.9.4.2
- **Evidence**: `/api/auth` routes have no rate limiting. An attacker can brute-force passwords indefinitely.
- **Fix**: Install `express-rate-limit`:
```javascript
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```
- **Effort**: 2–3 hours

#### Finding S-003 — Debug Information Leaking in Production 🟠 HIGH
- **Severity**: High | **Priority**: P1 | **ISO 27001 Control**: A.12.4.1
- **Evidence**: `ai.controller.js` contains 20+ `console.log` statements including:
  - File URLs: `console.log('Fetching PDF from:', fileUrl);`
  - Buffer sizes, PDF text previews, stack traces: `console.error('Error stack:', error.stack)`
- **Impact**: Sensitive file URLs, user data, internal logic, and stack traces are written to server logs, which may be accessible to unauthorized parties.
- **Fix**: Replace `console.log/error` with a structured logger (e.g., `winston` or `pino`) configured to suppress debug output in `NODE_ENV=production`. Apply to all controllers.
- **Effort**: 4–6 hours

#### Finding S-004 — JWT Secret Strength Not Validated 🟠 HIGH
- **Severity**: High | **Priority**: P1
- **Evidence**: `jwt.sign({ id, email, role }, process.env.JWT_SECRET, { expiresIn: '7d' })`. No startup validation ensures `JWT_SECRET` is sufficiently long/random.
- **Impact**: A weak secret (e.g., `"secret"`) makes tokens forgeable.
- **Fix**: Add startup validation: `if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters')`.

#### Finding S-005 — 7-Day JWT Expiry Without Refresh Token 🟡 MEDIUM
- **Severity**: Medium | **Priority**: P2
- **Evidence**: `expiresIn: '7d'` with token stored in `sessionStorage`.
- **Impact**: A stolen token is valid for up to 7 days. There is no token revocation or refresh mechanism.
- **Fix (Option A)**: Reduce JWT expiry to 1–2 hours + implement refresh token rotation.  
- **Fix (Option B)**: Implement a token denylist in Supabase for logout/revocation.

#### Finding S-006 — Password Minimum Length is Only 6 Characters 🟡 MEDIUM
- **Severity**: Medium | **Priority**: P2 | **ISO 27001 Control**: A.9.3.1
- **Evidence**: `auth.controller.js` lines 35 and 259: `if (String(password).length < 6)`.
- **Fix**: Enforce a minimum of 8–12 characters and add complexity rules (uppercase, number, special character) matching NIST SP 800-63B guidelines.

#### Finding S-007 — Error Details Exposed in API Responses 🟡 MEDIUM
- **Severity**: Medium | **Priority**: P2
- **Evidence**: Multiple catch blocks return `error.message` directly to clients, e.g., `sendError(res, { ..., details: error.message })` in `ai.controller.js`.
- **Impact**: Internal implementation details (file paths, DB schema hints, library names) exposed to clients.
- **Fix**: Log full error internally; return only generic messages to clients in production.

#### Summary: ISO 27001 Compliance Status

| Control Area | Status | Gap |
|---|---|---|
| Access Control (A.9) | 🟡 Partial | Missing rate limiting, weak password policy |
| Cryptography (A.10) | 🟡 Partial | Bcrypt ✅, JWT expiry risk, no HTTPS enforcement |
| Operations Security (A.12) | 🟠 Gap | Debug logs in production |
| Communications Security (A.13) | 🔴 Gap | No HSTS, no CSP headers |
| System Acquisition (A.14) | 🟡 Partial | No security scanning in CI pipeline |
| Incident Management (A.16) | 🟡 Partial | Audit logs exist but incomplete coverage |
| Business Continuity (A.17) | 🔴 Not Defined | No documented backup/recovery plan |

---

## 4. Performance Assessment

### 4.1 Findings

#### Finding P-001 — No Caching Strategy 🟡 MEDIUM
- **Severity**: Medium | **Priority**: P2
- **Issue**: Every API request queries Supabase directly. Frequently accessed data (published research list, categories, faculty members) is re-fetched on every load.
- **Fix**: Implement in-memory caching for static/semi-static data (categories, faculty list) using `node-cache` or Redis. Cache published research list with a 5-minute TTL.

#### Finding P-002 — No Database Indexing Defined in Codebase 🟡 MEDIUM
- **Severity**: Medium | **Priority**: P2
- **Issue**: No migration file defines indexes on `research_papers`. High-query columns like `status`, `author_id`, `faculty_id`, and `department` should be indexed.
- **Fix**: Add migration:
```sql
CREATE INDEX idx_research_papers_status ON research_papers(status);
CREATE INDEX idx_research_papers_author_id ON research_papers(author_id);
CREATE INDEX idx_research_papers_faculty_id ON research_papers(faculty_id);
```

#### Finding P-003 — No Code Splitting in Frontend 🟡 MEDIUM
- **Severity**: Low | **Priority**: P3
- **Issue**: All 20+ page components are eagerly imported in `App.jsx`. The initial bundle will include code for all roles even if only one role ever logs in.
- **Fix**: Use React `lazy()` + `Suspense` for role-specific page routes.

#### Finding P-004 — AI Chat Blocks on Full PDF Download Per Request 🟠 HIGH
- **Severity**: High | **Priority**: P2
- **Issue**: Every AI chat message downloads the full PDF, parses it, and sends it to Gemini. For a 10MB PDF, this is a high-latency, high-bandwidth operation per message.
- **Fix**: Cache the extracted PDF text server-side (keyed by `paperId`) for the duration of a session. Store in memory or Redis with TTL.

---

## 5. Maintainability Assessment (ISO/IEC 25010)

### 5.1 Positive Observations
- ✅ Centralized response utility (`utils/response.js`) ensures consistent API responses
- ✅ Centralized file access utility (`utils/fileAccess.js`) with `canAccessPaper()` for DRY access control
- ✅ Centralized audit logging (`utils/audit.js`) already in place
- ✅ Workflow policy abstraction (`utils/workflowPolicy.js`) for stage transitions
- ✅ Clean MVC separation in backend

### 5.2 Findings

#### Finding M-001 — Near-Zero Automated Test Coverage 🔴 CRITICAL
- **Severity**: High | **Priority**: P1 | **ISO 29119 Reference**: Test Strategy
- **Evidence**: Only 1 test file found: `__tests__/controllers/research.workflow.test.js` (4.7KB). No unit tests for `auth.controller.js`, `ai.controller.js`, no middleware tests, no frontend tests.
- **Impact**: Changes to the 6-role workflow risk silent regressions. The Dean bypass feature and audit logging are completely untested.
- **Target**: 80% unit coverage per ISO 29119 recommendations.

#### Finding M-002 — No Frontend Testing Framework Configured
- **Severity**: High | **Priority**: P1
- **Evidence**: `frontend/package.json` has no testing dependencies (no Vitest, Jest, React Testing Library, Playwright, or Cypress).
- **Fix**: Add Vitest + React Testing Library for unit/component tests; add Playwright for E2E critical-path tests.

#### Finding M-003 — No React Error Boundaries 🟠 HIGH
- **Severity**: High | **Priority**: P1
- **Evidence**: `App.jsx` and no other component wraps children in an `ErrorBoundary`. A runtime error in any component (e.g., malformed API response) will crash the entire SPA.
- **Fix**: Wrap major layout sections and the `DashboardRouter` in an `ErrorBoundary` component.

#### Finding M-004 — No API Documentation (OpenAPI/Swagger)
- **Severity**: Medium | **Priority**: P2
- **Issue**: 29 backend endpoints across 4 route files with no Swagger/OpenAPI specification. Makes onboarding, testing, and client integration difficult.
- **Fix**: Add `swagger-ui-express` + `swagger-jsdoc`. Annotate existing routes. Publish at `/api/docs`.

---

## 6. ISO/IEC 25010 Quality Scorecard

| Quality Characteristic | Score (1–5) | Key Evidence |
|---|---|---|
| **Functional Suitability** | **4.5** | All core features implemented; minor login email bug |
| **Performance Efficiency** | **3.0** | No caching, no indexing, PDF re-download per AI message |
| **Compatibility** | **3.5** | Vite+React SPA; no PWA; MSAL optional but present |
| **Usability** | **4.0** | Role-based dashboards, loading states, Framer Motion UX |
| **Reliability** | **3.5** | Error handling in place; no error boundaries in React |
| **Security** | **3.0** | RBAC ✅, bcrypt ✅; missing headers 🔴, no rate limit 🔴 |
| **Maintainability** | **3.2** | Clean utilities; 62KB controller; near-zero test coverage |
| **Portability** | **3.5** | Environment-driven config; no Docker/containerization |

---

## 7. ISO/IEC 29119 Testing Assessment

### 7.1 Current Testing State

| Test Level | Status | Files Found |
|---|---|---|
| Unit Tests (Backend) | 🔴 Missing | 0 |
| Unit Tests (Frontend) | 🔴 Missing | 0 |
| Integration Tests | 🟡 1 File | `research.workflow.test.js` |
| E2E Tests | 🔴 Missing | 0 |
| Performance Tests | 🔴 Missing | 0 |
| Security Tests | 🔴 Missing | 0 |

**Estimated Current Coverage**: < 5%  
**Target Coverage**: ≥ 80% (unit), ≥ 70% (integration), 100% (critical paths)

### 7.2 Recommended Test Plan (ISO 29119 Aligned)

#### Phase 1 — Critical Path Unit Tests (P0/P1)
Test IDs and objectives for immediate implementation:

| Test ID | Scope | Objective |
|---|---|---|
| TC-AUTH-001 | `auth.controller` — `register()` | Reject duplicate emails, enforce role=student |
| TC-AUTH-002 | `auth.controller` — `login()` | Valid credentials return JWT; invalid return 401 |
| TC-AUTH-003 | `auth.middleware` — `authenticate()` | Reject missing/expired/tampered tokens |
| TC-AUTH-004 | `auth.middleware` — `authorize()` | Reject wrong roles; allow correct roles |
| TC-RES-001 | `research.controller` — `submitResearch()` | PDF-only validation, 10MB limit |
| TC-RES-002 | Workflow — Faculty approve | Status transitions to `pending_staff_review` |
| TC-RES-003 | Workflow — Dean bypass | Status transitions directly to `approved` |
| TC-RES-004 | `research.controller` — `adminDeleteResearch()` | Only admin can delete |
| TC-AI-001 | `ai.controller` — `chatWithPaper()` | Returns 403 for unauthorized access |

#### Phase 2 — Integration Tests (P1)
- Auth flow: register → login → access protected route → logout
- Submission flow: student submits → faculty approves → staff approves → admin publishes
- Dean bypass: dean approves → paper published immediately

#### Phase 3 — E2E Tests with Playwright (P2)
- Happy path: student submits paper, all stages approve, paper appears in repository
- Rejection path: paper rejected at faculty stage, student sees rejection reason
- AI chat: user opens approved paper, sends question, receives AI response

### 7.3 Defect Register (ISO 29119 — Incident Reports)

| ID | Severity | Priority | Summary | Status |
|---|---|---|---|---|
| S-001 | Critical | P0 | Missing HTTP security headers (helmet) | Open |
| S-002 | Critical | P0 | No rate limiting on auth endpoints | Open |
| S-003 | High | P1 | Debug logs leaking in production | Open |
| S-004 | High | P1 | JWT secret strength not validated at startup | Open |
| M-001 | High | P1 | Near-zero automated test coverage | Open |
| M-002 | High | P1 | No frontend testing framework | Open |
| M-003 | High | P1 | No React error boundaries | Open |
| F-001 | Medium | P2 | Login email not normalized (case sensitivity) | Open |
| S-005 | Medium | P2 | 7-day JWT with no refresh/revocation | Open |
| S-006 | Medium | P2 | Password minimum only 6 characters | Open |
| S-007 | Medium | P2 | Error details exposed in API responses | Open |
| P-001 | Medium | P2 | No caching strategy | Open |
| P-002 | Medium | P2 | No database indexes defined | Open |
| P-004 | High | P2 | AI chat re-downloads PDF on every message | Open |
| M-004 | Medium | P2 | No API documentation (Swagger) | Open |
| P-003 | Low | P3 | No code splitting / lazy loading in frontend | Open |
| F-002 | Low | P3 | research.controller.js is 62KB (too large) | Open |

---

## 8. Deployment Readiness Assessment

### 8.1 Pre-Deployment Checklist

**Application Readiness**
- [x] Core features implemented and functional
- [x] Role-based access control enforced at API and UI level
- [x] File upload validation (PDF-only, 10MB)
- [x] Environment-based configuration (`.env` files)
- [ ] ❌ All P0/P1 security defects resolved
- [ ] ❌ Minimum test coverage achieved (80%)
- [ ] ❌ Error boundaries implemented in frontend
- [ ] ❌ Production logging configured (replace `console.log`)
- [ ] ❌ Security headers configured (helmet)
- [ ] ❌ Rate limiting enabled

**Infrastructure Readiness**
- [x] Supabase PostgreSQL + Storage configured
- [x] CORS restricted to allowed origins
- [ ] ❌ SSL/TLS enforced at application level (HSTS header)
- [ ] ❌ CDN for static assets
- [ ] ❌ Monitoring and alerting
- [ ] ❌ Database backup schedule documented
- [ ] ❌ Containerization (Docker)

**Documentation Readiness**
- [x] `SYSTEM_ANALYSIS.md` — Architecture overview
- [ ] ❌ API documentation (Swagger/OpenAPI)
- [ ] ❌ Deployment runbook
- [ ] ❌ Rollback procedures
- [ ] ❌ Disaster recovery plan
- [ ] ❌ User guide / help documentation

**Compliance**
- [x] Audit logging foundation in place (`utils/audit.js`)
- [x] Bcrypt password hashing (10 salt rounds)
- [x] JWT authentication with role claims
- [ ] ❌ Complete ISO 27001 information security policy
- [ ] ❌ Security vulnerability scan
- [ ] ❌ Data retention policy documented

### 8.2 Go / No-Go Decision

```
Recommendation: 🟡 CONDITIONAL GO

Conditions required before production deployment:
1. [P0] Install and configure helmet (HTTP security headers)
2. [P0] Add rate limiting to /api/auth/login and /api/auth/register
3. [P1] Replace console.log with structured logger; suppress debug in production
4. [P1] Add startup validation for JWT_SECRET length
5. [P1] Implement React Error Boundaries in App.jsx
```

---

## 9. Action Plan

### Immediate (Pre-Deployment, 1–2 weeks)

| # | Action | Effort | Owner |
|---|---|---|---|
| 1 | Install `helmet`, configure CSP for Supabase/Gemini origins | 2h | Backend Dev |
| 2 | Install `express-rate-limit` on auth routes | 2h | Backend Dev |
| 3 | Replace `console.log` with `winston`/`pino` logger | 6h | Backend Dev |
| 4 | Add JWT_SECRET startup validation | 1h | Backend Dev |
| 5 | Add React `ErrorBoundary` component, wrap `DashboardLayout` | 3h | Frontend Dev |
| 6 | Fix login email normalization (lowercase before DB query) | 30min | Backend Dev |
| 7 | Increase password minimum to 8 chars | 30min | Backend Dev |

### Short-Term (0–3 months)

| # | Action | Effort |
|---|---|---|
| 1 | Write unit tests for auth & research controllers (target 80%) | 2–3 weeks |
| 2 | Add Vitest + React Testing Library to frontend | 1 week |
| 3 | Add Playwright E2E tests for 3 critical paths | 1 week |
| 4 | Add Swagger/OpenAPI documentation | 1 week |
| 5 | Implement server-side PDF text caching for AI chat | 3 days |
| 6 | Add database indexes for `status`, `author_id`, `faculty_id` | 1 day |
| 7 | Implement refresh token pattern (reduce JWT to 1–2h TTL) | 3 days |
| 8 | Add audit log events for all sensitive actions (not just login) | 2 days |

### Medium-Term (3–6 months)

| # | Action |
|---|---|
| 1 | Split `research.controller.js` into 4 smaller controllers |
| 2 | Implement Redis caching for published research list and categories |
| 3 | Add React lazy loading for role-specific page components |
| 4 | Add 2FA/MFA for admin and dean accounts |
| 5 | Add API monitoring via Sentry or Datadog |
| 6 | Containerize with Docker + docker-compose for consistent deployments |

### Long-Term (6–12 months)

| # | Action |
|---|---|
| 1 | CI/CD pipeline (GitHub Actions) with automated testing + security scanning |
| 2 | Progressive Web App (PWA) capabilities |
| 3 | Plagiarism detection integration |
| 4 | Research recommendation engine (AI-powered) |
| 5 | Multi-language (i18n) support |

---

## 10. Feature Recommendations (Priority Matrix)

| Feature | User Impact | Effort | Priority | Phase |
|---|---|---|---|---|
| HTTP Security Headers | High (security) | Low | **Quick Win** | Pre-deploy |
| Rate Limiting | High (security) | Low | **Quick Win** | Pre-deploy |
| Structured Logging | High (ops) | Low | **Quick Win** | Pre-deploy |
| React Error Boundaries | High (reliability) | Low | **Quick Win** | Pre-deploy |
| Automated Test Suite | High (quality) | High | **Strategic** | 0–3 months |
| PDF Text Caching | Medium (performance) | Medium | **Quick Win** | 0–3 months |
| Swagger API Docs | Medium (DX) | Medium | **Strategic** | 0–3 months |
| Real-time Notifications | Medium (UX) | High | **Strategic** | 3–6 months |
| Docker Containerization | Medium (DevOps) | Medium | **Strategic** | 3–6 months |
| PWA Features | Low–Medium | High | **Fill-In** | 6–12 months |
| Native Mobile App | Low | Very High | **Time Sink** | Defer |

---

## Appendix A: ISO Standards Reference

| Standard | Relevance | Compliance Level |
|---|---|---|
| ISO/IEC 25010:2011 (SQuaRE) | Software quality model used for scoring | 🟡 Partially Addressed |
| ISO/IEC 29119 (Software Testing) | Testing processes and documentation | 🔴 Largely Unaddressed |
| ISO/IEC 27001:2022 (ISMS) | Information security controls | 🟡 Partially Addressed |
| ISO 9001:2015 (QMS) | Quality management process | 🟡 Partially Addressed |
| WCAG 2.1 (Accessibility) | UI accessibility | 🟡 Not Formally Assessed |
| OWASP Top 10 | Web security risks | 🟡 Partially Mitigated |

---

## Appendix B: OWASP Top 10 Mapping

| OWASP Risk | Finding | Status |
|---|---|---|
| A01 — Broken Access Control | RBAC via JWT + middleware | ✅ Mitigated |
| A02 — Cryptographic Failures | No HTTPS enforcement, 7-day JWT | 🟡 Partial |
| A03 — Injection | Supabase parameterized queries | ✅ Mitigated |
| A04 — Insecure Design | Audit logging, file access controls | 🟡 Partial |
| A05 — Security Misconfiguration | Missing helmet headers | 🔴 Open (S-001) |
| A06 — Vulnerable Components | Must run `npm audit` | ❓ Not Verified |
| A07 — Auth/Session Failures | No rate limit, 7-day JWT | 🔴 Open (S-002, S-005) |
| A08 — Software Integrity | No CI/CD pipeline | 🔴 Open |
| A09 — Logging/Monitoring | Debug logs, no APM | 🟡 Partial |
| A10 — SSRF | AI controller fetches PDF via URL | 🟡 Review Needed |

> **A10 Note**: The AI controller fetches PDFs using `axios` from a Supabase storage URL resolved server-side. This pattern should verify the resolved URL is within the expected Supabase storage domain to prevent potential SSRF if URL resolution logic is ever compromised.

---

*Analysis prepared on March 18, 2026. Based on static code review of 15 source files totaling ~100KB of application code. Browser-based functional testing not performed as part of this analysis pass.*
