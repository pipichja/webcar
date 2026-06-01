const mqtt = require('mqtt');

// --- ⚙️ CONFIGURATION ---
// 🏠 Local MQTT (หุ่นยนต์ที่บ้าน)
const LOCAL_BROKER = "ws://localhost:9001"; 

// ☁️ Cloud MQTT (Firebase จะมาคุยที่นี่)
// หมายเหตุ: เดี๋ยวพอได้ URL จาก HiveMQ หรือ EMQX ค่อยเอามาเปลี่ยนตรงนี้ครับ
const CLOUD_CONFIG = {
    url: "mqtts://77b427887da34c02a3128a6813c6c310.s1.eu.hivemq.cloud:8883", 
    options: {
        username: "pipich",
        password: "Pipi1234_"
    }
};

// --- 🔌 CONNECTION ---
const localClient = mqtt.connect(LOCAL_BROKER);
const cloudClient = mqtt.connect(CLOUD_CONFIG.url, CLOUD_CONFIG.options);

// --- 📡 LOCAL -> CLOUD (ส่งค่าจากหุ่นขึ้นเว็บ) ---
localClient.on('connect', () => {
    console.log("✅ [Local] Connected to Robot MQTT");
    localClient.subscribe("/ros/gnss");
    // localClient.subscribe("/ros/path"); // แถมอันนี้ให้ด้วย เพราะเห็นใน API คุณมี
});

localClient.on('message', (topic, message) => {
    // ยิงขึ้น Cloud โดยใส่ prefix 'cloud/' เพื่อไม่ให้สับสน
    console.log(`📡 Forwarding ${topic} to Cloud...`);
    cloudClient.publish(`cloud${topic}`, message);
});

// --- ☁️ CLOUD -> LOCAL (รับคำสั่งจากเว็บลงหุ่น) ---
cloudClient.on('connect', () => {
    console.log("☁️ [Cloud] Connected to Cloud Broker");
    cloudClient.subscribe("cloud/ros/goal");
    cloudClient.subscribe("cloud/ros/target_name");
    cloudClient.subscribe("cloud/ros/path");
});

cloudClient.on('message', (topic, message) => {
    if (topic.startsWith("cloud/ros/")) {
        const localTopic = topic.replace("cloud", ""); // ตัดคำว่า cloud ออก
        console.log(`📥 Received from Web, sending to Robot: ${localTopic}`);
        localClient.publish(localTopic, message);
    }
});