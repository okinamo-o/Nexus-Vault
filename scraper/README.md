# Nexus Vault Scraper (Local Beta)

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
DATABASE_URL="file:./dev.db"
SCRAPER_LIMIT="30"
SCRAPER_UA_ROTATE_EVERY="20"
OLLAMA_REWRITE_ENABLED="0"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="llama3.1:8b"
```

## Run

```bash
python scraper/main.py --init-db-only
python scraper/main.py --limit 5
```
