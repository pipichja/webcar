import sqlite3
import json

aliases_data = {
    # 🏫 อาคารเรียน
    "School of Liberal Art": ["SoLA", "อาคารเรียนรวม", "ตึกเรียนรวม", "Liberal Arts", "อาคารเรียน 1", "ตึก 1"],
    "Office of the President": ["อธิการบดี", "President Office", "สำนักงานอธิการบดี", "ตึกอธิการ", "ตึก R"],
    
    # 🧠 วิศวกรรมศาสตร์
    "Faculty of Computer Engineering": ["CPE", "ComEng", "Computer Engineering", "ตึกคอม", "อาคารเรียนคอม", "ตึก E12", "Engineering 12"],
    "Faculty of Chemical Engineering": ["ChemEng", "Chemical", "ตึกเคมี", "ตึก E10", "Engineering 10", "Chemical Engineering"],
    "Faculty of Mechanical Engineering": ["ME", "MachEng", "ตึกเครื่องกล", "ตึก E7", "Engineering 7", "Mechanical"],
    "Faculty of Product Engineering": ["PE", "ProdEng", "ตึกผลิต", "ตึก E9", "Engineering 9", "Product Engineering"],

    # 🧪 พื้นที่อื่น ๆ
    "Chaloem Phrakiat Park": ["สวนเฉลิม", "สวนสุขภาพ", "สวน", "Park", "Garden", "Phra Chom Square"],
    "Bangkok Bank": ["ธนาคารกรุงเทพ", "Bangkok Bank", "Bank", "ATM Bank", "ATM อาคารเรียนรวม"],
    "Cafe Amazon": ["Amazon", "กาแฟอเมซอน", "ร้านกาแฟ", "คาเฟ่อเมซอน", "Cafe Amazon", "ตึกอเมซอน"],
    "7-Eleven": ["เซเว่น", "7-11", "ร้านสะดวกซื้อ", "Seven", "7Eleven"],
    "KMUTT Shuttle Bus": ["รถกอล์ฟ", "รถรับส่ง", "Bus", "Shuttle", "รถรับส่งมจธ", "รถรับส่ง KMUTT"],
    "Darun Sikkhalai School": ["Darun School", "โรงเรียนดรุณสิกขาลัย", "ดรุณสิกขาลัย", "ตึกโรงเรียน"],
    "King Mongkut's University of Technology Thonburi Alumni Association  under royal patronage": [
        "สมาคมนักศึกษาเก่า", "Alumni", "KMUTT Alumni", "ตึกสมาคมนักศึกษาเก่า"
    ],
}

conn = sqlite3.connect("kmutt_map.db")
cur = conn.cursor()

for main_name, alias_list in aliases_data.items():
    cur.execute(
        "UPDATE places SET aliases=? WHERE name_en=?",
        (json.dumps(alias_list, ensure_ascii=False), main_name)
    )

conn.commit()
conn.close()
print("✅ เพิ่มชื่อเล่น + รหัสตึกเรียบร้อยแล้ว!")