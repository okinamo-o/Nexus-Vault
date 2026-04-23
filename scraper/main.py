import argparse
import asyncio
import json
import os
import random
import re
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag
from dotenv import load_dotenv
from PIL import Image
from playwright.async_api import Browser, BrowserContext, Page, async_playwright
from playwright_stealth import Stealth

SOURCE_LIST_URL = "https://steamrip.com/games-list/"
SOURCE_DOMAIN = "steamrip.com"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_GAMES_DIR = PROJECT_ROOT / "public" / "games"
DEFAULT_DB_PATH = PROJECT_ROOT / "prisma" / "dev.db"

USER_AGENTS = [
    # Chrome 130+
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/132.0.6834.84 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_4) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.6778.205 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.6723.116 Safari/537.36",
    # Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_4) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.3 Safari/605.1.15",
]

BANNED_TERMS_RE = re.compile(
    r"(?i)\b(steamrip(?:\.com)?|discord|telegram|cracked by)\b"
)

REQUIREMENT_KEY_MAP = {
    "os": "OS",
    "processor": "Processor",
    "cpu": "Processor",
    "memory": "Memory",
    "ram": "Memory",
    "graphics": "Graphics",
    "gpu": "Graphics",
    "storage": "Storage",
    "space": "Storage",
}

STOP_SECTION_MARKERS = (
    "screenshots",
    "system requirements",
    "minimum requirements",
    "recommended requirements",
    "game info",
)

BLOCKED_HOST_TOKENS = {
    SOURCE_DOMAIN,
    "facebook.com",
    "x.com",
    "twitter.com",
    "pinterest.com",
    "reddit.com",
    "whatsapp.com",
    "telegram.me",
    "t.me",
    "discord.com",
    "discord.gg",
    "google.com",
    "googlesyndication.com",
    "doubleclick.net",
    "llvpn.com",
}

IMAGE_SUFFIXES = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg")
STEALTH = Stealth()


@dataclass
class ScrapedGame:
    title: str
    slug: str
    description: str
    requirements_json: str | None
    image_path: str
    download_links: list[dict[str, str]]
    source_url: str


