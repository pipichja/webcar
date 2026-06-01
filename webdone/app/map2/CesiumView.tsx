"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

// ⭐ บอก Cesium ว่า assets อยู่ที่ไหน
(Cesium as any).buildModuleUrl.setBaseUrl("/cesium/");

const MODEL_HEADING_OFFSET = Cesium.Math.toRadians(-90);

// ================================
// 🧭 Compute heading from GNSS
// ================================
function computeHeading(
  prev: { lat: number; lon: number },
  curr: { lat: number; lon: number }
): number {
  const lat1 = Cesium.Math.toRadians(prev.lat);
  const lon1 = Cesium.Math.toRadians(prev.lon);
  const lat2 = Cesium.Math.toRadians(curr.lat);
  const lon2 = Cesium.Math.toRadians(curr.lon);

  const dLon = lon2 - lon1;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return Math.atan2(y, x);
}



// ================================
// 🧩 Types
// ================================
export type Target3D = {
  lat: number;
  lon: number;
  name?: string;
};

type CesiumViewProps = {
  target?: Target3D | null; // (ยังไม่ใช้คุมตำแหน่ง)
  route?: GeoJSON.LineString | null;
  onBuildingClick?: (name: string, lat: number, lon: number) => void;
  onLocationUpdate?: (lat: number, lon: number) => void;
  isNavigating?: boolean;
  followCamera?: boolean;

  onUserCameraInteract?: () => void;

  currentLocation?: {
    lat: number;
    lon: number;
  } | null;
};



// ================================
// 🏢 Buildings
// ================================
const buildings = [
  {
    name: "CB3",
    model: "/models/cb3.glb",
    lat: 13.649862,
    lon: 100.4919508,
    height: 2,
    scale: 1.1,
    headingDeg: 90,
    offset: {
    east: -20,
    north: 3,
    up: -3,
  },
  },
  {
    name: "CB4",
    model: "/models/cb4.glb",
    lat: 13.6496023,
    lon: 100.4926927,
    height: 2,
    scale: 1.5,
    headingDeg: 90,
    offset: {
    east: -20, //หน้าหลัง
    north: -10, //ซ้ายขวา
    up: -3,
  },
  },
  {
    name: "CB5",
    model: "/models/cb5.glb",
    lat: 13.6497222,
    lon: 100.4933965,
    height: 2,
    scale: 1.2,
    headingDeg: 90,
    offset: {
    east: -15,
    north: -8,
    up: -3,
  },
  },
    {
    name: "Green Society",
    model: "/models/S10.glb",
    lat: 13.6495746,
    lon: 100.493663,
    height: 2,
    scale: 8,
    headingDeg: 0,
    offset: {
    east: 4,
    north: 0,
    up: -3,
  },
  },
      {
    name: "ภาควิชาวิศวกรรมเคมี",
    model: "/models/S15.glb",
    lat: 13.6503034,
    lon: 100.4933302,
    height: 2,
    scale: 5,
    headingDeg: 0,
    offset: {
    east: 4,
    north: 0,
    up: -5,
  },
  },
      {
    name: "อาคารเรียนรวม 1",
    model: "/models/cb1.glb",
    lat: 13.6515239 ,
    lon: 100.4933439,
    height: 2,
    scale: 3,
    headingDeg: -90,
    offset: {
    east: 2,
    north: 0,
    up: -3,
  },
  },
   {
    name: "อาคารเรียนรวม 2",
    model: "/models/cb2.glb",
    lat: 13.651468 ,
    lon: 100.4939285,
    height: 2,
    scale: 3.5,
    headingDeg: 0,
    offset: {
    east: 4,
    north: 0,
    up: -3,
  },
  },
  {
    name: "KMUTT Canteen",
    model: "/models/kfc.glb",
    lat: 13.6508508 ,
    lon: 100.4917502,
    height: 2,
    scale: 2.75,
    headingDeg: 180,
    offset: {
    east: 4,
    north: 0,
    up: -3,
  },
  },
    {
    name: "N15",
    model: "/models/N15.glb",
    lat: 13.6519136 ,
    lon: 100.4933283,
    height: 2,
    scale: 1.25,
    headingDeg: 90,
    offset: {
    east: -10,
    north: 8,
    up: -3,
  },
  },
   {
    name: "LX",
    model: "/models/N16.glb",
    lat: 13.6519226 ,
    lon: 100.4940636,
    height: 2,
    scale: 2.25,
    headingDeg: 90,
    offset: {
    east: 4,
    north: -10,
    up: -3,
  },
  },
   {
    name: "School of Information Technology",
    model: "/models/N11.glb",
    lat: 13.6526045 ,
    lon: 100.4936294,
    height: 2,
    scale: 2.25,
    headingDeg: 90,
    offset: {
    east: 5,
    north: -5,
    up: -3,
  },
  },
   {
    name: "สำนักหอสมุด",
    model: "/models/N10.glb",
    lat: 13.652781 ,
    lon: 100.4938906,
    height: 2,
    scale: 5,
    headingDeg: -90,
    offset: {
    east: -25,
    north: 0,
    up: -3,
  },
  },
   {
    name: "ภาควิชาคณิตศาสตร์",
    model: "/models/N4.glb",
    lat: 13.6526153 ,
    lon: 100.4945135,
    height: 2,
    scale: 2.25,
    headingDeg: 90,
    offset: {
    east: 4,
    north: -10,
    up: -3,
  },
  },
   {
    name: "ภาควิชาเคมี",
    model: "/models/N3.glb",
    lat: 13.6524913 ,
    lon: 100.4949386,
    height: 2,
    scale: 2.25,
    headingDeg: 90,
    offset: {
    east: 4,
    north: -10,
    up: -3,
  },
  },
   {
    name: "N2",
    model: "/models/N2.glb",
    lat: 13.6518526 ,
    lon: 100.4950024 ,
    height: 2,
    scale: 2.25,
    headingDeg: 180,
    offset: {
    east: 8,
    north: -3,
    up: -3,
  },
  },
   {
    name: "Parking Building",
    model: "/models/S2.glb",
    lat: 13.6503826 ,
    lon: 100.495632 ,
    height: 2,
    scale: 1.5,
    headingDeg: 45,
    offset: {
    east: 4,
    north: -10,
    up: -3,
  },
  },
  {
    name: "Witsawa Wattana",
    model: "/models/S4.glb",
    lat: 13.6500027 ,
    lon: 100.4942146 ,
    height: 2,
    scale: 0.9,
    headingDeg: 180,
    offset: {
    east: 3,
    north: -5,
    up: -3,
  },
  },
  

];

