import styles from "./hud.module.css";

export type RouteCardProps = {
  destination: string;
  eta: string;
  distance: string;
  isNavigating: boolean;
  onStart: () => void;
  onCancel: () => void;
  

  onCancelPreview: () => void; 
};

export default function RouteCard({
  destination,
  eta,
  distance,
  isNavigating,
  onStart,
  onCancel,
  onCancelPreview,   // ⭐ เพิ่มตรงนี้
}: RouteCardProps) 
 {
  return (
    <div className={styles.routeCard}>
      {/* 🏁 ชื่อจุดหมาย */}
      <div className={styles.routeTitle}>{destination}</div>

      {/* ⏱ เวลา */}
      <div className={styles.routeRow}>
        <span className={styles.label}>เวลาเดินทาง</span>
        <span className={styles.value}>{eta}</span>
      </div>

      {/* 📏 ระยะทาง */}
      <div className={styles.routeRow}>
        <span className={styles.label}>ระยะทาง</span>
        <span className={styles.value}>{distance}</span>
      </div>

      {/* =========================
         ▶️ ACTION ZONE (สำคัญ)
         ========================= */}
         <div className={styles.routeActions}>
          {!isNavigating ? (
            <>
              <button
                className={`${styles.btn} ${styles.start}`}
                onClick={onStart}
              >
                ▶️ เริ่มนำทาง
              </button>       

              <button
                className={`${styles.btn} ${styles.secondaryCancel}`}
                onClick={onCancelPreview}   // ⭐ ใช้ตัวใหม่
              >
                ✖️ ยกเลิก
              </button>
            </>
          ) : (
            <button
              className={`${styles.btn} ${styles.cancel}`}
              onClick={onCancel}
            >
              ❌ ยกเลิกเส้นทาง
            </button>
          )}
        </div>


    </div>
  );
}


