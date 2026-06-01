"use client";

import { useEffect, useState } from "react";

export default function MapPage() {
  const [userPos, setUserPos] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
  } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Your browser does not support geolocation");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });

        console.log("User location:", {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        alert("Cannot get location: " + err.message);
      }
    );
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Map Page</h2>

      {userPos ? (
        <div style={{ marginTop: "20px" }}>
          <strong>📍 Your Position</strong>
          <p>Latitude: {userPos.lat}</p>
          <p>Longitude: {userPos.lon}</p>
          <p>Accuracy: ±{userPos.accuracy} m</p>
        </div>
      ) : (
        <p>กำลังดึงตำแหน่ง...</p>
      )}

      <div
        id="map"
        style={{
          height: "500px",
          width: "100%",
          marginTop: "20px",
          border: "1px solid #ccc",
          borderRadius: "8px",
        }}
      ></div>
    </div>
  );
}