// ================================
// 🌍 Component
// ================================
export default function CesiumView({
  route,
  onBuildingClick,
  onLocationUpdate,
  isNavigating,
  currentLocation,
  followCamera = true,
  onUserCameraInteract,
}: CesiumViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  // 🔴 user marker (สร้างครั้งเดียว)
  // const userMarkerRef = useRef<Cesium.Entity | null>(null);

  // 🛣️ route polyline
  const routeEntityRef = useRef<Cesium.Entity | null>(null);

   const isNavigatingRef = useRef(false);
   // 🔄 sync prop → ref ทุกครั้งที่เปลี่ยน

   const cameraReadyRef = useRef(false);

  // 🚗 golf cart model
  const vehicleRef = useRef<Cesium.Entity | null>(null);

  const prevLocationRef = useRef<{
    lat: number;
    lon: number;
  } | null>(null);

  const prevCartesianRef = useRef<Cesium.Cartesian3 | null>(null);
  const lastHeadingRef = useRef<number | null>(null);


  const hasRosGnssRef = useRef(false);

  useEffect(() => {
    if (currentLocation && currentLocation.lat !== 0 && currentLocation.lon !== 0) {
      hasRosGnssRef.current = true;
    }
  }, [currentLocation]);


  useEffect(() => {
    isNavigatingRef.current = !!isNavigating;
  }, [isNavigating]);
  
  const followCameraRef = useRef(followCamera);
  
  // sync followCamera prop → ref
  useEffect(() => {
    followCameraRef.current = followCamera;
  }, [followCamera]);
  
    const onUserCameraInteractRef = useRef<(() => void) | undefined>(undefined);
  
  useEffect(() => {
    onUserCameraInteractRef.current = onUserCameraInteract;
  }, [onUserCameraInteract]);




  // ================================
  // 🧠 DEBUG helper
  // ================================
  function debug(step: string, data?: any) {
    if (data !== undefined) {
      console.log(`[CesiumView][${step}]`, data);
    } else {
      console.log(`[CesiumView][${step}]`);
    }
  }

  // ================================
  // INIT VIEWER (ONCE)
  // ================================
  useEffect(() => {
    if (!containerRef.current) return;

    debug("INIT_VIEWER_START");

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      creditContainer: document.createElement("div"),
    });

    viewerRef.current = viewer;

    // 🗺️ OSM Imagery
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://a.tile.openstreetmap.org/",
      })
    );

    // 🎛️ Visual tuning
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.skyBox.show = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.shadowMap.enabled = false;
    viewer.scene.postProcessStages.fxaa.enabled = true;

    // 🎥 Initial camera (KMUTT)
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        100.4926927,
        13.6496023,
        180
      ),
      orientation: { pitch: Cesium.Math.toRadians(-45) },
    });

    

    // ================================
    // 🔴 CREATE USER MARKER (ONCE)
    // ================================
    // userMarkerRef.current = viewer.entities.add({
    //   position: new Cesium.ConstantPositionProperty(
    //     Cesium.Cartesian3.fromDegrees(100.4926927, 13.6496023, 2)
    //   ),
    //   point: {
    //     pixelSize: 14,
    //     color: Cesium.Color.RED,
    //   },
    //   label: {
    //     text: "ME",
    //     pixelOffset: new Cesium.Cartesian2(0, -24),
    //     fillColor: Cesium.Color.WHITE,
    //     outlineColor: Cesium.Color.BLACK,
    //     outlineWidth: 3,
    //     style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    //   },
    // });
    // 🚗 CREATE VEHICLE MODEL (ONCE)
      vehicleRef.current = viewer.entities.add({
        position: new Cesium.ConstantPositionProperty(
          Cesium.Cartesian3.fromDegrees(
            100.4926927,
            13.6496023,
            0
          )
        ),
        model: {
          uri: "/models/golf_cart.glb",
          scale: 1.0,
          minimumPixelSize: 64,
          maximumScale: 10,
        },

         viewFrom: new Cesium.Cartesian3(
          -50,  // ระยะถอยหลัง (เมตร)
           0,   // ซ้าย / ขวา
           80  // ความสูง (เมตร)
        ), 

      });



    debug("USER_MARKER_CREATED");

    // ================================
    // LOAD BUILDINGS (GLB)
    // ================================
    buildings.forEach((b) => {
      const pos = Cesium.Cartesian3.fromDegrees(b.lon, b.lat, b.height);    

      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(b.headingDeg),
        0,
        0
      );    

      // 🔴 ต้องเป็น let (ไม่ใช่ const)
      let modelMatrix =
        Cesium.Transforms.headingPitchRollToFixedFrame(pos, hpr);   

      // ✅ APPLY OFFSET (หน่วย = เมตร, local ENU)
      if (b.offset) {
        const offsetVec = Cesium.Cartesian3.fromElements(
          b.offset.east,
          b.offset.north,
          b.offset.up ?? 0
        );    

        const offsetMatrix = Cesium.Matrix4.fromTranslation(offsetVec);   

        modelMatrix = Cesium.Matrix4.multiply(
          modelMatrix,
          offsetMatrix,
          new Cesium.Matrix4()
        );
      }   

      Cesium.Model.fromGltfAsync({
        url: b.model,
        modelMatrix,
        scale: b.scale,
      }).then((model) => {
        model.id = {
          name: b.name,
          lat: b.lat,
          lon: b.lon,
        };
        viewer.scene.primitives.add(model);
      });
    });


    // ================================
    // BUILDING CLICK (SAFE)
    // ================================
    const handler = new Cesium.ScreenSpaceEventHandler(
      viewer.scene.canvas
    );

    handler.setInputAction((movement) => {
      try {

        if (isNavigatingRef.current) {
        console.log("[CesiumView] click ignored (navigating)");
        return;
        }

        const picked = viewer.scene.pick(movement.position);
        if (!picked || !picked.primitive || !picked.primitive.id) return;

        debug("BUILDING_CLICKED", picked.primitive.id);

        onBuildingClick?.(
          picked.primitive.id.name,
          picked.primitive.id.lat,
          picked.primitive.id.lon
        );
      } catch (e) {
        console.error("[CesiumView][CLICK_ERROR]", e);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // ================================
    // 🔍 ZOOM DISTANCE CHECK
    // ================================
    viewer.camera.changed.addEventListener(() => {
    
      if (!cameraReadyRef.current) return;
    
      const v = viewerRef.current;
      const vehicle = vehicleRef.current;
    
      if (!v || !vehicle) return;
      if (!followCameraRef.current) return;
    
      const posProp =
        vehicle.position as Cesium.ConstantPositionProperty;
    
      const target = posProp.getValue(Cesium.JulianDate.now());
      if (!target) return;
    
      const dist = Cesium.Cartesian3.distance(
        v.camera.position,
        target
      );
    
      if (dist > 50) {
        console.log("📍 auto-follow OFF (zoom out)");
        onUserCameraInteractRef.current?.();
      }
    });

      // ================================
      // 🖐️ USER CAMERA INTERACT → UNFOLLOW
      // ================================
      let isDragging = false;

      const notifyUnfollow = () => {
        if (followCameraRef.current) {
          console.log("[CesiumView] user camera interact → unfollow");
          onUserCameraInteractRef.current?.();
        }
      };

      



    return () => {
      debug("DESTROY_VIEWER");
      handler.destroy();
      viewer.destroy();
    };
  }, []);


  setTimeout(() => {
  cameraReadyRef.current = true;
}, 2000);

  // ================================
  // 🛰️ GNSS FROM ROS (PRIMARY SOURCE)
  // ================================
    useEffect(() => {
      const viewer = viewerRef.current;
      const vehicle = vehicleRef.current;
      if (!viewer || !vehicle || !currentLocation) return;
    
      const { lat, lon } = currentLocation;
    
      const currCartesian = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    
      // ✅ อัปเดตตำแหน่ง (ไม่ต้องสร้าง ConstantPositionProperty ใหม่ทุกครั้ง)
      if (!vehicle.position) {
        vehicle.position = new Cesium.ConstantPositionProperty(currCartesian);
      } else {
        (vehicle.position as Cesium.ConstantPositionProperty).setValue(currCartesian);
      }
    
      // ✅ คำนวณระยะที่ขยับจริง (เมตร)
      let moved = Infinity;
      if (prevCartesianRef.current) {
        moved = Cesium.Cartesian3.distance(prevCartesianRef.current, currCartesian);
      }
    
      // ✅ อัปเดต heading เฉพาะตอนขยับเกิน 0.5m (ปรับได้)
      if (prevLocationRef.current && moved > 0.5) {
        const rawHeading = computeHeading(prevLocationRef.current, currentLocation);
        const heading = rawHeading + MODEL_HEADING_OFFSET;
      
        lastHeadingRef.current = heading;
      
        const hpr = new Cesium.HeadingPitchRoll(heading, 0, 0);
        const q = Cesium.Transforms.headingPitchRollQuaternion(currCartesian, hpr);
      
        if (!vehicle.orientation) {
          vehicle.orientation = new Cesium.ConstantProperty(q);
        } else {
          (vehicle.orientation as Cesium.ConstantProperty).setValue(q);
        }
      } else if (lastHeadingRef.current != null) {
        // ✅ ตอนรถหยุด: ล็อก heading เดิมไว้ (กันกระตุก)
        const hpr = new Cesium.HeadingPitchRoll(lastHeadingRef.current, 0, 0);
        const q = Cesium.Transforms.headingPitchRollQuaternion(currCartesian, hpr);
      
        if (!vehicle.orientation) {
          vehicle.orientation = new Cesium.ConstantProperty(q);
        } else {
          (vehicle.orientation as Cesium.ConstantProperty).setValue(q);
        }
      }
    
      prevLocationRef.current = currentLocation;
      prevCartesianRef.current = currCartesian;
    }, [currentLocation]); // 👈 ตัด followCamera ออก (เราจะไปจัดการแยก)

    
    
    
    useEffect(() => {
      const viewer = viewerRef.current;
      const vehicle = vehicleRef.current;
      if (!viewer || !vehicle) return;
    
      if (followCamera) {
        // 🔥 RESET กล้องก่อน (สำคัญมาก)
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      
        // 🔥 แล้วค่อย track ใหม่
        viewer.trackedEntity = vehicle;
      } else if (viewer.trackedEntity === vehicle) {
        viewer.trackedEntity = undefined;
      }
    }, [followCamera]);





    // ================================
    // 📍 HTML5 GEOLOCATION (FALLBACK)
    // ================================
    useEffect(() => {
      if (typeof window === "undefined") return;
      if (!("geolocation" in navigator)) return;
    
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          // ❌ ถ้ามี ROS GNSS แล้ว ไม่ให้ HTML5 ทับ
          if (hasRosGnssRef.current) return;

        
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
        
          if (vehicleRef.current) {
          const posProp =
            vehicleRef.current.position as Cesium.ConstantPositionProperty;       

          posProp.setValue(
            Cesium.Cartesian3.fromDegrees(lon, lat, 0)
          );
        }

        
          onLocationUpdate?.(lat, lon);
        },
        () => {},
        { enableHighAccuracy: true }
      );
    
      return () => navigator.geolocation.clearWatch(watchId);
    }, [onLocationUpdate]);

  // ================================
  // 🛣️ DRAW ROUTE (GeoJSON LineString)
  // ================================
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;   

    // ลบเส้นเก่าก่อน
    if (routeEntityRef.current) {
      viewer.entities.remove(routeEntityRef.current);
      routeEntityRef.current = null;
    }  

    // ถ้ายังไม่มี route ไม่ต้องวาด
    if (!route) return;  

    console.log(
      "[CesiumView] draw route, points:",
      route.coordinates.length
    );   

    const positions = route.coordinates.map(
      ([lon, lat]) =>
        Cesium.Cartesian3.fromDegrees(lon, lat, 1)
    );   

    routeEntityRef.current = viewer.entities.add({
      polyline: {
        positions,
        width: 6,
        material: Cesium.Color.CYAN.withAlpha(0.9),
        clampToGround: true,
      },
    });
  }, [route]);


  // ================================
  // RENDER
  // ================================
return (
  <div
    ref={containerRef}
    style={{
      position: "fixed",
      inset: 0,
      background: "black",
      zIndex: 0,

      // ❌ เอาออก
      // borderRadius: "50%",
      // overflow: "hidden",
    }}
  />
);



}
