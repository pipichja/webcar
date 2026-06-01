// ====================================================
// app/api/search/backend/route.js
// API สำหรับค้นหาพิกัดสถานที่จาก OpenStreetMap (Nominatim)
// รับคำสั่งจาก AI Assistant / Frontend
// แล้วส่งข้อมูลต่อไปยัง ROS2 ผ่าน MQTT
// ====================================================

import { NextResponse } from "next/server"; 
// ใช้สร้าง HTTP response สำหรับ API ของ Next.js

import fs from "fs";
import path from "path";
// ใช้อ่านไฟล์ alias และ cache จากระบบไฟล์

// ⭐ MQTT client กลาง
import { connectMQTT } from "../../../lib/mqtt-client";
// ใช้เชื่อมต่อ MQTT broker และ publish ข้อมูลไป ROS / Frontend

// ⭐ WebSocket broadcast (Frontend realtime)
import { broadcast } from "../../ws/route";
// ใช้ส่งข้อมูลแบบ realtime ไปยัง frontend ผ่าน WebSocket

// ====================================================
// โหลดไฟล์ข้อมูล alias และ cache
// ====================================================
const rootDir = process.cwd(); 
// root directory ของโปรเจกต์

const aliasesPath = path.join(rootDir, "data/place_aliases.json");
// ไฟล์ alias สำหรับ map ชื่อย่อ → ชื่อสถานที่จริง

const cachePath = path.join(rootDir, "data/osm_cache.json");
// ไฟล์ cache เก็บพิกัดที่เคยค้นมาแล้ว

const aliases = JSON.parse(fs.readFileSync(aliasesPath, "utf-8"));
// ตัวอย่าง: { "CB4": ["cb4", "classroom building 4", ...] }

const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
// ตัวอย่าง: { "cb4": { lat, lon, name } }

// ====================================================
// ตัวแปรสำหรับ rate limiting (ป้องกันยิง OSM ถี่เกินไป)
// ====================================================
let lastRequestTime = 0;

// ====================================================
// 📡 ส่งพิกัดไป ROS2 ผ่าน MQTT
// ====================================================
function publishToRos(placeName, data) {
  const client = connectMQTT();
  // เชื่อมต่อ MQTT broker (reuse connection)

  const payload = {
    name: placeName,
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
  };
  // เตรียมข้อมูลพิกัดสำหรับ ROS

  console.log("📡 [MQTT] → /ros/goal:", payload);

  client.publish("/ros/goal", JSON.stringify(payload));
  // ROS Bridge จะ subscribe topic นี้เพื่อนำไปแปลงเป็น ROS2 message
}

// ====================================================
// 📡 ส่งชื่อสถานที่ (text-only) ไป ROS
// ====================================================
function publishTextToRos(normalizedName) {
  const client = connectMQTT();

  const payload = { name: normalizedName };
  // ส่งเฉพาะชื่อสถานที่ (ใช้กรณี ROS ต้องการ text)

  console.log("📡 [MQTT] → /ros/target_name:", payload);

  client.publish("/ros/target_name", JSON.stringify(payload));
}

// ====================================================
// 📡 ส่งข้อมูลพิกัดไป Frontend ผ่าน MQTT
// ====================================================
function publishToFrontend(name, lat, lon) {
  const client = connectMQTT();

  const payload = { name, lat, lon };
  // ใช้แสดงตำแหน่งบนแผนที่ฝั่งเว็บ

  console.log("📡 [MQTT] → /frontend/goal:", payload);

  client.publish("/frontend/goal", JSON.stringify(payload));
}

