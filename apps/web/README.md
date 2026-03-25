# AI Rewrite Workbench Web

## Development

Run the app from the repository root so workspace packages resolve correctly:

```bash
npm install
npm run dev --workspace web
```

The Story 1.3 upload and task flow depends on these server-side settings:

- `TASK_CONTEXT_SECRET`: Signs the anonymous task context cookie. Required in production.
- `DATABASE_URL`: Required when `AI_REWRITE_DB_DRIVER=postgres` or in production.
- `AI_REWRITE_DB_DRIVER`: `memory` for local/test fallback, `postgres` for managed PostgreSQL.
- `AI_REWRITE_STORAGE_DRIVER`: `memory` for local/test fallback, `r2` for Cloudflare R2.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: Required when using the `r2` storage driver or in production.

## Privacy And Access Boundary

- Uploaded originals are stored in private object storage only. This story does not expose public object URLs, `public/`, or `r2.dev` access.
- Default retention is 7 days unless a later story introduces an explicit override.
- Uploaded content is excluded from model-training use by default.
- Access is limited to the task holder bound to the task-scoped cookie and the minimum necessary operations role.

## Verification

Run the full verification set from the repository root:

```bash
npm test
npm run lint
npm run build
```
