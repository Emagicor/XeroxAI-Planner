import { useEffect, useRef } from "react";

const VANTA_CONFIG = {
  mouseControls: true,
  touchControls: true,
  gyroControls: false,
  minHeight: 200.0,
  minWidth: 200.0,

  // Globe styling
  color: 0xffffff, // White globe
  color2: 0xffffff,
  backgroundColor: 0x000000, // Black background

  size: 1.2,
  spacing: 18.0,
};

const SCRIPTS = [
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js",
  "https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.globe.min.js",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = reject;

    document.head.appendChild(script);
  });
}

async function loadVantaLibs() {
  if (window.VANTA?.GLOBE) return;

  for (const src of SCRIPTS) {
    await loadScript(src);
  }
}

export default function VantaBackground() {
  const containerRef = useRef(null);
  const effectRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await loadVantaLibs();

        if (cancelled || !containerRef.current || !window.VANTA?.GLOBE) {
          return;
        }

        effectRef.current = window.VANTA.GLOBE({
          el: containerRef.current,
          ...VANTA_CONFIG,
        });
      } catch (err) {
        console.error("Vanta background failed to load:", err);
      }
    };

    init();

    return () => {
      cancelled = true;

      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id="vanta-background"
      ref={containerRef}
      className="fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
