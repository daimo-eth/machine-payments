import { useRef, useEffect } from "react";
import { CONTINENTS } from "./worlddata";

function latLngToXYZ(lat: number, lng: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}

function rotateY(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c];
}

function rotateX(x: number, y: number, z: number, a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

function transform(lat: number, lng: number, R: number, rY: number, rX: number): [number, number, number] {
  let [x, y, z] = latLngToXYZ(lat, lng, R);
  [x, y, z] = rotateY(x, y, z, rY);
  [x, y, z] = rotateX(x, y, z, rX);
  return [x, y, z];
}

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let running = true;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      if (!running) return;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const cx = w / 2, cy = h / 2;
      const R = Math.min(w, h) * 0.40;
      const rY = rotRef.current, rX = -0.35;

      ctx.clearRect(0, 0, w, h);

      // Globe fill + outline
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "#0e0e0e";
      ctx.fill();
      ctx.strokeStyle = "#1c1c1c";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Continents
      for (const poly of CONTINENTS) {
        ctx.beginPath();
        let drawing = false;
        for (let i = 0; i < poly.length; i++) {
          const [x, y, z] = transform(poly[i][0], poly[i][1], R, rY, rX);
          if (z < 0) { drawing = false; continue; }
          const px = cx + x, py = cy - y;
          if (!drawing) { ctx.moveTo(px, py); drawing = true; }
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "#2a2a2a";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fill();
      }

      rotRef.current += 0.0015;
      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(frameRef.current); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
    </div>
  );
}
