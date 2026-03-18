import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import httpProxy from "http-proxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const chatbotDir = path.resolve(rootDir, "../chatbot");

const configPath = path.join(rootDir, "gpas.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

if (!config.remoteApiBaseUrl) {
  throw new Error(`Missing remoteApiBaseUrl in ${configPath}`);
}

const remoteApiUrl = new URL(config.remoteApiBaseUrl);
const chatbotPort = 3030;
const chatbotOrigin = `http://127.0.0.1:${chatbotPort}`;
const gatewayPort = 1420;

const chatbotProcess = spawn(
  "pnpm",
  [
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    String(chatbotPort),
    "--strictPort",
  ],
  {
    cwd: chatbotDir,
    env: {
      ...process.env,
      VITE_CENTRAL_API_BASE_URL: "/api",
    },
    stdio: "inherit",
  },
);

const frontendProxy = httpProxy.createProxyServer({
  changeOrigin: true,
  target: chatbotOrigin,
  ws: true,
});

const apiProxy = httpProxy.createProxyServer({
  changeOrigin: true,
  secure: false,
  target: remoteApiUrl.origin,
  ws: false,
});

apiProxy.on("proxyReq", (_proxyReq, req) => {
  const originalUrl = req.url || "/";
  const suffix = originalUrl.replace(/^\/api(?=\/|$)/, "") || "/";
  req.url = `${remoteApiUrl.pathname.replace(/\/$/, "")}${suffix}`;
});

for (const proxy of [frontendProxy, apiProxy]) {
  proxy.on("error", (error, _req, res) => {
    if (res && "writeHead" in res && !res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Development gateway proxy error",
          cause: error.message,
        }),
      );
      return;
    }
  });
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";

  if (url.startsWith("/api/") || url === "/api") {
    apiProxy.web(req, res);
    return;
  }

  frontendProxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => {
  frontendProxy.ws(req, socket, head);
});

server.listen(gatewayPort, "127.0.0.1", () => {
  console.log(`Development gateway ready on http://127.0.0.1:${gatewayPort}`);
});

function shutdown(code = 0) {
  server.close(() => {
    chatbotProcess.kill("SIGTERM");
    process.exit(code);
  });
}

chatbotProcess.on("exit", (code) => {
  shutdown(code ?? 0);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
