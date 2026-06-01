import { NextResponse } from "next/server";
// import { connectMQTT, getLastPose } from "../../../lib/mqtt-client";
// // เปลี่ยนจาก getLastPose เป็น getLastGnss ตามที่มันแนะนำ
// import { connectMQTT, getLastGnss } from "@/app/lib/mqtt-client";
// เปลี่ยน getLastPose เป็น getLastGnss
import { connectMQTT, getLastGnss } from "../../../lib/mqtt-client";

export async function GET() {
  connectMQTT();
  return NextResponse.json(getLastGnss() || {});
}


// export async function GET() {
//   const gnss = getLastGnss();
//   return NextResponse.json(gnss || { message: "No data yet" });
// }