/**
 * Unpacks network responses from a Chrome/Edge "Save all as HAR with content" export.
 * Usage: node tools/extract-har-assets.mjs <file.har> [outDir]
 * Default outDir: assets/reference-from-har
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const harPath = process.argv[2];
const outDir = process.argv[3] || "assets/reference-from-har";

if (!harPath || !fs.existsSync(harPath)) {
  console.error("Usage: node tools/extract-har-assets.mjs <path/to/file.har> [outDir]");
  process.exit(1);
}

const har = JSON.parse(fs.readFileSync(harPath, "utf8"));
const entries = har.log?.entries;
if (!Array.isArray(entries)) {
  console.error("Invalid HAR: missing log.entries");
  process.exit(1);
}

const extFromMime = (mime) => {
  if (!mime) return "";
  const m = mime.split(";")[0].trim().toLowerCase();
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "font/woff2": ".woff2",
    "font/woff": ".woff",
    "application/json": ".json",
    "text/html": ".html",
    "text/javascript": ".js",
    "application/javascript": ".js",
  };
  return map[m] || "";
};

function safeFilename(urlStr, index) {
  try {
    const u = new URL(urlStr);
    const base = path.basename(u.pathname) || "resource";
    const clean = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    if (clean && clean !== "_") return `${String(index).padStart(4, "0")}_${clean}`;
  } catch {
    /* ignore */
  }
  return `${String(index).padStart(4, "0")}_resource`;
}

let written = 0;
fs.mkdirSync(outDir, { recursive: true });

for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const url = e.request?.url;
  const content = e.response?.content;
  if (!url || !content) continue;
  const text = content.text;
  if (text == null || text === "") continue;
  const mime = content.mimeType || e.response?.content?.mimeType || "";
  let buf;
  if (content.encoding === "base64") buf = Buffer.from(text, "base64");
  else if (/^text\//.test(mime) || mime.includes("javascript") || mime.includes("json")) {
    buf = Buffer.from(text, "utf8");
  } else {
    try {
      buf = Buffer.from(text, "base64");
    } catch {
      continue;
    }
  }
  if (!buf || buf.length === 0) continue;
  let ext = extFromMime(mime);
  if (!ext) {
    try {
      ext = path.extname(new URL(url).pathname) || ".bin";
    } catch {
      ext = ".bin";
    }
  }
  const baseName = safeFilename(url, i);
  const name = nameHasExt(baseName) ? baseName : baseName + ext;
  const outPath = path.join(outDir, name);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  written++;
  console.log(outPath, buf.length);
}

function nameHasExt(n) {
  return /\.[a-zA-Z0-9]{2,8}$/.test(n);
}

const rootMeta = path.join(path.dirname(outDir), path.basename(outDir) + ".meta");
if (!fs.existsSync(rootMeta)) {
  fs.writeFileSync(
    rootMeta,
    JSON.stringify(
      {
        ver: "1.2.0",
        importer: "directory",
        imported: true,
        uuid: crypto.randomUUID(),
        files: [],
        subMetas: {},
        userData: {},
      },
      null,
      2,
    ),
  );
}
console.log("HAR entries with body written:", written, written ? `(meta: ${rootMeta})` : "");
