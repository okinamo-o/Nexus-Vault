# Nexus Vault Scraper (Phase 1)

## Setup

```bash
python -m venv .venv
.venv\\Scripts\\activate
python -m pip install -r scraper/requirements.txt
python -m playwright install chromium
```

## Environment

Use project root `.env`:

```env
DATABASE_URL="mongodb+srv://<username>:<password>@<cluster>.mongodb.net/nexus_vault?retryWrites=true&w=majority"
MONGODB_DB_NAME="nexus_vault"
HF_API_TOKEN=""
HF_MODEL="google/flan-t5-large"
SCRAPER_LIMIT="30"
SCRAPER_UA_ROTATE_EVERY="20"
```

## Run

```bash
python scraper/main.py --limit 30
```

Dry run (no DB writes):

```bash
python scraper/main.py --limit 5 --dry-run
```

## GitHub Actions

The repository workflow at `.github/workflows/scrape.yml` runs this script every 12 hours and writes directly to MongoDB Atlas.
