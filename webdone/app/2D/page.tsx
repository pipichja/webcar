"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

// ⭐ MQTT client
import mqtt from "mqtt";

export default function MapPage() {
  // ----------------------------------------
  // Refs
  // ----------------------------------------
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const startMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  const userIconRef = useRef<any>(null);
  const destIconRef = useRef<any>(null);
  const buildingIconRef = useRef<any>(null);

  const drawRouteRef = useRef<any>(null);

  // ----------------------------------------
  // UI States
  // ----------------------------------------
  const [hasRoute, setHasRoute] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingBuilding, setPendingBuilding] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const [destinationName, setDestinationName] = useState("");
  const [etaText, setEtaText] = useState("");
  const [distanceText, setDistanceText] = useState("");

  // ----------------------------------------
  // STEP 1 — Get initial GPS
  // ----------------------------------------
  function getInitialPosition(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          }),
        () => resolve({ lat: 13.6510, lon: 100.494 }),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  }

  // ----------------------------------------
  // STEP 2 — Init Map
  // ----------------------------------------
  async function initMap(initialLat: number, initialLon: number) {
    const L = await import("leaflet");
    LRef.current = L;

    delete (L.Icon.Default.prototype as any)._getIconUrl;

    // Icons
    userIconRef.current = L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854894.png",
      iconSize: [45, 45],
      iconAnchor: [22, 45],
    });

    buildingIconRef.current = L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/1670/1670619.png",
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    destIconRef.current = L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/535/535239.png",
      iconSize: [45, 45],
      iconAnchor: [22, 45],
    });

    const bounds = L.latLngBounds([13.648, 100.490], [13.655, 100.496]);

    const map = L.map("map", {
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
    }).setView([initialLat, initialLon], 18);

    mapRef.current = map;

    // Tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      minZoom: 16,
      maxZoom: 20,
    }).addTo(map);

    // User location marker
    startMarkerRef.current = L.marker([initialLat, initialLon], {
      icon: userIconRef.current,
    }).addTo(map);

    // Buildings list
    const buildings = [
      { name: "CB4", lat: 13.6496023, lon: 100.4926927 },
      { name: "CB3", lat: 13.649862, lon: 100.4919508 },
      { name: "CB5", lat: 13.6497222, lon: 100.4933965 },
      { name: "คณะพลังงานสิ่งแวดล้อม", lat: 13.6489396, lon: 100.4935597 },
      { name: "คณะวิศวกรรมโยธา", lat: 13.6503391, lon: 100.49406 },
      { name: "วิศวะวัฒนะ", lat: 13.6500027, lon: 100.4942146 },
      { name: "CB1", lat: 13.6515239, lon: 100.4933439 },
      { name: "CB2", lat: 13.651468, lon: 100.4939285 },
      { name: "SIT", lat: 13.6519136, lon: 100.4933283 },
      { name: "คณิตศาสตร์", lat: 13.6526045, lon: 100.4936294 },
      { name: "LX", lat: 13.6526153, lon: 100.4945135 },
      { name: "เคมี", lat: 13.6519226, lon: 100.4940636 },
      { name: "โรงอาหาร (Canteen)", lat: 13.6508508, lon: 100.4917502 },
      { name: "ตึกจอดรถ 14 ชั้น", lat: 13.6503826, lon: 100.495632 },
      { name: "หอพัก 2 (ชาย)", lat: 13.6493964, lon: 100.494534 },
      { name: "หอพัก 1 (หญิง)", lat: 13.6488715, lon: 100.4947238 },
      { name: "Green Society", lat: 13.6495746, lon: 100.493663 },
    ];

    // ----------------------------------------------------
    // CANCEL ROUTE
    // ----------------------------------------------------
    function cancelRoute() {
      if (routeLayerRef.current)
        map.removeLayer(routeLayerRef.current);
      if (destMarkerRef.current)
        map.removeLayer(destMarkerRef.current);

      routeLayerRef.current = null;
      destMarkerRef.current = null;

      setHasRoute(false);
      setPendingBuilding(null);
      setIsNavigating(false);

      setDestinationName("");
      setEtaText("");
      setDistanceText("");
    }
    (window as any).cancelRoute = cancelRoute;

    // ----------------------------------------------------
    // DRAW ROUTE
    // ----------------------------------------------------
    drawRouteRef.current = function (lat, lon, name) {
      const start = startMarkerRef.current.getLatLng();
      const L = LRef.current;

      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${lon},${lat}?overview=full&geometries=geojson`;

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (!data.routes?.length) return;

          const route = data.routes[0];

          if (routeLayerRef.current)
            map.removeLayer(routeLayerRef.current);

          routeLayerRef.current = L.geoJSON(route.geometry, {
            style: { color: "blue", weight: 6 },
          }).addTo(map);

          setDestinationName(name);
          setDistanceText(`${Math.floor(route.distance)} m`);
          setEtaText(`${Math.ceil(route.duration / 60)} นาที`);
          setHasRoute(true);
        });
    };

    // ----------------------------------------------------
    // TAPPING BUILDING
    // ----------------------------------------------------
    function handleUserSelectBuilding(b) {
      cancelRoute();

      destMarkerRef.current = L.marker([b.lat, b.lon], {
        icon: destIconRef.current,
      }).addTo(map);

      drawRouteRef.current(b.lat, b.lon, b.name);
      setPendingBuilding(b);
    }

    buildings.forEach((b) => {
      const marker = L.marker([b.lat, b.lon], {
        icon: buildingIconRef.current,
      }).addTo(map);

      marker.bindTooltip(b.name, {
        permanent: true,
        direction: "top",
        offset: [0, -36],
      });

      marker.on("click", () => handleUserSelectBuilding(b));
    });

    // ----------------------------------------------------
    // GPS smoothing
    // ----------------------------------------------------
    let latest = { lat: initialLat, lon: initialLon };
    let smoothLat = latest.lat;
    let smoothLon = latest.lon;

    function smooth(p, n) {
      return p + (n - p) * 0.25;
    }

    navigator.geolocation.watchPosition(
      (pos) => {
        latest = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    setInterval(() => {
      smoothLat = smooth(smoothLat, latest.lat);
      smoothLon = smooth(smoothLon, latest.lon);
      startMarkerRef.current.setLatLng([smoothLat, smoothLon]);
    }, 2000);

    setLoading(false);
  }

  // ----------------------------------------------------
  // ⭐ MQTT Listener (Voice → Frontend)
  // ----------------------------------------------------
useEffect(() => {
  const client = mqtt.connect("ws://localhost:9001");

  client.on("connect", () => {
    console.log("📡 MQTT Connected → Frontend");
    client.subscribe("/frontend/goal");
  });

  client.on("message", (topic, message) => {
    if (topic !== "/frontend/goal") return;

    const data = JSON.parse(message.toString());
    console.log("🎯 MQTT Received:", data);

    (window as any).cancelRoute();

    destMarkerRef.current = LRef.current
      .marker([data.lat, data.lon], { icon: destIconRef.current })
      .addTo(mapRef.current);

    drawRouteRef.current(data.lat, data.lon, data.name);
    setIsNavigating(true);
  });

  // ✅ FIX: cleanup function ต้อง return function ไม่ใช่ object
  return () => {
    client.end();
  };
}, []);

  // ----------------------------------------
  // INIT SYSTEM
  // ----------------------------------------
  useEffect(() => {
    (async () => {
      const pos = await getInitialPosition();
      await initMap(pos.lat, pos.lon);
    })();
  }, []);

  // ----------------------------------------
  // UI SECTION
  // ----------------------------------------
  return (
    <>
      {/* LOADING */}
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            color: "white",
            fontSize: "26px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 99999,
          }}
        >
          กำลังดึงตำแหน่งจริง...
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          position: "fixed",
          top: 0,
          width: "100%",
          height: "70px",
          background: "#000000f2",
          color: "white",
          fontSize: "26px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: "1px solid #333",
          zIndex: 9999,
        }}
      >
        KMUTT Navigation
      </div>

      {/* MAP */}
      <div
        id="map"
        style={{
          position: "absolute",
          top: "70px",
          bottom: hasRoute ? "220px" : "0px",
          width: "100%",
        }}
      />

      {/* ROUTE SUMMARY */}
      {hasRoute && (
        <div
          style={{
            position: "fixed",
            bottom: "140px",
            width: "100%",
            background: "white",
            padding: "22px 32px",
            fontSize: "22px",
            fontWeight: 600,
            borderTop: "1px solid #ddd",
            boxShadow: "0px -4px 10px rgba(0,0,0,0.15)",
            color: "#000",
            zIndex: 9999,
          }}
        >
          <div>
            <b>ปลายทาง / Destination:</b> {destinationName}
          </div>
          <div>
            <b>เวลาเดินทาง / Estimated Time:</b> {etaText}
          </div>
          <div>
            <b>ระยะทาง / Distance:</b> {distanceText}
          </div>
        </div>
      )}

      {/* CONFIRM BUILDING */}
      {pendingBuilding && (
        <div
          style={{
            position: "fixed",
            bottom: "0px",
            width: "100%",
            padding: "20px 0",
            background: "#ffffffee",
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            zIndex: 99999,
          }}
        >
          {/* Confirm */}
          <button
            onClick={async () => {
              await fetch("/api/search/backend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: pendingBuilding.name }),
              });

              setIsNavigating(true);
              setPendingBuilding(null);
            }}
            style={{
              background: "#00c853",
              padding: "20px 40px",
              fontSize: "26px",
              fontWeight: 700,
              color: "white",
              borderRadius: "14px",
              border: "none",
            }}
          >
            ✔ เริ่มนำทาง
          </button>

          {/* Cancel */}
          <button
            onClick={() => {
              (window as any).cancelRoute();
              setPendingBuilding(null);
            }}
            style={{
              background: "#ff4444",
              padding: "20px 40px",
              fontSize: "26px",
              fontWeight: 700,
              color: "white",
              borderRadius: "14px",
              border: "none",
            }}
          >
            ✖ ยกเลิก
          </button>
        </div>
      )}

      {/* MAIN CANCEL DURING NAVIGATION */}
      {isNavigating && !pendingBuilding && (
        <button
          onClick={() => (window as any).cancelRoute()}
          style={{
            position: "fixed",
            bottom: "0px",
            width: "100%",
            height: "110px",
            background: "#d32f2f",
            color: "white",
            fontSize: "30px",
            fontWeight: 900,
            border: "none",
            zIndex: 99999,
          }}
        >
          ⛔ CANCEL NAVIGATION
        </button>
      )}
    </>
  );
}
