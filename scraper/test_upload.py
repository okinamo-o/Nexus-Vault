import os
import requests
import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row
from pathlib import Path

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
BLOB_TOKEN = os.getenv("BLOB_READ_WRITE_TOKEN")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_GAMES_DIR = PROJECT_ROOT / "public" / "games"

def test_upload():
    if not BLOB_TOKEN:
        print("Error: BLOB_READ_WRITE_TOKEN not found in .env")
        return

    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            # Pick a game that has a local image
            cur.execute('SELECT id, title, slug, "imagePath" FROM "Game" WHERE "imagePath" LIKE \'/games/%%\' LIMIT 1')
            game = cur.fetchone()
            
            if not game:
                print("No games with local images found.")
                return

            slug = game["slug"]
            local_path = PUBLIC_GAMES_DIR / f"{slug}.webp"
            
            if not local_path.exists():
                print(f"Local image not found at: {local_path}")
                return

            print(f"Uploading image for: {game['title']}...")
            
            with open(local_path, "rb") as f:
                image_data = f.read()

            try:
                response = requests.put(
                    f"https://blob.vercel-storage.com/games/{slug}.webp",
                    data=image_data,
                    headers={
                        "Authorization": f"Bearer {BLOB_TOKEN}",
                        "x-api-version": "7"
                    },
                    timeout=30
                )
                response.raise_for_status()
                new_url = response.json().get("url")
                
                if new_url:
                    print(f"Success! New URL: {new_url}")
                    cur.execute('UPDATE "Game" SET "imagePath" = %s WHERE "id" = %s', (new_url, game["id"]))
                    conn.commit()
                    print("Database updated.")
                else:
                    print("Failed to get URL from response.")
            except Exception as e:
                print(f"Upload failed: {e}")

if __name__ == "__main__":
    test_upload()
