// app/api/search/backend/route.js
import { NextResponse } from 'next/server'

export async function POST(req) {
  const { query } = await req.json()

  // เรียก OpenStreetMap API
  const osmRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
  const osmData = await osmRes.json()

  return NextResponse.json(osmData)
}