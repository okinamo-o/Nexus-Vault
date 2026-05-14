import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
import os

load_dotenv()

conn = psycopg.connect(os.getenv("DATABASE_URL"), row_factory=dict_row)
cur = conn.cursor()

# Delete the 504 junk record
cur.execute("""SELECT id, title FROM "Game" WHERE slug = 'gateway-time-out-error-code-504'""")
row = cur.fetchone()
if row:
    print(f"Deleting: id={row['id']}, title={row['title']}")
    cur.execute("""DELETE FROM "DownloadLink" WHERE "gameId" = %s""", (row["id"],))
    cur.execute("""DELETE FROM "Game" WHERE id = %s""", (row["id"],))
    conn.commit()
    print("Deleted!")
else:
    print("Not found.")

conn.close()
