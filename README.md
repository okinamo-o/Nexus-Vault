# Nexus Vault

A digital game archive built with **Next.js 14 (App Router)**, **Prisma + PostgreSQL (Neon)**, **Tailwind CSS**, and an automated **Playwright** ingestion pipeline.

## Key Features

- **Archive Discovery**: Server-rendered catalog with search suggestions, fuzzy title matching, sort modes (`newest`, `updated`, `mirrors`, `az`), requirement/mirror filters, and URL-persisted pagination.
- **Game Detail Pages**: Spec breakdown (`OS`, `Processor`, `Memory`, `Graphics`, `Storage`), sanitized descriptions, mirror links routed through `/api/exit`, and automatic image fallback handling.
- **Admin Ops (`/admin`)**: HTTP Basic Auth protected dashboard for toggling entry visibility and refreshing timestamps.
- **Automated Scraper (`scraper/main.py`)**: Crawls reverse-chronological homepage releases (`--mode latest`) or full catalog (`--mode all`), converts cover artwork to WebP (uploading to Vercel Blob when configured), resolves mirror links, and skips error/Cloudflare pages.

## Local Development

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

### Required Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (or `file:./dev.db` for local SQLite scraper testing).
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: Credentials required for `/admin`.
- `BLOB_READ_WRITE_TOKEN` *(optional)*: Vercel Blob token used by `scraper/main.py` for cloud image uploads.

## Testing & Verification

```bash
npm run lint
npx tsc --noEmit
npm test
python -m unittest discover -s scraper -p "test_*.py"
```
