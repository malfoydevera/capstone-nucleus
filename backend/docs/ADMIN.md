# NUCLEUS Admin Operations

## CSV exports (admin only)

Both endpoints require `Authorization: Bearer <token>` and `users.role = admin`. Each export writes an audit log entry.

| Endpoint | Output |
|----------|--------|
| `GET /api/auth/admin/export/students` | CSV: id, email, full_name, program, department, is_active, created_at |
| `GET /api/research/admin/export/papers` | CSV: id, title, status, category, author_name, author_email, submission_date, published_date, created_at |

Optional query for papers export:

- `status` — filter by workflow status (e.g. `pending_admin`)
- `includeDeleted=true` — include soft-deleted papers

### Frontend

Admin Dashboard → **Export students** / **Export papers** buttons call the endpoints and download the CSV blob.

### Non-admin access

Returns `403 Forbidden`.

## PDF download policy

Only administrators receive `file_url` in API responses and may use **Download PDF** in the UI. All other roles view papers through the secure in-app PDF viewer.
