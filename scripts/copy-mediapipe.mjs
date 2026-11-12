// Copies MediaPipe's WebAssembly runtime into /public so the magic mirror
// loads it from our own origin instead of a CDN. Runs after `npm install`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = path.join(root, "public", "mediapipe", "wasm");

if (!existsSync(source)) {
  console.warn("[mediapipe] tasks-vision is not installed; skipping WASM copy.");
  process.exit(0);
}

mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log("[mediapipe] Copied WASM runtime to public/mediapipe/wasm");
