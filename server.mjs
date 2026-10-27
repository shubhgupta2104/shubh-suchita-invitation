import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4186);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8"
};
const pages = new Set(["/index.html", "/styles.css", "/app.js"]);

const server = http.createServer(async (request, response) => {
  const respond = (status, message) => {
    response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(message);
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    respond(405, "Method not allowed");
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(request.url.split("?")[0]);
  } catch {
    respond(400, "Invalid URL");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const asset = /^\/assets\/(?:artwork|fonts|audio)\/[a-zA-Z0-9._-]+\.(?:svg|jpg|ttf|txt|m4a)$/.test(pathname);
  if (!pages.has(pathname) && !asset) {
    respond(404, "Not found");
    return;
  }
  try {
    const file = await realpath(resolve(root, `.${pathname}`));
    if (!file.startsWith(`${root}${sep}`)) {
      respond(403, "Not available");
      return;
    }
    const content = await readFile(file);
    const headers = {
      "Content-Type": types[extname(file)],
      "Content-Length": content.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    };
    if (extname(file) === ".m4a") {
      headers["Accept-Ranges"] = "bytes";
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        const start = range?.[1] ? Number(range[1]) : Math.max(0, content.length - Number(range?.[2]));
        const end = range?.[1] && range[2] ? Math.min(Number(range[2]), content.length - 1) : content.length - 1;
        if (!range || (!range[1] && !range[2]) ||
            !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
            start < 0 || start > end || start >= content.length) {
          response.writeHead(416, { "Content-Range": `bytes */${content.length}` });
          response.end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${content.length}`
        });
        response.end(request.method === "HEAD" ? undefined : content.subarray(start, end + 1));
        return;
      }
    }
    response.writeHead(200, headers);
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      respond(404, "Not found");
    } else {
      console.error("Could not serve the requested invitation asset:", error);
      respond(500, "Could not load this file");
    }
  }
});

server.on("error", (error) => {
  console.error("The local invitation preview could not start:", error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Invitation preview: http://127.0.0.1:${port}`);
});
