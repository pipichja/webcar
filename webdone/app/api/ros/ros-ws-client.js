import WebSocket from "ws";

let ws = null;
let lastPose = null;

export function connectRosWS() {
  // ถ้าต่อแล้ว ให้ reuse connection เดิม
  if (ws) return ws;

  ws = new WebSocket("ws://localhost:8765");

  ws.on("open", () => {
    console.log("[Backend → ROS] WebSocket connected");
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());

    // รับจาก ROS2 (current pose)
    if (msg.type === "current_pose") {
      lastPose = msg;
    }
  });

  ws.on("close", () => {
    console.log("[Backend → ROS] Disconnected. Reconnecting...");
    ws = null;
    setTimeout(connectRosWS, 2000);
  });

  ws.on("error", (err) => {
    console.error("[ROS-WS Error]", err);
  });

  return ws;
}

// ใช้ดึงตำแหน่งล่าสุดไปให้ frontend
export function getLastPose() {
  return lastPose;
}
