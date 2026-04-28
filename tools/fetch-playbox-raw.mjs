/**
 * Downloads the single-file playable bundle from Playbox preview (same URL the iframe uses).
 * Usage: node tools/fetch-playbox-raw.mjs [url] [destPath]
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const url =
  process.argv[2] || "https://playbox.play.plbx.ai/playoff/runner/_raw";
const dest = process.argv[3] || path.join("temp", "playable-raw.html");

function download(u, filePath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const file = fs.createWriteStream(filePath);
    https
      .get(
        u,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; goosain-bolt/1.0 asset extract)",
            Accept: "text/html,*/*",
          },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const loc = res.headers.location;
            file.close();
            fs.unlink(filePath, () => {});
            if (!loc) return reject(new Error("Redirect without Location"));
            const next = new URL(loc, u).href;
            return resolve(download(next, filePath));
          }
          if (res.statusCode !== 200) {
            file.close();
            fs.unlink(filePath, () => {});
            return reject(new Error(`HTTP ${res.statusCode}`));
          }
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
        },
      )
      .on("error", (err) => {
        file.close();
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });
}

await download(url, dest);
console.log("Saved", dest, fs.statSync(dest).size, "bytes");
