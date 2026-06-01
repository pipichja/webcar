import sqlite3
from deep_translator import GoogleTranslator
from tqdm import tqdm

print("🚀 เริ่มแปลชื่อสถานที่เป็นภาษาอังกฤษ...")

# เชื่อมต่อฐานข้อมูล
conn = sqlite3.connect("kmutt_map.db")
cur = conn.cursor()

# เพิ่มคอลัมน์ name_en ถ้ายังไม่มี
try:
    cur.execute("ALTER TABLE places ADD COLUMN name_en TEXT")
    print("✅ เพิ่มคอลัมน์ name_en เรียบร้อยแล้ว")
except sqlite3.OperationalError:
    print("ℹ️ คอลัมน์ name_en มีอยู่แล้ว")

# ดึงข้อมูลชื่อทั้งหมดที่ยังไม่มี name_en
cur.execute("SELECT rowid, name FROM places WHERE name_en IS NULL OR name_en=''")
rows = cur.fetchall()
print(f"📍 พบชื่อที่ต้องแปลทั้งหมด {len(rows)} รายการ")

# เริ่มแปลและอัปเดต
for rid, name in tqdm(rows, desc="Translating", ncols=80):
    if not name:
        continue
    try:
        name_en = GoogleTranslator(source="auto", target="en").translate(name)
        cur.execute("UPDATE places SET name_en=? WHERE rowid=?", (name_en, rid))
    except Exception as e:
        print(f"⚠️ แปล '{name}' ไม่สำเร็จ: {e}")

conn.commit()
conn.close()
print("✅ เสร็จสิ้น — เพิ่มชื่อภาษาอังกฤษลงในฐานข้อมูลแล้ว!")