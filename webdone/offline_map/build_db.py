import json, sqlite3

# เปิดหรือสร้างฐานข้อมูลใหม่
conn = sqlite3.connect("kmutt_map.db")
conn.execute("CREATE TABLE IF NOT EXISTS places (name TEXT, lat REAL, lon REAL)")

# โหลดข้อมูลจากไฟล์ kmutt.json (ต้องอยู่ในโฟลเดอร์เดียวกัน)
with open("kmutt.json", "r", encoding="utf-8") as f:
    data = json.load(f)

count = 0
for feature in data.get("features", []):
    props = feature.get("properties", {})
    geom = feature.get("geometry", {})
    # เก็บเฉพาะจุดที่มีชื่อและเป็น Point
    if "name" in props and geom.get("type") == "Point":
        lon, lat = geom["coordinates"]
        conn.execute("INSERT INTO places VALUES (?, ?, ?)", (props["name"], lat, lon))
        count += 1

conn.commit()
conn.close()

print(f"✅ Imported {count} named places into kmutt_map.db")