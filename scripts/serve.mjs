/**
 * serve.mjs — ローカル確認用の最小静的サーバ（依存ゼロ）
 *   node scripts/serve.mjs   → http://localhost:4173
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

async function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  let full = join(ROOT, p);
  try {
    const s = await stat(full);
    if (s.isDirectory()) full = join(full, "index.html");
  } catch {
    full = join(ROOT, "404.html");
  }
  return full;
}

createServer(async (req, res) => {
  try {
    const full = await resolveFile(req.url || "/");
    const data = await readFile(full);
    res.writeHead(200, { "content-type": TYPES[extname(full)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1>");
  }
}).listen(PORT, () => console.log("http://localhost:" + PORT));
