import { useEffect, useState } from "react";

export function useAutoFit(designRadius = 400) {
  const [scale, setScale] = useState(1);
  const [radius, setRadius] = useState(designRadius);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const r = Math.min(w, h) / 2;

      setRadius(r);
      setScale(r / designRadius);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [designRadius]);

  return { scale, radius };
}
