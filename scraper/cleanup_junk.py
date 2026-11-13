import argparse
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

sys.path.insert(0, str(Path(__file__).resolve().parent))
from main import (  # noqa: E402
    FALLBACK_IMAGE_PATH,
    PUBLIC_GAMES_DIR,
    is_invalid_scraped_page,
    sanitize_text,
    should_skip_url,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit and clean Nexus Vault database records.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist cleanup changes to PostgreSQL. Defaults to dry-run.",
    )
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    with psycopg.connect(db_url, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            # 1. Remove invalid / Cloudflare / error-page game rows
            cur.execute(
                '''
                SELECT g.id, g.title, g.slug, g.description,
                       (SELECT COUNT(*) FROM "DownloadLink" d WHERE d."gameId" = g.id) AS link_count
                FROM "Game" g
                '''
            )
            junk_games = []
            for row in cur.fetchall():
                reason = is_invalid_scraped_page(row["title"], row["description"], row["link_count"])
                if reason:
                    junk_games.append((row["id"], row["title"], reason))

            print(f"Junk games detected: {len(junk_games)}")
            for gid, title, reason in junk_games:
                print(f"  - id={gid} title={title!r} ({reason})")

            # 2. Remove non-filehost / screenshot DownloadLink rows
            cur.execute('SELECT id, "gameId", url, host FROM "DownloadLink"')
            bad_links = [r for r in cur.fetchall() if should_skip_url(r["url"])]
            print(f"Invalid DownloadLinks detected: {len(bad_links)}")
            for link in bad_links:
                print(f"  - linkId={link['id']} gameId={link['gameId']} host={link['host']} url={link['url']}")

            # 3. Fix missing local /games/*.webp paths
            cur.execute('SELECT id, slug, "imagePath" FROM "Game" WHERE "imagePath" LIKE \'/games/%%\'')
            missing_images = [
                r
                for r in cur.fetchall()
                if not (PUBLIC_GAMES_DIR / r["imagePath"].removeprefix("/games/")).exists()
                and r["id"] not in {gid for gid, _, _ in junk_games}
            ]
            print(f"Missing local image files: {len(missing_images)}")
            for img in missing_images:
                print(f"  - id={img['id']} slug={img['slug']} path={img['imagePath']}")

            # 4. Clean HTML entities and boilerplate intros in descriptions
            cur.execute('SELECT id, title, description FROM "Game"')
            desc_updates = []
            for row in cur.fetchall():
                if row["id"] in {gid for gid, _, _ in junk_games}:
                    continue
                cleaned = sanitize_text(row["description"], title=row["title"])
                if cleaned != row["description"] and len(cleaned) >= 30:
                    desc_updates.append((row["id"], row["title"], row["description"], cleaned))

            print(f"Descriptions to sanitize: {len(desc_updates)}")
            for gid, title, before, after in desc_updates[:5]:
                print(f"  - [{gid}] {title!r}")
                print(f"      before: {before[:120]!r}")
                print(f"      after : {after[:120]!r}")

            if not args.apply:
                print("\nDry-run complete. Re-run with --apply to commit changes.")
                return

            if junk_games:
                junk_ids = [gid for gid, _, _ in junk_games]
                cur.execute('DELETE FROM "DownloadLink" WHERE "gameId" = ANY(%s)', (junk_ids,))
                cur.execute('DELETE FROM "Game" WHERE id = ANY(%s)', (junk_ids,))

            if bad_links:
                bad_ids = [r["id"] for r in bad_links]
                cur.execute('DELETE FROM "DownloadLink" WHERE id = ANY(%s)', (bad_ids,))

            for img in missing_images:
                cur.execute(
                    'UPDATE "Game" SET "imagePath" = %s WHERE id = %s',
                    (FALLBACK_IMAGE_PATH, img["id"]),
                )

            for gid, _, _, cleaned in desc_updates:
                cur.execute(
                    'UPDATE "Game" SET description = %s WHERE id = %s',
                    (cleaned, gid),
                )

            conn.commit()
            print("\nApplied all cleanup updates successfully.")


if __name__ == "__main__":
    main()
