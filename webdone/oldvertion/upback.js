// app/api/search/backend/route.js
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// อ่านไฟล์แบบ absolute path
const rootDir = process.cwd();

const aliasesPath = path.join(rootDir, 'data/place_aliases.json');
const cachePath   = path.join(rootDir, 'data/osm_cache.json');

// โหลด JSON
const aliases = JSON.parse(fs.readFileSync(aliasesPath, 'utf-8'));
const cache   = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

// ตัวแปรกันยิงถี่
let lastRequestTime = 0;

export async function POST(req) {
  const { query } = await req.json()
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 })
  }

  console.log(`\n📝 [REQUEST] Raw Query: "${query}"`)

  // Normalize
  let cleanQuery = query.trim().toLowerCase()

  cleanQuery = cleanQuery
    .replace(/^the\s+/i, '')
    .replace(/\s+building$/i, '')
    .replace(/\s+please$/i, '')
    .replace(/^go\s+to\s+/i, '')
    .replace(/^bring\s+me\s+to\s+/i, '')
    .replace(/^take\s+me\s+to\s+/i, '')
    .replace(/^drive\s+to\s+/i, '')
    .replace(/^i\s+(want|wanna)\s+go\s+to\s+/i, '')
    .replace(/cb\s*(\d)/i, 'cb$1')
    .replace(/\band\s*ten\b/gi, 'n10')
    .replace(/\bend\s*ten\b/gi, 'n10')
    .replace(/\ben\s*ten\b/gi, 'n10')

  console.log(`🔎 [NORMALIZED] "${query}" → "${cleanQuery}"`)

  // alias matching
  let searchQuery = query.trim()
  for (const [placeName, aliasList] of Object.entries(aliases)) {
    const allNames = [placeName, ...aliasList].map(n => n.toLowerCase());
    if (allNames.includes(cleanQuery)) {
      console.log(`🎯 [ALIAS MATCH] "${cleanQuery}" → "${placeName}"`)
      searchQuery = placeName;
      break;
    }
  }

  console.log(`📌 [FINAL SEARCH QUERY] "${searchQuery}"`)

  // กันยิงซ้ำเร็วเกิน
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1200) {
    const wait = 1200 - elapsed
    console.log(`⏳ [RATE LIMIT] Waiting ${wait}ms`)
    await new Promise(r => setTimeout(r, wait));
  }
  lastRequestTime = Date.now();

  // KMUTT bounding box
  const bbox = '100.488,13.646,100.499,13.656';
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    searchQuery
  )}&viewbox=${bbox}&bounded=1&countrycodes=th&limit=10`;

  try {
    console.log(`🌍 [API CALL] ${url}`)

    const osmRes = await fetch(url, {
      headers: { 'User-Agent': 'KMUTT-MapAssistant/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    const osmData = await osmRes.json();

    console.log(`🌍 [API RESULT] "${searchQuery}" → ${osmData.length} results`)

    // อัปเดต cache
    if (osmData.length > 0 && cleanQuery && !cache[cleanQuery]) {
      const name = osmData[0].display_name.split(',')[0];
      cache[cleanQuery] = {
        lat: osmData[0].lat,
        lon: osmData[0].lon,
        name,
      };

      console.log(`💾 [CACHE UPDATE] Added new cache entry for "${cleanQuery}"`)
    }

    return NextResponse.json({
      original: query,
      normalized: cleanQuery,
      mapped_to: searchQuery,
      results: osmData,
    });

  } catch (error) {
    console.log(`❌ [API ERROR] ${error.message}`)

    // ใช้ cache ถ้ามี
    if (cache[cleanQuery]) {
      console.log(`💾 [CACHE HIT] "${cleanQuery}" →`, cache[cleanQuery])
      return NextResponse.json({
        original: query,
        normalized: cleanQuery,
        mapped_to: searchQuery,
        cached: true,
        results: [cache[cleanQuery]],
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch OSM', detail: error.message },
      { status: 500 }
    );
  }
}