def load_environment() -> None:
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(PROJECT_ROOT / ".env.local", override=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def resolve_sqlite_path() -> Path:
    db_url = os.getenv("DATABASE_URL", "file:./dev.db").strip()
    if not db_url.startswith("file:"):
        raise ValueError(f"DATABASE_URL must use sqlite file: URL, got: {db_url}")

    raw_path = db_url[len("file:") :]
    if not raw_path:
        return DEFAULT_DB_PATH

    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate

    # Prisma resolves sqlite relative to the schema directory.
    if raw_path.startswith("./"):
        return (PROJECT_ROOT / "prisma" / raw_path[2:]).resolve()

    return (PROJECT_ROOT / "prisma" / raw_path).resolve()


def create_db_connection(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def init_db_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS "Game" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "title" TEXT NOT NULL,
          "slug" TEXT NOT NULL UNIQUE,
          "description" TEXT NOT NULL,
          "requirements" TEXT,
          "imagePath" TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT 1,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "DownloadLink" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "label" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "host" TEXT NOT NULL,
          "gameId" INTEGER NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE INDEX IF NOT EXISTS "DownloadLink_gameId_idx" ON "DownloadLink" ("gameId");
        """
    )
    conn.commit()


def slugify(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^\w\s-]", "", lowered)
    lowered = re.sub(r"[\s_]+", "-", lowered)
    lowered = re.sub(r"-{2,}", "-", lowered)
    return lowered.strip("-")


def normalize_game_title(raw_title: str) -> str:
    title = raw_title.strip()
    title = re.sub(r"\s*free\s+download.*$", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*\(v[\d\w.\- ]+\)\s*$", "", title, flags=re.IGNORECASE)
    return title.strip() or raw_title.strip()


def sanitize_text(text: str) -> str:
    cleaned = BANNED_TERMS_RE.sub("", text)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def rewrite_with_ollama(sanitized_text: str) -> str | None:
    enabled = os.getenv("OLLAMA_REWRITE_ENABLED", "0").strip() == "1"
    if not enabled:
        return None

    base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").strip().rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "llama3.1:8b").strip()
    if not model:
        return None

    prompt = (
        "Rewrite this game description in a professional, third-person editorial style. "
        "Focus on gameplay and features. "
        "Do not mention SteamRIP, Discord, Telegram, or any external sites. "
        "Output only the rewritten description.\n\n"
        f"{sanitized_text}"
    )
    payload = {"model": model, "prompt": prompt, "stream": False}

    try:
        response = requests.post(
            f"{base_url}/api/generate",
            json=payload,
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as exc:  # noqa: BLE001
        print(f"[{now_iso()}] Ollama rewrite failed, using regex-only text: {exc}")
        return None

    rewritten = data.get("response")
    if isinstance(rewritten, str) and rewritten.strip():
        return rewritten.strip()
    return None


def rewrite_description(raw_text: str) -> str:
    if not raw_text:
        return ""

    # Primary method for local beta: regex sanitization.
    sanitized = sanitize_text(raw_text)

    # Optional local LLM hook via Ollama.
    ollama_rewrite = rewrite_with_ollama(sanitized)
    if ollama_rewrite:
        return sanitize_text(ollama_rewrite)
    return sanitized


def extract_article_body_from_schema(soup: BeautifulSoup) -> str:
    script = soup.select_one("script#tie-schema-json")
    if not script or not script.string:
        return ""

    try:
        data = json.loads(script.string)
    except json.JSONDecodeError:
        return ""

    article_body = data.get("articleBody")
    if not isinstance(article_body, str):
        return ""

    normalized = article_body.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.strip() for line in normalized.split("\n") if line.strip()]
    if not lines:
        return ""

    filtered_lines: list[str] = []
    for line in lines:
        lower = line.lower()
        if any(marker in lower for marker in STOP_SECTION_MARKERS):
            break
        if "direct download" in lower:
            continue
        filtered_lines.append(line)

    return "\n\n".join(filtered_lines).strip()


def extract_description_from_entry(soup: BeautifulSoup) -> str:
    entry = soup.select_one("article#the-post div.entry-content")
    if not entry:
        return ""

    chunks: list[str] = []
    for child in entry.children:
        if isinstance(child, NavigableString):
            continue
        if not isinstance(child, Tag):
            continue

        text = child.get_text(" ", strip=True)
        if not text:
            continue

        lowered = text.lower()
        if any(marker in lowered for marker in STOP_SECTION_MARKERS):
            break

        if child.name in {"p", "h2", "h3"}:
            if "direct download" in lowered:
                continue
            chunks.append(text)

    return "\n\n".join(chunks).strip()


def extract_raw_description(soup: BeautifulSoup) -> str:
    schema_text = extract_article_body_from_schema(soup)
    if schema_text:
        return schema_text
    return extract_description_from_entry(soup)


def parse_requirements(soup: BeautifulSoup) -> dict[str, str]:
    result: dict[str, str] = {}

    section_heading = soup.find(
        lambda tag: isinstance(tag, Tag)
        and tag.name in {"h2", "h3", "h4", "h5", "strong", "span"}
        and "system requirements" in tag.get_text(" ", strip=True).lower()
    )

    if not section_heading:
        return result

    requirement_list = section_heading.find_next("ul")
    if not requirement_list:
        return result

    for item in requirement_list.find_all("li", recursive=False):
        text = item.get_text(" ", strip=True)
        if not text:
            continue

        label = ""
        strong = item.find("strong")
        if strong:
            label = strong.get_text(" ", strip=True).strip(":")

        if not label and ":" in text:
            label = text.split(":", 1)[0].strip()

        normalized_key = REQUIREMENT_KEY_MAP.get(label.lower().strip())
        if not normalized_key:
            continue

        value = text
        if ":" in text:
            value = text.split(":", 1)[1].strip()

        if value:
            result[normalized_key] = value

    return result


def make_absolute_url(raw_url: str, page_url: str) -> str:
    if raw_url.startswith("//"):
        return f"https:{raw_url}"
    return urljoin(page_url, raw_url)


def extract_featured_image_url(soup: BeautifulSoup, page_url: str) -> str | None:
    image = soup.select_one("figure.single-featured-image img")
    if image:
        for attr in ("data-src", "src", "data-lazy-src"):
            candidate = image.get(attr)
            if candidate and not candidate.startswith("data:image"):
                return make_absolute_url(candidate, page_url)

        srcset = image.get("srcset")
        if srcset:
            first = srcset.split(",")[0].strip().split(" ")[0]
            if first:
                return make_absolute_url(first, page_url)

    script = soup.select_one("script#tie-schema-json")
    if script and script.string:
        try:
            data = json.loads(script.string)
            image_data = data.get("image")
            if isinstance(image_data, dict):
                url = image_data.get("url")
                if isinstance(url, str) and url:
                    return make_absolute_url(url, page_url)
        except json.JSONDecodeError:
            return None

    return None


def looks_like_download_href(href: str) -> bool:
    lowered = href.lower()
    if lowered.startswith(("javascript:", "mailto:", "tel:", "#")):
        return False
    return True


def host_matches_blocklist(hostname: str | None) -> bool:
    if not hostname:
        return True
    host = hostname.lower()
    return any(token in host for token in BLOCKED_HOST_TOKENS)


def is_intermediate_source_link(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return SOURCE_DOMAIN in host and parsed.path.startswith("/go/")


def should_skip_url(url: str) -> bool:
    parsed = urlparse(url)
    if host_matches_blocklist(parsed.hostname):
        return not is_intermediate_source_link(url)

    path = parsed.path.lower()
    if path.endswith(IMAGE_SUFFIXES):
        return True
    return False


def strip_tracking_params(url: str) -> str:
    parsed = urlparse(url)
    if not parsed.query:
        return url
    allowed = parse_qs(parsed.query, keep_blank_values=True)
    kept_items: list[tuple[str, str]] = []
    for key, values in allowed.items():
        if key.lower().startswith("utm_"):
            continue
        for value in values:
            kept_items.append((key, value))
    query = "&".join(f"{k}={v}" for k, v in kept_items)
    return urlunparse(parsed._replace(query=query))


def extract_candidate_links(soup: BeautifulSoup, page_url: str) -> list[str]:
    entry = soup.select_one("article#the-post div.entry-content")
    if not entry:
        return []

    candidates: list[str] = []
    for anchor in entry.select("a[href]"):
        href = (anchor.get("href") or "").strip()
        if not href or not looks_like_download_href(href):
            continue

        absolute = make_absolute_url(href, page_url)
        if should_skip_url(absolute):
            continue

        candidates.append(strip_tracking_params(absolute))

    deduped: list[str] = []
    seen: set[str] = set()
    for link in candidates:
        if link in seen:
            continue
        seen.add(link)
        deduped.append(link)
    return deduped


def find_meta_refresh_redirect(html: str, base_url: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    meta = soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)})
    if not meta:
        return None
    content = meta.get("content", "")
    match = re.search(r"url\s*=\s*([^;]+)", content, flags=re.IGNORECASE)
    if not match:
        return None
    return make_absolute_url(match.group(1).strip().strip("'\""), base_url)


def resolve_download_url(
    session: requests.Session,
    original_url: str,
    timeout: int = 35,
    max_hops: int = 8,
) -> str | None:
    current = original_url
    headers = {"User-Agent": random.choice(USER_AGENTS)}

    for _ in range(max_hops):
        try:
            response = session.get(
                current,
                headers=headers,
                timeout=timeout,
                allow_redirects=False,
            )
        except requests.RequestException:
            return None

        if 300 <= response.status_code < 400:
            location = response.headers.get("Location")
            if not location:
                return None
            current = strip_tracking_params(make_absolute_url(location, current))
            if should_skip_url(current):
                return None
            continue

        meta_refresh_target = find_meta_refresh_redirect(response.text, current)
        if meta_refresh_target and meta_refresh_target != current:
            current = strip_tracking_params(meta_refresh_target)
            if should_skip_url(current):
                return None
            continue

        break

    try:
        final_response = session.get(
            current,
            headers=headers,
            timeout=timeout,
            allow_redirects=True,
        )
    except requests.RequestException:
        return None

    final_url = strip_tracking_params(final_response.url)
    if should_skip_url(final_url):
        return None

    if is_intermediate_source_link(final_url):
        return None

    return final_url


def download_and_convert_image(
    session: requests.Session,
    image_url: str | None,
    slug: str,
) -> str:
    PUBLIC_GAMES_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PUBLIC_GAMES_DIR / f"{slug}.webp"
    if not image_url:
        return f"/games/{slug}.webp"

    try:
        response = session.get(
            image_url,
            headers={"User-Agent": random.choice(USER_AGENTS)},
            timeout=35,
        )
        response.raise_for_status()
    except requests.RequestException:
        return f"/games/{slug}.webp"

    with Image.open(memory := BytesIO(response.content)) as image:
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGB")
        image.save(output_path, "WEBP", quality=88, method=6)
    memory.close()

    return f"/games/{slug}.webp"


def format_host_label(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().replace("www.", "")
    if not host:
        return "Mirror", "mirror"
    root = host.split(".")[0]
    label = root.capitalize() if root else host
    return label, host


async def random_delay() -> None:
    await asyncio.sleep(random.uniform(2.0, 5.0))


async def human_like_mouse(page: Page) -> None:
    viewport = page.viewport_size or {"width": 1366, "height": 768}
    width = viewport.get("width", 1366)
    height = viewport.get("height", 768)

    x_start = random.randint(20, max(21, width - 20))
    y_start = random.randint(20, max(21, height - 20))
    await page.mouse.move(x_start, y_start, steps=random.randint(8, 18))

    for _ in range(random.randint(1, 3)):
        x = random.randint(20, max(21, width - 20))
        y = random.randint(20, max(21, height - 20))
        await page.mouse.move(x, y, steps=random.randint(10, 30))
        if random.random() > 0.35:
            await page.mouse.wheel(0, random.randint(60, 420))
        await asyncio.sleep(random.uniform(0.1, 0.5))


async def create_context(browser: Browser) -> BrowserContext:
    context = await browser.new_context(
        user_agent=random.choice(USER_AGENTS),
        viewport={
            "width": random.choice([1280, 1366, 1440, 1536, 1600]),
            "height": random.choice([720, 768, 810, 900]),
        },
        locale="en-US",
        color_scheme="dark",
    )
    await STEALTH.apply_stealth_async(context)
    return context


def normalize_game_urls(hrefs: Iterable[str], base_url: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    game_path_pattern = re.compile(
        r"^/[a-z0-9][a-z0-9\-]*free-download[a-z0-9\-]*/?$", re.IGNORECASE
    )

    for href in hrefs:
        if not href:
            continue
        absolute = make_absolute_url(href, base_url)
        parsed = urlparse(absolute)

        if SOURCE_DOMAIN not in (parsed.hostname or ""):
            continue
        if not game_path_pattern.match(parsed.path):
            continue

        normalized = f"https://{SOURCE_DOMAIN}{parsed.path if parsed.path.endswith('/') else parsed.path + '/'}"
        if normalized in seen:
            continue
        seen.add(normalized)
        urls.append(normalized)

    return urls


async def fetch_game_urls(context: BrowserContext) -> list[str]:
    page = await context.new_page()
    try:
        await page.goto(SOURCE_LIST_URL, wait_until="domcontentloaded", timeout=90_000)
        await human_like_mouse(page)
        hrefs: list[str] = await page.eval_on_selector_all(
            "a[href]",
            "anchors => anchors.map(a => a.getAttribute('href') || '')",
        )
        return normalize_game_urls(hrefs, SOURCE_LIST_URL)
    finally:
        await page.close()


def clean_link_records(links: list[str]) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    seen: set[str] = set()

    for link in links:
        normalized = strip_tracking_params(link)
        if normalized in seen:
            continue
        seen.add(normalized)
        label, host = format_host_label(normalized)
        records.append({"label": label, "url": normalized, "host": host})

    return records


async def scrape_game(
    context: BrowserContext,
    session: requests.Session,
    game_url: str,
) -> ScrapedGame | None:
    page = await context.new_page()
    try:
        await page.goto(game_url, wait_until="domcontentloaded", timeout=90_000)
        await human_like_mouse(page)
        html = await page.content()
    except Exception as exc:  # noqa: BLE001
        print(f"[{now_iso()}] Failed to fetch {game_url}: {exc}")
        return None
    finally:
        await page.close()

    soup = BeautifulSoup(html, "html.parser")
    title_node = soup.select_one("h1.post-title.entry-title") or soup.find("h1")
    if not title_node:
        print(f"[{now_iso()}] Skipped {game_url}: title not found")
        return None

    raw_title = title_node.get_text(" ", strip=True)
    title = normalize_game_title(raw_title)
    slug = slugify(title) or slugify(urlparse(game_url).path.strip("/")) or f"game-{int(time.time())}"

    raw_description = extract_raw_description(soup)
    rewritten_description = rewrite_description(raw_description)

    requirements = parse_requirements(soup)
    requirements_json = json.dumps(requirements, ensure_ascii=False) if requirements else None

    image_url = extract_featured_image_url(soup, game_url)
    image_path = download_and_convert_image(session, image_url, slug)

    candidate_links = extract_candidate_links(soup, game_url)
    resolved_links: list[str] = []
    for link in candidate_links:
        await random_delay()
        resolved = resolve_download_url(session, link)
        if resolved:
            resolved_links.append(resolved)

    download_links = clean_link_records(resolved_links)

    return ScrapedGame(
        title=title,
        slug=slug,
        description=rewritten_description or sanitize_text(raw_description) or title,
        requirements_json=requirements_json,
        image_path=image_path,
        download_links=download_links,
        source_url=game_url,
    )


def upsert_game(conn: sqlite3.Connection, game: ScrapedGame) -> None:
    cursor = conn.cursor()
    cursor.execute('SELECT "id" FROM "Game" WHERE "slug" = ?', (game.slug,))
    row = cursor.fetchone()

    if row:
        game_id = int(row["id"])
        cursor.execute(
            """
            UPDATE "Game"
            SET "title" = ?, "description" = ?, "requirements" = ?, "imagePath" = ?,
                "isActive" = 1, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ?
            """,
            (
                game.title,
                game.description,
                game.requirements_json,
                game.image_path,
                game_id,
            ),
        )
    else:
        cursor.execute(
            """
            INSERT INTO "Game" ("title", "slug", "description", "requirements", "imagePath", "isActive", "createdAt", "updatedAt")
            VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (
                game.title,
                game.slug,
                game.description,
                game.requirements_json,
                game.image_path,
            ),
        )
        game_id = int(cursor.lastrowid)

    cursor.execute('DELETE FROM "DownloadLink" WHERE "gameId" = ?', (game_id,))
    for link in game.download_links:
        cursor.execute(
            """
            INSERT INTO "DownloadLink" ("label", "url", "host", "gameId", "createdAt")
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (link["label"], link["url"], link["host"], game_id),
        )

    conn.commit()


def initialize_database_only() -> None:
    db_path = resolve_sqlite_path()
    connection = create_db_connection(db_path)
    try:
        init_db_schema(connection)
    finally:
        connection.close()
    print(f"[{now_iso()}] SQLite database initialized at: {db_path}")


async def run_scraper(limit: int, dry_run: bool, rotate_every: int) -> None:
    db_path = resolve_sqlite_path()
    conn = create_db_connection(db_path)
    init_db_schema(conn)
    print(f"[{now_iso()}] Using SQLite database: {db_path}")

    session = requests.Session()
    session.headers.update({"Accept-Language": "en-US,en;q=0.9"})
    print(f"[{now_iso()}] Starting crawl from: {SOURCE_LIST_URL}")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await create_context(browser)

        try:
            game_urls = await fetch_game_urls(context)
            if limit > 0:
                game_urls = game_urls[:limit]
            print(f"[{now_iso()}] Found {len(game_urls)} game URLs to process.")

            succeeded = 0
            failed = 0

            for index, game_url in enumerate(game_urls, start=1):
                if rotate_every > 0 and (index - 1) % rotate_every == 0 and index != 1:
                    await context.close()
                    context = await create_context(browser)

                await random_delay()
                print(f"[{now_iso()}] [{index}/{len(game_urls)}] Scraping: {game_url}")

                scraped = await scrape_game(context=context, session=session, game_url=game_url)
                if not scraped:
                    failed += 1
                    continue

                print(
                    f"[{now_iso()}] Parsed: title='{scraped.title}', slug='{scraped.slug}', "
                    f"links={len(scraped.download_links)}"
                )

                if not dry_run:
                    upsert_game(conn, scraped)
                succeeded += 1

            print(
                f"[{now_iso()}] Completed. Success: {succeeded}, Failed: {failed}, Dry-run: {dry_run}"
            )
        finally:
            await context.close()
            await browser.close()
            conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Nexus Vault local beta scraper.")
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.getenv("SCRAPER_LIMIT", "30")),
        help="Maximum number of games to scrape in this run. Use 0 for no limit.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run scraper without writing to SQLite.",
    )
    parser.add_argument(
        "--ua-rotate-every",
        type=int,
        default=int(os.getenv("SCRAPER_UA_ROTATE_EVERY", "20")),
        help="Rotate browser context/user-agent after N games.",
    )
    parser.add_argument(
        "--init-db-only",
        action="store_true",
        help="Initialize local SQLite schema and exit.",
    )
    return parser.parse_args()


def main() -> None:
    load_environment()
    args = parse_args()

    if args.init_db_only:
        initialize_database_only()
        return

    try:
        asyncio.run(run_scraper(args.limit, args.dry_run, args.ua_rotate_every))
    except KeyboardInterrupt:
        print(f"[{now_iso()}] Scraper interrupted by user.")


if __name__ == "__main__":
    main()
