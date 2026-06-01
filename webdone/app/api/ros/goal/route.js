import { NextResponse } from "next/server";
import { connectMQTT } from "../../../lib/mqtt-client";

export async function POST(req) {
  const body = await req.json();
  const client = connectMQTT();

  if (body.type === "text") {
    client.publish(
      "/ros/target_name",
      JSON.stringify({ name: body.value })
    );
    return NextResponse.json({ ok: true, mode: "text", name: body.value });
  }

  client.publish(
    "/ros/goal",
    JSON.stringify({
      x: body.x,
      y: body.y,
    })
  );

  return NextResponse.json({
    ok: true,
    mode: "goal",
    x: body.x,
    y: body.y,
  });
}
