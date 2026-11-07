import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { api } from "../lib/api";
import { useFetch } from "../lib/hooks";
import type { MuseumBay, MuseumItem } from "../lib/types";

/* A walkable gallery. One bay per inductee along a long hall: a salon wall of framed pictures around the portrait
   (archive media and dated timeline scenes), a nameplate and a glass display case in front holding
   a featured object. The hall is dressed like a real museum: wainscoting, crown moulding, pilasters, picture lights,
   a coffered ceiling with skylights and a red carpet runner, with a welcome lobby.

   Navigation: click the floor to walk there, click a picture from afar to glide up to it, drag to look around,
   two-finger scroll to walk and turn, pinch (ctrl+wheel) to zoom, arrow keys / WASD, or jump to any inductee
   from the portrait strip. */

type Viewable = { kind: "portrait" | "item" | "scene" | "case"; bay: MuseumBay; item?: MuseumItem };
type Stand = { x: number; z: number; yaw: number };
type Goal = Stand & { then?: Viewable; keepYaw?: boolean };

const BAY_SPACING = 7.8, HALL_W = 11.5, HALL_H = 4.7, WALL_X = HALL_W / 2;
const EYE = 1.62, FOV = 62;
// Slots on the wall around the portrait: [z offset, y centre, max width, max height]
const SLOTS: [number, number, number, number][] = [
  [-1.95, 2.6, 1.2, 0.9], [-1.95, 1.5, 1.2, 0.9], [1.95, 2.6, 1.2, 0.9], [1.95, 1.5, 1.2, 0.9], [-3.15, 2.05, 0.9, 1.1], [3.15, 2.05, 0.9, 1.1],
];

type Line = { text: string; size: number; weight?: string; color?: string; font?: string; gap?: number };
function textTexture(lines: Line[], w = 1024, h = 256, bg = "#fbf8f1", accent?: string, accentSide: "left" | "top" | "none" = "left") {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (accent && accentSide === "left") { g.fillStyle = accent; g.fillRect(0, 0, 14, h); }
  if (accent && accentSide === "top") { g.fillStyle = accent; g.fillRect(0, 0, w, 18); }
  const total = lines.reduce((a, l) => a + l.size * 1.35 + (l.gap ?? 0), 0); let y = (h - total) / 2;
  for (const l of lines) {
    y += l.size * 1.1 + (l.gap ?? 0);
    g.font = `${l.weight ?? "600"} ${l.size}px ${l.font ?? "Montserrat, sans-serif"}`;
    g.fillStyle = l.color ?? "#16213a"; g.textAlign = "center"; g.textBaseline = "alphabetic";
    g.fillText(l.text, w / 2 + (accentSide === "left" && accent ? 8 : 0), y, w - 80);
    y += l.size * 0.25;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function plankTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d")!;
  g.fillStyle = "#a9835a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = `hsl(${28 + (i % 3) * 3}, ${34 + (i % 2) * 6}%, ${34 + ((i * 7) % 5) * 3}%)`;
    g.fillRect(0, i * 64, 512, 62);
    g.fillStyle = "rgba(255,255,255,0.05)"; for (let s = 0; s < 6; s++) g.fillRect(0, i * 64 + 6 + s * 9, 512, 1);
    g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(0, i * 64 + 62, 512, 2); g.fillRect(((i * 131) % 400), i * 64, 2, 62);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 28); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function carpetTexture(len: number) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512; const g = c.getContext("2d")!;
  g.fillStyle = "#8c1a20"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#d9b64a"; g.lineWidth = 7; g.strokeRect(20, -10, 472, 532); g.lineWidth = 2; g.strokeRect(38, -10, 436, 532);
  const t = new THREE.CanvasTexture(c); t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, len / 3); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function wainscotTexture(len: number) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#e4d9c2"; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 5; g.strokeRect(40, 36, 432, 184);
  g.strokeStyle = "rgba(80,60,30,0.28)"; g.lineWidth = 5; g.strokeRect(46, 42, 420, 172);
  g.fillStyle = "#ebe2cf"; g.fillRect(52, 48, 408, 160);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(len / 1.6, 1); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function loadImage(url: string, fallback: () => THREE.Texture, onDone: (t: THREE.Texture, ratio: number) => void) {
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  loader.load(api.imageProxy(url), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; onDone(t, t.image.width / t.image.height); }, undefined, () => onDone(fallback(), 3 / 4));
}

// A larger copy of a thumbnail for the viewer, where the host supports a width parameter.
const large = (url: string) => url.replace(/([?&]width=)\d+/, "$11400");

function viewables(bay: MuseumBay): Viewable[] {
  const out: Viewable[] = [{ kind: "portrait", bay }];
  if (bay.featured) out.push({ kind: "case", bay, item: bay.featured });
  bay.items.forEach((item) => { if (item !== bay.featured) out.push({ kind: "item", bay, item }); });
  bay.scenes.forEach((item) => out.push({ kind: "scene", bay, item }));
  return out;
}

