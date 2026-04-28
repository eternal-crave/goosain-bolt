/**
 * Extracts data:*;base64,... payloads from HTML/JS text and writes decoded files.
 * Playbox runner bundle URL: https://playbox.play.plbx.ai/playoff/runner/_raw
 *
 * Usage: node tools/extract-data-urls-from-html.mjs <input.html> [outRoot] [--clean]
 * Default outRoot: assets/reference-playbox (subfolders textures | audio | fonts)
 * --clean removes existing files in those subfolders before writing (keeps .meta).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const argv = process.argv.slice(2);
const clean = argv.includes("--clean");
const args = argv.filter((a) => a !== "--clean");
const inputPath = args[0] || "temp/playable-raw.html";
const outRoot = args[1] || "assets/reference-playbox";

function emptyAssetSubdirs() {
  for (const sub of ["textures", "audio", "fonts"]) {
    const d = path.join(outRoot, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith(".meta")) continue;
      fs.unlinkSync(path.join(d, f));
    }
  }
}

if (clean) emptyAssetSubdirs();

const raw = fs.readFileSync(inputPath, "utf8");
const re = /data:([a-zA-Z0-9.+/\-]+);base64,([A-Za-z0-9+/=]+)/g;

const extFor = (mime) => {
  const m = mime.split(";")[0].trim().toLowerCase();
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/wave": ".wav",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
    "video/webm": ".webm",
    "font/ttf": ".ttf",
    "font/otf": ".otf",
    "font/woff": ".woff",
    "font/woff2": ".woff2",
    "application/octet-stream": ".bin",
  };
  return map[m] || `.${m.replace(/[/+]/g, "_")}`;
};

function subdirForMime(mime) {
  const m = mime.split(";")[0].trim().toLowerCase();
  if (m.startsWith("audio/") || m.startsWith("video/")) return "audio";
  if (m.startsWith("font/")) return "fonts";
  return "textures";
}

let match;
const seen = new Map();
let idx = 0;
while ((match = re.exec(raw)) !== null) {
  const mime = match[1];
  const b64 = match[2];
  const key = `${mime}|${b64.length}|${b64.slice(0, 64)}`;
  if (seen.has(key)) continue;
  seen.set(key, true);
  idx++;
  const buf = Buffer.from(b64, "base64");
  const ext = extFor(mime);
  const safeMime = mime.replace(/[/+]/g, "_");
  const sub = subdirForMime(mime);
  const dir = path.join(outRoot, sub);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${String(idx).padStart(3, "0")}_${safeMime}${ext}`;
  fs.writeFileSync(path.join(dir, name), buf);
  console.log(path.join(sub, name), buf.length, "bytes");
}
console.log("total unique base64 blobs:", idx);

function writeDirMeta(metaPath, uuid) {
  const body = {
    ver: "1.2.0",
    importer: "directory",
    imported: true,
    uuid,
    files: [],
    subMetas: {},
    userData: {},
  };
  fs.writeFileSync(metaPath, JSON.stringify(body, null, 2));
}

if (idx > 0) {
  const rootMeta = path.join(path.dirname(outRoot), path.basename(outRoot) + ".meta");
  if (!fs.existsSync(rootMeta)) {
    writeDirMeta(rootMeta, crypto.randomUUID());
    writeDirMeta(path.join(outRoot, "textures.meta"), crypto.randomUUID());
    writeDirMeta(path.join(outRoot, "audio.meta"), crypto.randomUUID());
    writeDirMeta(path.join(outRoot, "fonts.meta"), crypto.randomUUID());
    console.log("Wrote folder metas:", rootMeta, "and subfolder metas");
  }
}