// ====================================================
// 🔥 MAIN API HANDLER (POST)
// ====================================================
export async function POST(req) {
  const { query } = await req.json();
  // รับข้อความจาก AI Assistant / Frontend

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 }
    );
  }

  console.log(`\n📝 [REQUEST] Raw Query: "${query}"`);

  // ==================================================
  // 🔎 Normalization (ทำความสะอาดข้อความ)
  // ==================================================
  let cleanQuery = query.trim().toLowerCase();

  cleanQuery = cleanQuery
    .replace(/^the\s+/i, "")
    .replace(/\s+building$/i, "")
    .replace(/\s+please$/i, "")
    // ลบคำฟุ่มเฟือย

    .replace(/^go\s+to\s+/i, "")
    .replace(/^bring\s+me\s+to\s+/i, "")
    .replace(/^take\s+me\s+to\s+/i, "")
    .replace(/^drive\s+to\s+/i, "")
    .replace(/^i\s+(want|wanna)\s+go\s+to\s+/i, "")
    // ลบโครงสร้างประโยคจาก ASR

    .replace(/cb\s*(\d)/i, "cb$1")
    // "cb 4" → "cb4"

    .replace(/\band\s*ten\b/gi, "n10")
    .replace(/\bend\s*ten\b/gi, "n10")
    .replace(/\ben\s*ten\b/gi, "n10");
    // แก้คำที่ ASR มักฟังผิด

  console.log(`🔎 [NORMALIZED] "${query}" → "${cleanQuery}"`);

  // ==================================================
  // 🎯 Alias Matching (ชื่อย่อ → ชื่อจริง)
  // ==================================================
  let searchQuery = query.trim();

  for (const [placeName, aliasList] of Object.entries(aliases)) {
    const allNames = [placeName, ...aliasList].map((n) => n.toLowerCase());
    if (allNames.includes(cleanQuery)) {
      console.log(`🎯 [ALIAS MATCH] "${cleanQuery}" → "${placeName}"`);
      searchQuery = placeName;
      break;
    }
  }

  console.log(`📌 [FINAL SEARCH QUERY] "${searchQuery}"`);

  // ==================================================
  // ⏳ Rate Limit (ป้องกันยิง API ถี่เกินไป)
  // ==================================================
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < 1200) {
    const wait = 1200 - elapsed;
    console.log(`⏳ [RATE LIMIT] Waiting ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }

  lastRequestTime = Date.now();

  // ==================================================
  // 🌍 เรียก OpenStreetMap (Nominatim API)
  // ==================================================
  const bbox = "100.488,13.646,100.499,13.656"; // ขอบเขต KMUTT

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    searchQuery
  )}&viewbox=${bbox}&bounded=1&countrycodes=th&limit=10`;

  try {
    console.log(`🌍 [API CALL] ${url}`);

    const osmRes = await fetch(url, {
      headers: { "User-Agent": "KMUTT-MapAssistant/1.0" },
      signal: AbortSignal.timeout(8000),
    });

    const osmData = await osmRes.json();
    console.log(`🌍 [API RESULT] ${osmData.length} results`);

    // ==================================================
    // 💾 Update cache ถ้ายังไม่เคยมี
    // ==================================================
    if (osmData.length > 0 && cleanQuery && !cache[cleanQuery]) {
      const name = osmData[0].display_name.split(",")[0];
      cache[cleanQuery] = {
        lat: osmData[0].lat,
        lon: osmData[0].lon,
        name,
      };
      console.log(`💾 [CACHE UPDATE] Added "${cleanQuery}"`);
    }

    // ==================================================
    // 🚀 ส่งข้อมูลไป ROS + Frontend
    // ==================================================
    if (osmData.length > 0) {
      const lat = parseFloat(osmData[0].lat);
      const lon = parseFloat(osmData[0].lon);

      publishToRos(searchQuery, osmData[0]);
      publishTextToRos(cleanQuery);
      publishToFrontend(searchQuery, lat, lon);

      broadcast({
        type: "goal",
        name: searchQuery,
        normalized: cleanQuery,
        lat,
        lon,
      });
    }

    return NextResponse.json({
      original: query,
      normalized: cleanQuery,
      mapped_to: searchQuery,
      results: osmData,
    });

  } catch (error) {
    console.log(`❌ [API ERROR] ${error.message}`);

    // ==================================================
    // 🧯 fallback: ใช้ cache ถ้า API ล้ม
    // ==================================================
    if (cache[cleanQuery]) {
      console.log(`💾 [CACHE HIT] "${cleanQuery}"`);

      const cached = cache[cleanQuery];

      publishToRos(searchQuery, cached);
      publishTextToRos(cleanQuery);
      publishToFrontend(searchQuery, cached.lat, cached.lon);

      broadcast({
        type: "goal",
        name: searchQuery,
        normalized: cleanQuery,
        lat: cached.lat,
        lon: cached.lon,
      });

      return NextResponse.json({
        cached: true,
        results: [cached],
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch OSM", detail: error.message },
      { status: 500 }
    );
  }
}
