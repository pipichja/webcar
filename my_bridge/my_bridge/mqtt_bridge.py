#!/usr/bin/env python3
import json

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, QoSReliabilityPolicy

from geometry_msgs.msg import PoseStamped
from sensor_msgs.msg import NavSatFix
from std_msgs.msg import String
from nav_msgs.msg import Path


import paho.mqtt.client as mqtt


class MQTTBridge(Node):
    def __init__(self):
        super().__init__("mqtt_bridge")

        # ================= QoS (สำคัญมาก) =================
        qos_sensor = QoSProfile(
            depth=10,
            reliability=QoSReliabilityPolicy.BEST_EFFORT
        )

        # ================= ROS PUB =================
        self.goal_pub = self.create_publisher(PoseStamped, "/goal_pose", 10)
        self.text_pub = self.create_publisher(String, "/nav_text", 10)
        self.target_pub = self.create_publisher(String, "/target_name", 10)
        self.command_pub = self.create_publisher(String, "/nav_command", 10)
        self.path_pub = self.create_publisher(Path, "/desired_path", 10)


        # ================= ROS SUB =================
        self.create_subscription(
            PoseStamped,
            "/current_pose",
            self.current_pose_cb,
            10
        )

        # 🔥 GNSS ตัวจริง (NavSatFix + BEST_EFFORT)
        self.create_subscription(
            NavSatFix,
            # "/gnss",
            "/fix",
            self.gnss_cb,
            qos_sensor
        )

        # ================= MQTT =================
        self.mqtt = mqtt.Client()
        self.mqtt.on_connect = self.on_connect
        self.mqtt.on_message = self.on_message
        self.mqtt.connect("localhost", 1883, 60)

        self.get_logger().info("MQTT Bridge Started")
        self.mqtt.loop_start()

    # ================= MQTT CALLBACKS =================

    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.get_logger().info("Connected to MQTT broker")
        else:
            self.get_logger().error(f"Failed to connect MQTT, rc={rc}")
            return

        client.subscribe("/ros/goal")
        client.subscribe("/ros/target_name")
        client.subscribe("/ros/command")
        client.subscribe("/ros/path")


    def on_message(self, client, userdata, msg):
        try:
            payload_str = msg.payload.decode()
            data = json.loads(payload_str)
            self.get_logger().info(f"MQTT message on {msg.topic}: {payload_str}")

            if msg.topic == "/ros/goal":
                self.handle_goal(data)

            elif msg.topic == "/ros/target_name":
                self.handle_target_name(data)

            elif msg.topic == "/ros/command":
                self.handle_command(data)

            elif msg.topic == "/ros/path":
                self.handle_path(data)


        except Exception as e:
            self.get_logger().error(f"MQTT on_message error: {e}")

    # ================= MQTT → ROS HANDLERS =================

    def handle_goal(self, data):
        if "x" in data and "y" in data:
            x = float(data["x"])
            y = float(data["y"])
        elif "lat" in data and "lon" in data:
            x = float(data["lon"])
            y = float(data["lat"])
        else:
            self.get_logger().error(f"Unknown goal format: {data}")
            return

        msg = PoseStamped()
        msg.header.frame_id = "map"
        msg.header.stamp = self.get_clock().now().to_msg()
        msg.pose.position.x = x
        msg.pose.position.y = y

        self.goal_pub.publish(msg)

        if "name" in data:
            text = String()
            text.data = f"Navigating to {data['name']}"
            self.text_pub.publish(text)

    def handle_target_name(self, data):
        name = data.get("name")
        if not name:
            self.get_logger().error(f"target_name missing 'name': {data}")
            return

        msg = String()
        msg.data = name
        self.target_pub.publish(msg)

    def handle_command(self, data):
        cmd = data.get("command")
        if not cmd:
            self.get_logger().error(f"command missing key: {data}")
            return

        msg = String()
        msg.data = cmd
        self.command_pub.publish(msg)       

    def handle_path(self, data):
         points = data.get("points")
         if not points:
             self.get_logger().error(f"path missing 'points': {data}")
             return     

         path_msg = Path()
         path_msg.header.frame_id = "map"
         path_msg.header.stamp = self.get_clock().now().to_msg()    

         for p in points:
             pose = PoseStamped()
             pose.header.frame_id = "map"
             pose.header.stamp = path_msg.header.stamp      

             # ⚠ ตอนนี้คุณส่ง lat/lon มา
             # ถ้า controller ใช้ ENU/map frame ต้องแปลงก่อน
             pose.pose.position.x = float(p["lon"])
             pose.pose.position.y = float(p["lat"])
             pose.pose.position.z = 0.0     

             path_msg.poses.append(pose)    

         self.path_pub.publish(path_msg)
         self.get_logger().info(f"Published desired_path with {len(points)} points")
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    

    # ================= ROS CALLBACKS =================

    def current_pose_cb(self, msg: PoseStamped):
        try:
            payload = json.dumps({
                "x": msg.pose.position.x,
                "y": msg.pose.position.y,
                "z": msg.pose.position.z
            })
            self.mqtt.publish("/ros/current", payload)
        except Exception as e:
            self.get_logger().error(f"current_pose_cb error: {e}")

    def gnss_cb(self, msg: NavSatFix):
        # 🔥 ถ้า callback นี้ถูกเรียก แปลว่าทุกอย่างถูกหมดแล้ว
        self.get_logger().info(
            f"GNSS_CB CALLED lat={msg.latitude}, lon={msg.longitude}"
        )
        try:
            payload = json.dumps({
                "lat": msg.latitude,
                "lon": msg.longitude,
                "alt": msg.altitude
            })
            self.mqtt.publish("/ros/gnss", payload)
        except Exception as e:
            self.get_logger().error(f"gnss_cb error: {e}")

    # ================= CLEANUP =================

    def destroy_node(self):
        try:
            self.mqtt.loop_stop()
            self.mqtt.disconnect()
            self.get_logger().info("MQTT disconnected")
        except Exception as e:
            self.get_logger().warn(f"Error while stopping MQTT: {e}")
        super().destroy_node()


def main(args=None):
    rclpy.init(args=args)
    node = MQTTBridge()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        node.get_logger().info("KeyboardInterrupt → shutting down.")
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()




