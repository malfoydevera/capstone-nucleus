# Changelog

All notable NUCLEUS changes are documented here.

## [Unreleased]

### Phase 3C — Admin export & performance
- Admin Dashboard export buttons for students and papers CSV
- `backend/docs/ADMIN.md` admin operations guide
- React.lazy code-splitting for Landing, ResearchDetail, ReviewDetail (smaller initial bundle)

### Phase 3B — Responsive & animations
- Removed decorative CSS animations (`animate-float`, `animate-gradient`, etc.)
- Unified brand color tokens in `index.css`

### Phase 3A — Landing & Login
- Rewrote `Landing.jsx` (~200 lines, no framer-motion, no fake stats)
- Simplified `Login.jsx` (form-only layout, no marketing sidebar)
- Removed `framer-motion` dependency

### Phase 2D — Browse & detail
- Browse repository: load-more pagination, honest view-only copy
- Research detail: admin-only download button; context-aware back navigation

### Phase 2C — Submit flow
- Three-step submit wizard (Upload → Details → People)
- Inline field validation; faculty adviser required
- Removed checklist modal

### Phase 2B — Student nav & dashboard
- `studentStatus.js` shared status labels
- Portfolio removed; "My Submissions" nav label
- Task-first student dashboard

### Phase 2A — Design system
- `design-system/MASTER.md` with `#3674B5`, `#578FCA`, `#FFFFFF` tokens
- Replaced legacy `#1C4D8D` palette across frontend

### Phase 1D — Load tests & download lock
- Load-test scripts + `results/2026-06-11.md`
- `file_url` omitted for non-admin in `getResearchById` and `getMyResearch`

### Phase 1C — Backend hardening
- `compression` middleware
- Pagination on `getMyResearch` and `getAllResearch` (max limit 50)
- Rate limiter on `GET /research/published`

### Phase 1A–1B — Search
- PostgreSQL full-text search migration (`search_vector` + GIN index)
- Extended `GET /api/research/published` with FTS, facets, pagination
- `BrowseRepository.jsx` server-side debounced search + thematic chips
- `backend/docs/SEARCH_API.md`

### Phase 0 — Cleanup
- Removed dead `research.controller.js` and orphan browse/settings pages
- Pruned unused Azure MSAL and client Supabase dependencies

## Phase 0 — Foundation

- NUCLEUS monorepo scaffold (`frontend`, `backend`, migrations)
- Role-based auth (student, faculty, staff, admin, dean, program_chair)
- Research submission workflow with multi-stage review
- Published repository browse with category filters
- PDF viewer with reviewer annotations
- Audit logs and dean activity monitor
- Notification system with unread counts
