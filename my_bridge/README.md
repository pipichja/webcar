# OSRM Route Test – ROS2 Bag

This ROS2 bag contains navigation data generated from OSRM and sent through the MQTT bridge.

## 📌 Purpose
Used for testing controller and path tracking with OSRM-generated routes.

---

## 📡 Recorded Topics & Data Description

### 1️⃣ /nav_path  (nav_msgs/msg/Path)
Generated path from OSRM.

Contains:
- header.frame_id = "map"
- poses[] (array of PoseStamped)
- position.x = longitude
- position.y = latitude
- position.z = 0.0

⚠ Lat/Lon are directly mapped to x/y (no ENU conversion).

---

### 2️⃣ /goal_pose  (geometry_msgs/msg/PoseStamped)
Current navigation goal.

Contains:
- position.x = longitude
- position.y = latitude
- frame_id = "map"

If navigation is canceled:
- Goal is set to (0, 0)

---

### 3️⃣ /target_name  (std_msgs/msg/String)
Name of selected destination.

Example:
- "อาคารเรียนรวม 2"
- "kmutt canteen"

---

## ▶ How to Play

```bash
ros2 bag play rosbag2_YYYY_MM_DD-HH_MM_SS