const bayZ = (n: number, zStart: number) => zStart + Math.floor(n / 2) * BAY_SPACING;
const baySide = (n: number): 1 | -1 => (n % 2 === 0 ? -1 : 1);
const standFor = (side: 1 | -1, z: number, back = 2.7): Stand => ({ x: side * (WALL_X - back), z, yaw: side === -1 ? Math.PI / 2 : -Math.PI / 2 });

export default function MuseumHall({ fullscreen = false }: { fullscreen?: boolean }) {
  const { data: bays, error } = useFetch(() => api.museum(), []);
  const mount = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Viewable | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<"pick" | "walk" | null>(null);
  const [edge, setEdge] = useState<0 | 1 | -1>(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(fullscreen);
  const [loaded, setLoaded] = useState(0);
  const moveRef = useRef({ fwd: 0, turn: 0 });
  const ctl = useRef<{ goTo: (g: Goal) => void; zoom: (d: number) => void; reset: () => void } | null>(null);

  useEffect(() => {
    const el = mount.current; if (!el || !bays?.length) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene(); scene.background = new THREE.Color("#0b1b33"); scene.fog = new THREE.Fog("#101a2c", 34, 60);
    const camera = new THREE.PerspectiveCamera(FOV, el.clientWidth / el.clientHeight, 0.1, 100);
    const perSide = Math.ceil(bays.length / 2);
    const hallLen = perSide * BAY_SPACING + 8;
    const zStart = -hallLen / 2 + 4.5;
    const endZ = hallLen / 2 + 2;                                    // the entrance wall (behind the visitor at the start)
    const state = { yaw: 0, pitch: 0, x: 0, z: hallLen / 2 - 2.0, vx: 0, vz: 0, dragging: false, lastX: 0, lastY: 0, moved: 0, goal: null as Goal | null, fov: FOV, fovTarget: FOV, edgeTurn: 0 };
    camera.position.set(state.x, EYE, state.z);
    const clampX = (x: number) => Math.max(-WALL_X + 2.3, Math.min(WALL_X - 2.3, x));
    const clampZ = (z: number) => Math.max(-hallLen / 2 - 0.4, Math.min(endZ - 1.4, z));
    let pending = 0, done = 0; const trackLoad = () => { done++; setLoaded(Math.round((done / Math.max(1, pending)) * 100)); };

    // --- materials
    const wallMat = new THREE.MeshStandardMaterial({ color: "#efe7d6", roughness: 0.95 });
    const trimMat = new THREE.MeshStandardMaterial({ color: "#f8f3e8", roughness: 0.7 });
    const darkWood = new THREE.MeshStandardMaterial({ color: "#3a2615", roughness: 0.55, metalness: 0.05 });
    const brass = new THREE.MeshStandardMaterial({ color: "#c9a24a", roughness: 0.3, metalness: 0.85 });
    const leather = new THREE.MeshStandardMaterial({ color: "#5a3826", roughness: 0.75 });
    const frameMat = new THREE.MeshStandardMaterial({ color: "#2a1f14", roughness: 0.5, metalness: 0.2 });
    const goldMat = new THREE.MeshStandardMaterial({ color: "#8a6a2a", roughness: 0.4, metalness: 0.5 });
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m;
    };

    // --- room shell
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, hallLen + 4), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.6, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(3.4, hallLen + 2), new THREE.MeshStandardMaterial({ map: carpetTexture(hallLen + 2), roughness: 1 }));
    runner.rotation.x = -Math.PI / 2; runner.position.y = 0.012; scene.add(runner);
    const mkWall = (w: number, h: number, pos: [number, number, number], rotY: number, mat = wallMat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...pos); m.rotation.y = rotY; scene.add(m); return m; };
    mkWall(hallLen + 4, HALL_H, [-WALL_X, HALL_H / 2, 0], Math.PI / 2);
    mkWall(hallLen + 4, HALL_H, [WALL_X, HALL_H / 2, 0], -Math.PI / 2);
    mkWall(HALL_W, HALL_H, [0, HALL_H / 2, -hallLen / 2 - 2], 0);
    mkWall(HALL_W, HALL_H, [0, HALL_H / 2, endZ], Math.PI);
    // wainscoting, dado rail, baseboard, crown moulding and a gold line below it, on both long walls
    const wainMat = new THREE.MeshStandardMaterial({ map: wainscotTexture(hallLen + 4), roughness: 0.8 });
    for (const sx of [-1, 1] as const) {
      const rot = sx === -1 ? Math.PI / 2 : -Math.PI / 2;
      mkWall(hallLen + 4, 1.1, [sx * (WALL_X - 0.015), 0.55, 0], rot, wainMat);
      box(0.08, 0.07, hallLen + 4, trimMat, sx * (WALL_X - 0.04), 1.12, 0);
      box(0.06, 0.22, hallLen + 4, darkWood, sx * (WALL_X - 0.03), 0.11, 0);
      box(0.16, 0.18, hallLen + 4, trimMat, sx * (WALL_X - 0.08), HALL_H - 0.09, 0);
      box(0.02, 0.05, hallLen + 4, brass, sx * (WALL_X - 0.01), HALL_H - 0.3, 0);
    }
    for (const ez of [-hallLen / 2 - 2, endZ]) { box(HALL_W, 0.18, 0.16, trimMat, 0, HALL_H - 0.09, ez + (ez > 0 ? -0.08 : 0.08)); box(HALL_W, 0.22, 0.06, darkWood, 0, 0.11, ez + (ez > 0 ? -0.03 : 0.03)); }
    // pilasters between bays, with capital and base
    for (let k = 0; k <= perSide; k++) {
      const z = zStart + (k - 0.5) * BAY_SPACING;
      for (const sx of [-1, 1] as const) {
        const g = new THREE.Group(); g.position.set(sx * (WALL_X - 0.12), 0, z); scene.add(g);
        box(0.24, HALL_H, 0.46, trimMat, 0, HALL_H / 2, 0, g);
        box(0.3, 0.2, 0.62, trimMat, 0, HALL_H - 0.28, 0, g);
        box(0.28, 0.28, 0.58, trimMat, 0, 0.14, 0, g);
        for (let f = -1; f <= 1; f++) box(0.03, HALL_H - 0.9, 0.05, wallMat, -sx * 0.125, HALL_H / 2 + 0.05, f * 0.13, g);
      }
    }
    // coffered ceiling: cream panels, beams and skylights
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(HALL_W, hallLen + 4), new THREE.MeshStandardMaterial({ color: "#ebe4d6", roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2; ceiling.position.y = HALL_H; scene.add(ceiling);
    const beamMat = new THREE.MeshStandardMaterial({ color: "#ddd3c0", roughness: 0.9 });
    for (const bx of [-2.4, 2.4]) box(0.2, 0.24, hallLen + 4, beamMat, bx, HALL_H - 0.12, 0);
    for (let k = 0; k <= perSide * 2 + 2; k++) { const z = zStart - BAY_SPACING / 2 + (k * BAY_SPACING) / 2; if (z < endZ) box(HALL_W, 0.24, 0.2, beamMat, 0, HALL_H - 0.12, z); }
    const skyMat = new THREE.MeshBasicMaterial({ color: "#fff6dc" });
    for (let k = 0; k < perSide + 1; k++) {
      const z = zStart + k * BAY_SPACING - (k === perSide ? BAY_SPACING / 2 - 0.5 : 0);
      const sky = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), skyMat); sky.rotation.x = Math.PI / 2; sky.position.set(0, HALL_H - 0.02, z); scene.add(sky);
      const pl = new THREE.PointLight("#fff1cc", 16, 16, 1.6); pl.position.set(0, HALL_H - 0.5, z); scene.add(pl);
    }
    scene.add(new THREE.AmbientLight("#ffffff", 0.45));
    scene.add(new THREE.HemisphereLight("#fff6e0", "#4a3620", 0.8));

    // --- title wall (far end) and entrance wall
    const farZ = -hallLen / 2 - 1.97;
    const title = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: textTexture([
      { text: "IMMIGRANT HALL OF HONOR", size: 92, weight: "800", color: "#0d5ab6" }, { text: "Hall of the Inductees", size: 56, weight: "500", color: "#c40d16", font: "Georgia, serif" },
    ], 2048, 512, "#fbf8f1") }));
    title.position.set(0, 2.95, farZ); scene.add(title);
    const logoTex = new THREE.TextureLoader().load("/ihh/ihh-mark.png", (t) => { t.colorSpace = THREE.SRGBColorSpace; });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })); logo.position.set(0, 1.55, farZ); scene.add(logo);
    const motto = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.5), new THREE.MeshBasicMaterial({ map: textTexture([{ text: "Document.  Preserve.  Honor.", size: 72, weight: "600", color: "#16213a", font: "Georgia, serif" }], 2048, 220, "#fbf8f1") })); motto.position.set(0, 0.72, farZ); scene.add(motto);
    const entrance = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.4), new THREE.MeshBasicMaterial({ map: textTexture([
      { text: "YOUR STORY BELONGS HERE", size: 54, weight: "800", color: "#ffd133" },
      { text: "Every inductee began as an arrival.", size: 64, weight: "500", color: "#ffffff", font: "Georgia, serif", gap: 12 },
      { text: "Share your family's immigration story with the museum", size: 40, weight: "500", color: "#cae2ff", gap: 18 },
      { text: "Visit  Share a Story  on this website", size: 36, weight: "700", color: "#ffd133", gap: 18 },
    ], 2048, 940, "#132d55") })); entrance.position.set(0, 2.5, endZ - 0.03); entrance.rotation.y = Math.PI; scene.add(entrance);
    const entLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true })); entLogo.position.set(-3.9, 2.6, endZ - 0.03); entLogo.rotation.y = Math.PI; scene.add(entLogo);
    // lobby: welcome and how-to panels on the side walls, bench and plants
    const lobbyZ = endZ - 3.6;
    const welcome = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.95), new THREE.MeshBasicMaterial({ map: textTexture([
      { text: "WELCOME", size: 44, weight: "800", color: "#c40d16" },
      { text: "The Immigrant Hall of Honor", size: 70, weight: "600", color: "#16213a", font: "Georgia, serif", gap: 8 },
      { text: "documents, preserves and honors the many ways", size: 38, weight: "500", color: "#4b5566", gap: 20 },
      { text: "immigrants have shaped the United States.", size: 38, weight: "500", color: "#4b5566" },
      { text: `${bays.length} inductees are on view in this hall.`, size: 38, weight: "700", color: "#0d5ab6", gap: 20 },
      { text: "Every fact on these walls is cited to its source.", size: 34, weight: "500", color: "#4b5566", gap: 8 },
    ], 1536, 1024, "#fffdf7", "#ed1b24", "top") })); welcome.position.set(-WALL_X + 0.03, 2.45, lobbyZ); welcome.rotation.y = Math.PI / 2; scene.add(welcome);
    const howto = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.95), new THREE.MeshBasicMaterial({ map: textTexture([
      { text: "HOW TO EXPLORE", size: 44, weight: "800", color: "#0d5ab6" },
      { text: "Click the floor to walk there.", size: 42, weight: "600", color: "#16213a", gap: 22 },
      { text: "Drag or scroll sideways to look around.", size: 42, weight: "600", color: "#16213a", gap: 10 },
      { text: "Pinch or scroll to zoom and move.", size: 42, weight: "600", color: "#16213a", gap: 10 },
      { text: "Click any picture or case to open it.", size: 42, weight: "600", color: "#16213a", gap: 10 },
      { text: "Jump to an inductee from the portraits below.", size: 36, weight: "500", color: "#4b5566", gap: 18 },
    ], 1536, 1024, "#fffdf7", "#0d5ab6", "top") })); howto.position.set(WALL_X - 0.03, 2.45, lobbyZ); howto.rotation.y = -Math.PI / 2; scene.add(howto);
    const bench = (z: number) => {
      box(1.5, 0.36, 0.46, darkWood, 0, 0.18, z); box(1.72, 0.14, 0.58, leather, 0, 0.45, z);
      for (const dx of [-0.7, 0.7]) box(0.3, 0.1, 0.5, leather, dx, 0.5, z);
    };
    bench(lobbyZ + 0.2);

    // --- bays
    const clickable: THREE.Object3D[] = [];
    const fallbackTex = (bay: MuseumBay, label: string) => () => textTexture([{ text: label, size: 110, weight: "700", color: "#fff" }], 768, 1024, bay.accent);
    const fitFrame = (art: THREE.Mesh, frame: THREE.Mesh, ratio: number, maxW: number, maxH: number, thick: number) => {
      let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
      art.geometry.dispose(); art.geometry = new THREE.PlaneGeometry(w, h);
      frame.geometry.dispose(); frame.geometry = new THREE.BoxGeometry(thick, h + 0.14, w + 0.14);
    };
    const addFrame = (x: number, y: number, z: number, side: 1 | -1, maxW: number, maxH: number, url: string, bay: MuseumBay, data: Viewable, thick = 0.08, gold = false) => {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(thick, maxH + 0.14, maxW + 0.14), gold ? goldMat : frameMat);
      const mat = new THREE.MeshStandardMaterial({ map: fallbackTex(bay, "…")(), roughness: 0.6, emissive: new THREE.Color("#000000") });
      const art = new THREE.Mesh(new THREE.PlaneGeometry(maxW, maxH), mat);
      art.rotation.y = side === 1 ? -Math.PI / 2 : Math.PI / 2; art.position.x = -side * (thick / 2 + 0.002);
      art.userData = { ...data, stand: standFor(side, z) }; clickable.push(art);
      group.add(frame, art); group.position.set(x, y, z); scene.add(group);
      pending++;
      loadImage(url, fallbackTex(bay, data.item?.kind.toUpperCase() ?? bay.name), (t, ratio) => { mat.map = t; mat.needsUpdate = true; fitFrame(art, frame, ratio, maxW, maxH, thick); trackLoad(); });
      return art;
    };
    const bayPositions: { z: number; side: 1 | -1 }[] = [];
    bays.forEach((bay, n) => {
      const side = baySide(n);
      const z = bayZ(n, zStart);
      bayPositions.push({ z, side });
      const x = side * (WALL_X - 0.06);
      const rotY = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      // portrait, gold frame, with a brass picture light and a spotlight on it
      addFrame(x, 2.0, z, side, 1.7, 2.1, bay.portrait, bay, { kind: "portrait", bay }, 0.1, true);
      const lightArm = new THREE.Group(); lightArm.position.set(side * (WALL_X - 0.2), 3.28, z); scene.add(lightArm);
      box(0.3, 0.03, 0.03, brass, -side * 0.05, 0.08, 0, lightArm); box(0.14, 0.09, 0.9, brass, -side * 0.18, 0, 0, lightArm);
      const spot = new THREE.SpotLight("#fff1d2", 28, 7, 0.62, 0.55, 1.4); spot.position.set(side * (WALL_X - 0.45), 3.3, z);
      spot.target.position.set(side * WALL_X, 1.9, z); scene.add(spot, spot.target);
      // nameplate
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshBasicMaterial({ map: textTexture([
        { text: bay.name, size: 72, weight: "700", color: "#16213a", font: "Georgia, serif" }, { text: `${bay.field} · ${bay.origin_country} → United States · ${bay.immigration_year}`, size: 34, weight: "500", color: "#4b5566" },
      ], 1024, 270, "#fffdf7", bay.accent) }));
      plate.position.set(side * (WALL_X - 0.05), 0.72, z); plate.rotation.y = rotY; plate.userData = { kind: "portrait", bay, stand: standFor(side, z) }; clickable.push(plate); scene.add(plate);
      // salon wall: archive media first, then timeline scenes, into the slots
      const wallPics: Viewable[] = [
        ...bay.items.filter((it) => it !== bay.featured).map((item) => ({ kind: "item" as const, bay, item })),
        ...bay.scenes.map((item) => ({ kind: "scene" as const, bay, item })),
      ].slice(0, SLOTS.length);
      wallPics.forEach((v, k) => { const [dz, y, mw, mh] = SLOTS[k]; addFrame(x, y, z + dz, side, mw, mh, v.item!.thumbnail, bay, v, 0.06); });
      // display case beside the portrait
      if (bay.featured) { const z0 = z; {   // the case stands to one side of the portrait, not in front of it
        const z = z0 + 2.55; const cx = side * (WALL_X - 1.7);
        box(0.8, 0.95, 0.8, darkWood, cx, 0.475, z);
        box(0.86, 0.03, 0.86, brass, cx, 0.965, z);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.85, 0.78), new THREE.MeshPhysicalMaterial({ color: "#dff1ff", transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, transmission: 0.6, thickness: 0.02 }));
        glass.position.set(cx, 1.415, z); scene.add(glass);
        for (const e of [[-0.39, -0.39], [0.39, -0.39], [-0.39, 0.39], [0.39, 0.39]]) box(0.02, 0.85, 0.02, brass, cx + e[0], 1.415, z + e[1]);
        const glow = new THREE.PointLight("#ffffff", 2.5, 2.5, 2); glow.position.set(cx, 1.7, z); scene.add(glow);
        const objMat = new THREE.MeshStandardMaterial({ map: fallbackTex(bay, "OBJECT")(), roughness: 0.5, emissive: new THREE.Color("#000000"), side: THREE.DoubleSide });
        const obj = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), objMat);
        obj.position.set(cx, 1.4, z); obj.rotation.y = rotY + Math.PI; obj.userData = { kind: "case", bay, item: bay.featured, stand: standFor(side, z, 3.3), spin: true }; clickable.push(obj); scene.add(obj);
        pending++;
        loadImage(bay.featured.thumbnail, fallbackTex(bay, "OBJECT"), (t, ratio) => { objMat.map = t; objMat.needsUpdate = true; let w = 0.62, h = w / ratio; if (h > 0.68) { h = 0.68; w = h * ratio; } obj.geometry.dispose(); obj.geometry = new THREE.PlaneGeometry(w, h); trackLoad(); });
        const caseLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.16), new THREE.MeshBasicMaterial({ map: textTexture([{ text: bay.featured.title, size: 40, weight: "600" }], 1024, 230, "#fffdf7", bay.accent) }));
        caseLabel.position.set(cx - side * 0.41, 0.8, z); caseLabel.rotation.y = rotY + Math.PI; scene.add(caseLabel);
      } }
    });

    // --- interaction
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;
    const toNdc = (cx: number, cy: number) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
    const pickAt = (cx: number, cy: number) => {
      toNdc(cx, cy);
      const hit = ray.intersectObjects(clickable, false)[0];
      return hit && hit.distance < 14 ? (hit.object as THREE.Mesh) : null;
    };
    const floorAt = (cx: number, cy: number) => { toNdc(cx, cy); const hit = ray.intersectObject(floor, false)[0]; return hit && hit.distance < 40 ? hit.point : null; };
    const setHovered = (m: THREE.Mesh | null) => {
      if (hovered === m) return;
      if (hovered) { const mat = hovered.material as THREE.MeshStandardMaterial; if ("emissive" in mat) mat.emissive.set("#000000"); }
      hovered = m;
      if (m) { const mat = m.material as THREE.MeshStandardMaterial; if ("emissive" in mat) mat.emissive.set("#2a2a2a"); }
      const v = m?.userData as Viewable | undefined;
      setHover(v ? (v.kind === "portrait" ? v.bay.name : v.item?.title ?? null) : null);
    };
    const goTo = (g: Goal) => { state.goal = g; setEntered(true); };
    const camPos = new THREE.Vector3(), objPos = new THREE.Vector3();
    const openOrApproach = (m: THREE.Mesh) => {
      const v = m.userData as Viewable & { stand: Stand };
      m.getWorldPosition(objPos); camera.getWorldPosition(camPos);
      if (objPos.distanceTo(camPos) > 4.2) goTo({ ...v.stand, then: { kind: v.kind, bay: v.bay, item: v.item } });
      else setPicked({ kind: v.kind, bay: v.bay, item: v.item });
    };
    ctl.current = {
      goTo,
      zoom: (d) => { state.fovTarget = Math.max(28, Math.min(85, state.fovTarget + d)); },
      reset: () => { state.fovTarget = FOV; state.pitch = 0; },
    };
    const keys = new Set<string>();
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) { if (down) { setEntered(true); state.goal = null; } keys[down ? "add" : "delete"](k); e.preventDefault(); }
      if (k === "escape") setPicked(null);
      if (down && (k === "+" || k === "=")) ctl.current?.zoom(-6); if (down && k === "-") ctl.current?.zoom(6);
    };
    const kd = onKey(true), ku = onKey(false);
    el.addEventListener("keydown", kd); el.addEventListener("keyup", ku);
    const onDown = (e: PointerEvent) => { state.dragging = true; state.lastX = e.clientX; state.lastY = e.clientY; state.moved = 0; el.setPointerCapture(e.pointerId); el.focus(); };
    const onMove = (e: PointerEvent) => {
      if (state.dragging) {
        const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY; state.lastX = e.clientX; state.lastY = e.clientY; state.moved += Math.abs(dx) + Math.abs(dy);
        state.yaw -= dx * 0.0042; state.pitch = Math.max(-0.7, Math.min(0.6, state.pitch - dy * 0.003));
        if (state.moved > 4) { setEntered(true); if (state.goal) state.goal = { ...state.goal, keepYaw: true }; }
        return;
      }
      const m = pickAt(e.clientX, e.clientY); setHovered(m);
      setCursor(m ? "pick" : floorAt(e.clientX, e.clientY) ? "walk" : null);
      // glance: resting the cursor near the left or right edge turns slowly that way
      const r = renderer.domElement.getBoundingClientRect(); const fx = (e.clientX - r.left) / r.width;
      const band = 0.06; const t = fx < band ? (band - fx) / band : fx > 1 - band ? -(fx - (1 - band)) / band : 0;
      state.edgeTurn = entered || fullscreen ? t : 0; setEdge(state.edgeTurn > 0.05 ? 1 : state.edgeTurn < -0.05 ? -1 : 0);
    };
    const onLeave = () => { state.edgeTurn = 0; setEdge(0); setHovered(null); setCursor(null); };
    const onUp = (e: PointerEvent) => {
      state.dragging = false; el.releasePointerCapture(e.pointerId);
      if (state.moved >= 6) return;
      const m = pickAt(e.clientX, e.clientY);
      if (m) { openOrApproach(m); return; }
      const p = floorAt(e.clientX, e.clientY);
      if (p) goTo({ x: clampX(p.x), z: clampZ(p.z), yaw: state.yaw, keepYaw: true });
    };
    const onWheel = (e: WheelEvent) => {
      if (!entered && !fullscreen) return;
      e.preventDefault(); state.goal = null; setEntered(true);
      if (e.ctrlKey || e.metaKey) { state.fovTarget = Math.max(28, Math.min(85, state.fovTarget + e.deltaY * 0.12)); return; }   // pinch on a trackpad arrives as ctrl+wheel
      const unit = e.deltaMode === 1 ? 16 : 1;
      moveRef.current.fwd += (-e.deltaY * unit) / 110;
      state.yaw -= e.deltaX * unit * 0.0035;
    };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp); el.addEventListener("pointercancel", onUp); el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    const onResize = () => { camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(el.clientWidth, el.clientHeight); };
    const ro = new ResizeObserver(onResize); ro.observe(el);
    let visible = true; const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.05 }); io.observe(el);
    const spinners = clickable.filter((o) => o.userData.spin);
    let lastBay: number | null = -2;

    // --- loop
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!visible) return;
      let fwd = 0, strafe = 0, turn = 0;
      if (keys.has("arrowup") || keys.has("w")) fwd += 1; if (keys.has("arrowdown") || keys.has("s")) fwd -= 1;
      if (keys.has("arrowleft")) turn += 1; if (keys.has("arrowright")) turn -= 1;
      if (keys.has("a")) strafe -= 1; if (keys.has("d")) strafe += 1;
      if (moveRef.current.fwd) { fwd += moveRef.current.fwd * 2.2; moveRef.current.fwd *= 0.82; if (Math.abs(moveRef.current.fwd) < 0.02) moveRef.current.fwd = 0; }
      if (moveRef.current.turn) { turn += moveRef.current.turn; }
      state.yaw += turn * 1.6 * dt + state.edgeTurn * 0.9 * dt;
      const speed = 3.2;
      const dirX = -Math.sin(state.yaw), dirZ = -Math.cos(state.yaw);
      const g = state.goal;
      if (g) {
        const dx = g.x - state.x, dz = g.z - state.z, dist = Math.hypot(dx, dz);
        const sp = Math.min(12, Math.max(1.6, dist * 2.4));
        if (dist < 0.1) {
          state.x = g.x; state.z = g.z; state.vx = state.vz = 0; state.goal = null;
          if (g.then) setPicked(g.then);
        } else { state.vx = (dx / dist) * sp; state.vz = (dz / dist) * sp; }
        if (!g.keepYaw) { const diff = Math.atan2(Math.sin(g.yaw - state.yaw), Math.cos(g.yaw - state.yaw)); state.yaw += diff * Math.min(1, dt * 3.2); state.pitch += (0 - state.pitch) * Math.min(1, dt * 3); }
      } else {
        state.vx += (fwd * dirX * speed + strafe * -dirZ * speed - state.vx) * Math.min(1, dt * 8);
        state.vz += (fwd * dirZ * speed + strafe * dirX * speed - state.vz) * Math.min(1, dt * 8);
      }
      state.x = clampX(state.x + state.vx * dt);
      state.z = clampZ(state.z + state.vz * dt);
      state.fov += (state.fovTarget - state.fov) * Math.min(1, dt * 8);
      if (Math.abs(camera.fov - state.fov) > 0.01) { camera.fov = state.fov; camera.updateProjectionMatrix(); }
      camera.position.set(state.x, EYE + Math.sin(now / 420) * 0.012 * Math.min(1, Math.hypot(state.vx, state.vz)), state.z);
      camera.rotation.set(state.pitch, state.yaw, 0, "YXZ");
      for (const o of spinners) o.rotation.y += dt * 0.35;
      // which bay is the visitor standing at?
      let near: number | null = null, best = 4.6;
      bayPositions.forEach((b, n) => { const d = Math.abs(b.z - state.z) + (Math.sign(state.x) === b.side ? 0 : 1.2); if (d < best) { best = d; near = n; } });
      if (near !== lastBay) { lastBay = near; setCurrent(near); }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick); setReady(true);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); ctl.current = null;
      el.removeEventListener("keydown", kd); el.removeEventListener("keyup", ku);
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointercancel", onUp); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("wheel", onWheel);
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mat = m.material as THREE.Material | undefined; if (mat) { (mat as THREE.MeshStandardMaterial).map?.dispose(); mat.dispose(); } });
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bays, fullscreen]);

  // Keep the site-wide chat button out of the way while an exhibit is open.
  useEffect(() => { document.body.classList.toggle("viewer-open", !!picked); return () => document.body.classList.remove("viewer-open"); }, [picked]);

  if (error) return <div className="hall-error">The walkable hall needs the museum API: {error}</div>;

  // Viewer navigation within the picked bay
  const list = picked ? viewables(picked.bay) : [];
  const idx = picked ? list.findIndex((v) => v.kind === picked.kind && (v.item?.id ?? "") === (picked.item?.id ?? "")) : -1;
  const go = (d: number) => { if (list.length) setPicked(list[(idx + d + list.length) % list.length]); };
  const total = bays ? bays.reduce((a, b) => a + viewables(b).length, 0) : 0;
  const perSide = bays ? Math.ceil(bays.length / 2) : 0;
  const zStart = -(perSide * BAY_SPACING + 8) / 2 + 4.5;
  const jump = (n: number) => { if (!bays) return; ctl.current?.goTo({ ...standFor(baySide(n), bayZ(n, zStart)) }); mount.current?.focus(); };
  const step = (d: number) => { if (!bays) return; jump(current === null ? (d > 0 ? bays.length - 1 : 0) : (current + d + bays.length) % bays.length); };

  return (
    <div className={`hall ${fullscreen ? "hall-full" : ""} ${cursor === "pick" ? "hall-hover" : cursor === "walk" ? "hall-walk" : ""} ${entered ? "entered" : ""}`}>
      <div className="hall-canvas" ref={mount} tabIndex={0} aria-label="Walkable 3D hall of the inductees. Click the floor to walk, drag to look around, scroll to move, pinch to zoom, click a picture or display case to open it." />
      {!bays && <div className="hall-loading">Opening the doors…</div>}
      {edge !== 0 && entered && !picked && <div className={`hall-edge ${edge > 0 ? "left" : "right"}`} aria-hidden="true">{edge > 0 ? "‹" : "›"}</div>}
      {hover && !picked && <div className="hall-tip">{hover}</div>}
      {bays && entered && !picked && (
        <div className="hall-where">
          <span className="hall-where-dot" style={current !== null ? { background: bays[current].accent } : undefined} />
          {current !== null ? <><b>{bays[current].name}</b><small>{bays[current].field} · {bays[current].origin_flag} {bays[current].origin_country}</small></> : <><b>Entrance lobby</b><small>{bays.length} inductees ahead · click the floor to walk</small></>}
        </div>
      )}
      {ready && !entered && bays && (
        <div className="hall-splash">
          <span className="eyebrow">Immigrant Hall of Honor</span>
          <h3>Hall of the Inductees</h3>
          <p>{bays.length} inductees, {total} pictures and objects on view. Walk the gallery as you would in person.</p>
          <div className="hall-splash-faces">{bays.map((b, n) => <img key={b.slug} src={b.portrait} alt={b.name} title={b.name} style={{ ["--accent" as string]: b.accent }} onClick={() => { setEntered(true); setTimeout(() => jump(n), 50); }} />)}</div>
          <button type="button" className="btn btn-primary" onClick={() => { setEntered(true); mount.current?.focus(); }}>Enter the hall</button>
          <small>{loaded < 100 ? `Hanging the pictures… ${loaded}%` : "Click the floor to walk · drag to look · scroll to move · pinch to zoom"}</small>
        </div>
      )}
      <div className="hall-hud">
        <div className="hall-hud-row">
          <span className="hall-hint"><b>Click</b> the floor to walk · <b>drag</b> to look · <b>scroll</b> to move, <b>pinch</b> to zoom · <b>click</b> a picture or case · <b>↑ ↓ ← →</b></span>
          <div className="hall-tools" aria-label="View controls">
            <button type="button" onClick={() => ctl.current?.zoom(-8)} title="Zoom in (+)">＋</button>
            <button type="button" onClick={() => ctl.current?.zoom(8)} title="Zoom out (−)">－</button>
            <button type="button" onClick={() => ctl.current?.reset()} title="Reset view">⟲</button>
            {!fullscreen && <Link className="hall-fs" to="/museum" title="Open full screen">⤢</Link>}
          </div>
        </div>
        {bays && (
          <div className="hall-strip" aria-label="Jump to an inductee">
            <button type="button" className="hall-strip-arrow" onClick={() => step(-1)} aria-label="Previous inductee">‹</button>
            <div className="hall-strip-faces">
              {bays.map((b, n) => (
                <button type="button" key={b.slug} className={n === current ? "on" : ""} style={{ ["--accent" as string]: b.accent }} onClick={() => jump(n)} title={`Walk to ${b.name}`}>
                  <img src={b.portrait} alt={b.name} loading="lazy" /><span>{b.name.split(" ").slice(-1)[0]}</span>
                </button>
              ))}
            </div>
            <button type="button" className="hall-strip-arrow" onClick={() => step(1)} aria-label="Next inductee">›</button>
          </div>
        )}
        <div className="hall-pad" aria-hidden="true">
          <button type="button" onPointerDown={() => { moveRef.current.turn = 1; }} onPointerUp={() => { moveRef.current.turn = 0; }} onPointerLeave={() => { moveRef.current.turn = 0; }}>↶</button>
          <button type="button" onPointerDown={() => { moveRef.current.fwd = 2.4; }}>↑</button>
          <button type="button" onPointerDown={() => { moveRef.current.fwd = -2.4; }}>↓</button>
          <button type="button" onPointerDown={() => { moveRef.current.turn = -1; }} onPointerUp={() => { moveRef.current.turn = 0; }} onPointerLeave={() => { moveRef.current.turn = 0; }}>↷</button>
        </div>
      </div>

      {picked && (
        <div className="viewer" role="dialog" aria-label="Exhibit viewer" style={{ ["--accent" as string]: picked.bay.accent }} onClick={(e) => { if (e.target === e.currentTarget) setPicked(null); }}>
          <button type="button" className="viewer-close" onClick={() => setPicked(null)} aria-label="Close">×</button>
          <button type="button" className="viewer-arrow prev" onClick={() => go(-1)} aria-label="Previous">‹</button>
          <button type="button" className="viewer-arrow next" onClick={() => go(1)} aria-label="Next">›</button>
          <figure className="viewer-fig">
            <img src={large(picked.kind === "portrait" ? picked.bay.portrait : picked.item!.thumbnail)} alt={picked.kind === "portrait" ? picked.bay.name : picked.item!.title} />
          </figure>
          <aside className="viewer-label">
            <span className="viewer-count">{idx + 1} / {list.length} in this bay</span>
            {picked.kind === "portrait" ? (
              <>
                <span className="eyebrow" style={{ color: "var(--accent)" }}>{picked.bay.field} · {picked.bay.origin_flag} {picked.bay.origin_country}</span>
                <h3>{picked.bay.name}</h3>
                <p className="hall-tag">{picked.bay.tagline}</p>
                <p className="muted small">{picked.bay.summary}</p>
                <div className="hall-facts"><span>Born {picked.bay.born_year}</span><span>Arrived {picked.bay.immigration_year}</span><span>{picked.bay.died_year ? `Died ${picked.bay.died_year}` : "Living"}</span></div>
                <small className="faint">Portrait: {picked.bay.portrait_credit}</small>
                <Link className="btn btn-primary btn-sm" to={`/inductees/${picked.bay.slug}`}>Enter the exhibit →</Link>
              </>
            ) : (
              <>
                <span className="eyebrow" style={{ color: "var(--accent)" }}>{picked.kind === "case" ? "In the display case" : picked.kind === "scene" ? "From the timeline" : picked.item!.kind}{picked.item!.year ? ` · ${picked.item!.year}` : ""} · {picked.bay.name}</span>
                <h3>{picked.item!.title}</h3>
                <p className="muted small">{picked.item!.description}</p>
                <small className="faint">{picked.item!.credit} · {picked.item!.license}</small>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="btn btn-sm" href={picked.item!.url} target="_blank" rel="noreferrer">View at source ↗</a>
                  <Link className="btn btn-primary btn-sm" to={`/inductees/${picked.bay.slug}${picked.kind === "scene" ? "" : "#artifacts"}`}>{picked.kind === "scene" ? "Open the exhibit →" : "All artifacts →"}</Link>
                </div>
              </>
            )}
            <div className="viewer-strip">
              {list.map((v, k) => <button key={k} type="button" className={k === idx ? "on" : ""} onClick={() => setPicked(v)} title={v.kind === "portrait" ? v.bay.name : v.item!.title}><img src={v.kind === "portrait" ? v.bay.portrait : v.item!.thumbnail} alt="" loading="lazy" /></button>)}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
