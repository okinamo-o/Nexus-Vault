import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
import os

load_dotenv()

conn = psycopg.connect(os.getenv("DATABASE_URL"), row_factory=dict_row)
cur = conn.cursor()

cur.execute("""SELECT "imagePath" FROM "Game" WHERE "imagePath" LIKE 'https://%%' LIMIT 3""")
print("Blob examples:", [r["imagePath"] for r in cur.fetchall()])

cur.execute("""SELECT "imagePath" FROM "Game" WHERE "imagePath" LIKE '/games/%%' LIMIT 3""")
print("Local examples:", [r["imagePath"] for r in cur.fetchall()])

cur.execute("""SELECT count(*) as c FROM "Game" WHERE "imagePath" LIKE 'https://%%'""")
print("Blob images count:", cur.fetchone()["c"])

cur.execute("""SELECT count(*) as c FROM "Game" WHERE "imagePath" LIKE '/games/%%'""")
print("Local images count:", cur.fetchone()["c"])

conn.close()
