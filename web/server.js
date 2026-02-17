const { createServer } = require("https");
const http = require("http");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");

const app = next({ dev: false });
const handle = app.getRequestHandler();

const BACKEND = process.env.BACKEND_URL || "http://backend:8080";

app.prepare().then(() => {
  const options = {
    key: fs.readFileSync("./key.pem"),
    cert: fs.readFileSync("./cert.pem"),
  };

  const server = createServer(options, (req, res) => {
    const parsed = parse(req.url, true);

    if (parsed.pathname.startsWith("/api/")) {
      const proxyReq = http.request(
        `${BACKEND}${req.url}`,
        { method: req.method, headers: req.headers },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on("error", (err) => {
        console.error("Proxy error:", err.message);
        res.writeHead(502);
        res.end("Bad Gateway");
      });
      req.pipe(proxyReq);
      return;
    }

    handle(req, res, parsed);
  });

  server.listen(3000, "0.0.0.0", () => {
    console.log("HTTPS server running on https://0.0.0.0:3000");
  });
});
