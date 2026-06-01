// app/api/ws/route.js
export const config = {
  runtime: "edge",
};

let clients = [];

export default function handler(req) {
  const { searchParams } = new URL(req.url);

  // 👉 ต้องมี query นี้ตรง ๆ
  if (searchParams.get("upgrade") === "websocket") {
    return new Response(null, {
      status: 101,
      webSocket: {
        onopen(ws) {
          console.log("🔌 WS Connected");
          clients.push(ws);
        },

        onclose(ws) {
          clients = clients.filter((c) => c !== ws);
          console.log("❌ WS Disconnected");
        },

        onmessage(msg) {
          // ไม่จำเป็น แต่ใส่ไว้
          console.log("💬 WS message from client:", msg.data);
        },
      },
    });
  }

  return new Response("WS endpoint ready");
}

export function broadcast(data) {
  const json = JSON.stringify(data);

  clients.forEach((ws) => {
    try {
      ws.send(json);
    } catch (e) {
      console.log("⚠️ WS send error", e);
    }
  });
}

