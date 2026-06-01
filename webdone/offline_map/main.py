from fastapi import FastAPI
import sqlite3

app = FastAPI(title="KMUTT Offline Map API")

@app.get("/search")
def search(q: str):
    conn = sqlite3.connect("kmutt_map.db")
    cur = conn.cursor()
    cur.execute("SELECT name, lat, lon FROM places WHERE name LIKE ?", (f"%{q}%",))
    rows = cur.fetchall()
    conn.close()

    results = [{"name": r[0], "lat": r[1], "lon": r[2]} for r in rows]
    if not results:
        return {"message": f"❌ ไม่พบสถานที่ชื่อ '{q}' ในฐานข้อมูล", "results": []}
    return {"results": results}