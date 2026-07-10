import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 5173);
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"]
]);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const clean = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const target = path.normalize(path.join(root, clean));
    if (!target.startsWith(root)) throw new Error("Forbidden");
    const data = await readFile(target);
    res.writeHead(200, { "Content-Type": types.get(path.extname(target)) || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`우당탕 동물도장 dev server: http://127.0.0.1:${port}`);
});
