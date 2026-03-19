import { useRef, useEffect, useCallback } from "react";
import { CONTINENTS } from "./worlddata";

const CITIES: [number, number, string][] = [
  [40.71, -74.01, "New York"], [37.77, -122.42, "San Francisco"],
  [51.51, -0.13, "London"], [48.86, 2.35, "Paris"],
  [35.68, 139.69, "Tokyo"], [1.35, 103.82, "Singapore"],
  [-33.87, 151.21, "Sydney"], [55.76, 37.62, "Moscow"],
  [-23.55, -46.63, "Sao Paulo"], [19.43, -99.13, "Mexico City"],
  [28.61, 77.21, "Delhi"], [31.23, 121.47, "Shanghai"],
  [37.57, 126.98, "Seoul"], [52.52, 13.41, "Berlin"],
  [25.20, 55.27, "Dubai"], [22.32, 114.17, "Hong Kong"],
  [-1.29, 36.82, "Nairobi"], [6.52, 3.38, "Lagos"],
  [43.65, -79.38, "Toronto"], [34.05, -118.24, "Los Angeles"],
];

type Arc = { from: [number, number]; to: [number, number]; birth: number; duration: number };

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

function slerp(lat1: number, lng1: number, lat2: number, lng2: number, t: number, alt: number): [number, number, number] {
  const p1 = latLngToXYZ(lat1, lng1, 1), p2 = latLngToXYZ(lat2, lng2, 1);
  const dot = p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2];
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  let x: number, y: number, z: number;
  if (omega < 0.001) {
    x = p1[0] * (1 - t) + p2[0] * t; y = p1[1] * (1 - t) + p2[1] * t; z = p1[2] * (1 - t) + p2[2] * t;
  } else {
    const sinO = Math.sin(omega), a = Math.sin((1 - t) * omega) / sinO, b = Math.sin(t * omega) / sinO;
    x = a * p1[0] + b * p2[0]; y = a * p1[1] + b * p2[1]; z = a * p1[2] + b * p2[2];
  }
  const len = Math.sqrt(x * x + y * y + z * z);
  const lift = 1 + alt * Math.sin(t * Math.PI);
  return [(x / len) * lift, (y / len) * lift, (z / len) * lift];
}

export function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arcsRef = useRef<Arc[]>([]);
  const rotRef = useRef(0);
  const frameRef = useRef(0);

  const spawnArc = useCallback(() => {
    const from = CITIES[Math.floor(Math.random() * CITIES.length)];
    let to = from;
    while (to === from) to = CITIES[Math.floor(Math.random() * CITIES.length)];
    arcsRef.current.push({ from: [from[0], from[1]], to: [to[0], to[1]], birth: Date.now(), duration: 1800 + Math.random() * 1200 });
    if (arcsRef.current.length > 20) arcsRef.current.shift();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let running = true;

    const spawner = setInterval(() => { spawnArc(); if (Math.random() < 0.4) spawnArc(); }, 600);
    for (let i = 0; i < 5; i++) spawnArc();

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
      const now = Date.now();
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
        // Subtle fill
        ctx.fillStyle = "rgba(255,255,255,0.02)";
        ctx.fill();
      }

      // City dots
      for (const [lat, lng] of CITIES) {
        const [x, y, z] = transform(lat, lng, R, rY, rX);
        if (z < 0) continue;
        ctx.beginPath();
        ctx.arc(cx + x, cy - y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "#555";
        ctx.fill();
      }

      // Arcs
      const alive: Arc[] = [];
      for (const arc of arcsRef.current) {
        const elapsed = now - arc.birth;
        if (elapsed > arc.duration + 600) continue;
        alive.push(arc);

        const progress = Math.min(elapsed / arc.duration, 1);
        const fade = elapsed > arc.duration ? 1 - (elapsed - arc.duration) / 600 : 1;
        const steps = 40;
        const headT = progress, tailT = Math.max(0, progress - 0.35);

        // Trail
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= steps; i++) {
          const t = tailT + (headT - tailT) * (i / steps);
          const [sx, sy, sz] = slerp(arc.from[0], arc.from[1], arc.to[0], arc.to[1], t, 0.15);
          let [x, y, z] = [sx * R, sy * R, sz * R];
          [x, y, z] = rotateY(x, y, z, rY);
          [x, y, z] = rotateX(x, y, z, rX);
          if (z < 0) { started = false; continue; }
          if (!started) { ctx.moveTo(cx + x, cy - y); started = true; }
          else ctx.lineTo(cx + x, cy - y);
        }
        ctx.strokeStyle = `rgba(200,200,200,${fade * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Head
        const [hx, hy, hz] = slerp(arc.from[0], arc.from[1], arc.to[0], arc.to[1], headT, 0.15);
        let [rx2, ry2, rz2] = [hx * R, hy * R, hz * R];
        [rx2, ry2, rz2] = rotateY(rx2, ry2, rz2, rY);
        [rx2, ry2, rz2] = rotateX(rx2, ry2, rz2, rX);
        if (rz2 >= 0 && progress < 1) {
          const px = cx + rx2, py = cy - ry2;
          ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${fade * 0.9})`; ctx.fill();
          ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${fade * 0.12})`; ctx.fill();
        }

        // Arrival flash
        if (progress >= 1 && fade > 0.3) {
          const [dx, dy, dz] = transform(arc.to[0], arc.to[1], R, rY, rX);
          if (dz >= 0) {
            ctx.beginPath(); ctx.arc(cx + dx, cy - dy, 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${fade * 0.3})`; ctx.fill();
          }
        }
      }
      arcsRef.current = alive;

      rotRef.current += 0.0015;
      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(frameRef.current); clearInterval(spawner); window.removeEventListener("resize", resize); };
  }, [spawnArc]);

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      <div className="globe-label">Live Transaction Routing</div>
    </div>
  );
}
