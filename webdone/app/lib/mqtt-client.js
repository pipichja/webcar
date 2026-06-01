import mqtt from "mqtt";

// let client = null;
// let lastGnss = null;

// export function connectMQTT() {

//   if (client) return client;

//   client = mqtt.connect("ws://localhost:9001");

//   client.on("connect", () => {
//     console.log("📡 MQTT connected (backend)");
//     client.subscribe("/ros/gnss");
//   });

//   client.on("message", (topic, message) => {
//     if (topic === "/ros/gnss") {
//       try {
//         lastGnss = JSON.parse(message.toString());
//       } catch {}
//     }
//   });

//   return client;
// }

// export function getLastGnss() {
//   return lastGnss;
// }

let client = null;
let lastGnss = null;

export function connectMQTT() {
  if (client) return client;

  // ✅ เปลี่ยนจาก localhost เป็น HiveMQ Cloud URL (ใช้ wss และพอร์ต 8884)
  const brokerUrl = "wss://77b427887da34c02a3128a6813c6c310.s1.eu.hivemq.cloud:8884/mqtt";

  client = mqtt.connect(brokerUrl, {
    username: "pipich", // Username ที่สร้างใน HiveMQ
    password: "Pipi1234_", //  Password ที่สร้างใน HiveMQ
    protocol: 'wss',
    reconnectPeriod: 1000,     // พยายามเชื่อมต่อใหม่ทุก 1 วินาทีถ้าหลุด
  });

  client.on("connect", () => {
    console.log("☁️ Connected to HiveMQ Cloud MQTT");
    
    // ✅ Subscribe ผ่านท่อ Cloud (ชื่อ Topic ต้องตรงกับที่ web-bridge ส่งมา)
    client.subscribe("cloud/ros/gnss");
  });

  client.on("message", (topic, message) => {
    // ✅ เช็ค Topic ที่มาจาก Cloud
    if (topic === "cloud/ros/gnss") {
      try {
        lastGnss = JSON.parse(message.toString());
        // console.log("📍 Received GNSS from Cloud:", lastGnss);
      } catch (e) {
        console.error("❌ Invalid GNSS JSON:", e);
      }
    }
  });

  client.on("error", (err) => {
    console.error("⚠️ MQTT Error:", err);
  });

  return client;
}

export function getLastGnss() {
  return lastGnss;
}