import { NextResponse } from "next/server";
// import { connectMQTT } from "../../../lib/mqtt-client";
import { connectMQTT } from "../../lib/mqtt-client";


// export async function POST(req) {
//   const { command } = await req.json();

//   if (!command) {
//     return NextResponse.json(
//       { error: "Missing command" },
//       { status: 400 }
//     );
//   }

//   const client = connectMQTT();

//   client.publish(
//     "/ros/command",
//     JSON.stringify({ command })
//   );

//   console.log("📡 MQTT → /ros/command:", command);

//   return NextResponse.json({ ok: true, command });
// }
export async function POST(req) {
  const { command } = await req.json();

  if (!command) {
    return NextResponse.json(
      { error: "Missing command" },
      { status: 400 }
    );
  }

  const client = connectMQTT();

  // ✅ ใช้ stop_car ให้ส่งเหมือน cancel navigation เดิม
  if (command === "stop_car") {
    const goalPayload = {
      lat: 999,
      lon: 999,
      message: "Navigation canceled by stop command",
      status: "canceled",
    };

    const pathPayload = {
      type: "path",
      status: "canceled",
      timestamp: Date.now(),
      points: [{ lat: 999, lon: 999 }],
    };

    client.publish("cloud/ros/goal", JSON.stringify(goalPayload));
    client.publish("cloud/ros/path", JSON.stringify(pathPayload));

    console.log("🛑 MQTT → cloud/ros/goal:", goalPayload);
    console.log("🛑 MQTT → cloud/ros/path:", pathPayload);

    return NextResponse.json({
      ok: true,
      command,
      sent: ["cloud/ros/goal", "cloud/ros/path"],
      stop_code: 999,
    });
  }

  // คำสั่งอื่น暂时ยังส่งแบบเดิมไว้ก่อน
  client.publish(
    "/ros/command",
    JSON.stringify({ command })
  );

  console.log("📡 MQTT → /ros/command:", command);

  return NextResponse.json({ ok: true, command });
}