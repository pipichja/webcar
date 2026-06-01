import confetti from "canvas-confetti";

export function launchFireworks() {

  const duration = 1500;
  const end = Date.now() + duration;

  const colors = ["#ff3d3d", "#ffd700", "#00e5ff", "#7cff00"];

  (function frame() {

    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors
    });

    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }

  })();
}