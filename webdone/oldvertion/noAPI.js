// app/api/search/backend/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json(
      { message: "กรุณาระบุชื่อสถานที่ในพารามิเตอร์ q" },
      { status: 400 }
    );
  }

  try {
    // เรียก API ออฟไลน์ FastAPI แทน OSM
    const res = await fetch(`http://127.0.0.1:8010/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("FastAPI connection error:", error);
    return NextResponse.json(
      { message: "❌ ไม่สามารถเชื่อมต่อกับ FastAPI ได้", error: error.message },
      { status: 500 }
    );
  }
}
