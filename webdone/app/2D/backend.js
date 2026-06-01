// app/api/search/backend/route.js
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// ⭐ ใช้ MQTT client กลาง
import { connectMQTT } from "../../../lib/mqtt-client";

// ⭐ WebSocket broadcast (Frontend realtime)
import { broadcast } from "../../ws/route";

// อ่านไฟล์แบบ absolute path
const rootDir = process.cwd();

const aliasesPath = path.join(rootDir, "data/place_aliases.json");
const cachePath = path.join(rootDir, "data/osm_cache.json");

// โหลด JSON
const aliases = JSON.parse(fs.readFileSync(aliasesPath, "utf-8"));
const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));

// กันยิงถี่
let lastRequestTime = 0;

/* ----------------------------------------------------
   📡 ส่งพิกัดไป ROS
---------------------------------------------------- */
function publishToRos(placeName, data) {
  const client = connectMQTT();

  const payload = {
    name: placeName,
    lat: parseFloat(data.lat),
    lon: parseFloat(data.lon),
  };

  console.log("📡 [MQTT] → /ros/goal:", payload);

  client.publish("/ros/goal", JSON.stringify(payload));
   console.log("✅ MQTT publish ACK /frontend/goal");
}

/* ----------------------------------------------------
   📡 ส่งชื่อ place ให้ ROS (/ros/target_name)
---------------------------------------------------- */
function publishTextToRos(normalizedName) {
  const client = connectMQTT();

  const payload = { name: normalizedName };

  console.log("📡 [MQTT] → /ros/target_name:", payload);

  client.publish("/ros/target_name", JSON.stringify(payload));
}

/* ----------------------------------------------------
   📡 ส่งไป Frontend ผ่าน MQTT
---------------------------------------------------- */
function publishToFrontend(name, lat, lon) {
  const client = connectMQTT();

  const payload = { name, lat, lon };

  console.log("📡 [MQTT] → /frontend/goal:", payload);

  client.publish("/frontend/goal", JSON.stringify(payload));
}

/* ----------------------------------------------------
   🔥 MAIN HANDLER
---------------------------------------------------- */
export async function POST(req) {
  const { query } = await req.json();

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 }
    );
  }

  console.log(`\n📝 [REQUEST] Raw Query: "${query}"`);

  /* ---------------------- Normalize ---------------------- */
  let cleanQuery = query.trim().toLowerCase();
  cleanQuery = cleanQuery
    .replace(/^the\s+/i, "")
    .replace(/\s+building$/i, "")
    .replace(/\s+please$/i, "")
    .replace(/^go\s+to\s+/i, "")
    .replace(/^bring\s+me\s+to\s+/i, "")
    .replace(/^take\s+me\s+to\s+/i, "")
    .replace(/^drive\s+to\s+/i, "")
    .replace(/^i\s+(want|wanna)\s+go\s+to\s+/i, "")
    .replace(/cb\s*(\d)/i, "cb$1")
    .replace(/\band\s*ten\b/gi, "n10")
    .replace(/\bend\s*ten\b/gi, "n10")
    .replace(/\ben\s*ten\b/gi, "n10");

  console.log(`🔎 [NORMALIZED] "${query}" → "${cleanQuery}"`);

  /* ---------------------- Alias Match ---------------------- */
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

  /* ---------------------- Rate Limit ---------------------- */
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1200) {
    const wait = 1200 - elapsed;
    console.log(`⏳ [RATE LIMIT] Waiting ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  /* ---------------------- OSM Search ---------------------- */
  const bbox = "100.488,13.646,100.499,13.656";

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

    /* ---------- อัปเดต cache ถ้าเจอ ---------- */
    if (osmData.length > 0 && cleanQuery && !cache[cleanQuery]) {
      const name = osmData[0].display_name.split(",")[0];
      cache[cleanQuery] = {
        lat: osmData[0].lat,
        lon: osmData[0].lon,
        name,
      };

      console.log(`💾 [CACHE UPDATE] Added "${cleanQuery}"`);
    }

    /* ---------- ส่งผลไป ROS + Frontend ---------- */
    if (osmData.length > 0) {
      const lat = parseFloat(osmData[0].lat);
      const lon = parseFloat(osmData[0].lon);

      console.log("🔥 CALLING MQTT PUBLISH NOW!!");

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

    /* ---------------------- Catch API Error ---------------------- */
  } catch (error) {
    console.log(`❌ [API ERROR] ${error.message}`);

    /* ---------- ใช้ cache แทน ---------- */
    if (cache[cleanQuery]) {
      console.log(`💾 [CACHE HIT] "${cleanQuery}"`);

      const cached = cache[cleanQuery];
      const lat = parseFloat(cached.lat);
      const lon = parseFloat(cached.lon);

      publishToRos(searchQuery, cached);
      publishTextToRos(cleanQuery);
      publishToFrontend(searchQuery, lat, lon);

      broadcast({
        type: "goal",
        name: searchQuery,
        normalized: cleanQuery,
        lat,
        lon,
      });

      return NextResponse.json({
        original: query,
        normalized: cleanQuery,
        mapped_to: searchQuery,
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
