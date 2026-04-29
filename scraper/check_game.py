import os
import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def test():
    with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT title, slug, "imagePath" FROM "Game" LIMIT 1')
            game = cur.fetchone()
            print(game)

if __name__ == "__main__":
    test()
