// serve.ts — tiny static file server for local development.
//
// Serves the repository root on http://localhost:8080 so the game can be
// opened at http://localhost:8080/game/index.html. No dependencies: only
// Node's standard library is used, and the file runs directly under
// Node 24 (type stripping handles the TypeScript syntax).
//
//   node serve.ts

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8080;

// The directory this script lives in is the web root.
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

function contentTypeFor(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// Turn a request URL into an absolute path inside ROOT, or return null
// when the path would escape the root (path traversal attempt).
function resolveRequestPath(rawUrl: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, "http://localhost").pathname);
  } catch {
    return null;
  }
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }
  const absolute = resolve(join(ROOT, normalize(pathname)));
  if (absolute !== ROOT && !absolute.startsWith(ROOT + sep)) {
    return null;
  }
  return absolute;
}

const server = createServer(async (req, res) => {
  const filePath = resolveRequestPath(req.url ?? "/");

  if (filePath === null) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let info;
  try {
    info = await stat(filePath);
  } catch {
    info = undefined;
  }

  if (!info || !info.isFile()) {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentTypeFor(filePath),
    "Content-Length": info.size,
    "Cache-Control": "no-store",
  });
  // HEAD requests get the same headers as GET but no body.
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}/ (game: /game/index.html)`);
});
