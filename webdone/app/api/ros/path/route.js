import { NextResponse } from "next/server";
import { connectMQTT } from "../../../lib/mqtt-client";

export async function POST(req) {
  const body = await req.json();
  const client = connectMQTT();

  if (!body.points || !Array.isArray(body.points)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  client.publish(
    "/ros/path",
    JSON.stringify({
      type: "path",
      timestamp: Date.now(),
      points: body.points,
    })
  );

  console.log("📡 Published /ros/path:", body.points.length, "points");

  return NextResponse.json({ ok: true });
}
