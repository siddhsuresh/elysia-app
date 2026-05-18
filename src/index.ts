import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: "elysia-app",
    env: process.env.NODE_ENV ?? "development",
    version: process.env.APP_VERSION,
    hostname: process.env.HOSTNAME,
    pid: process.pid,
  },
  transports: [new winston.transports.Console({ handleExceptions: true, handleRejections: true })],
  exitOnError: false,
});

// hostHue maps a host string to a deterministic hue (0-360) so each domain
// renders with a distinct background colour. Lets a user with two browser
// tabs on different domains tell at a glance which is which — useful when
// verifying SNI cert attachment and DNS routing in the Ravion Domains tab.
function hostHue(host: string): number {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return h % 360;
}

const BUILD_INFO = {
  commit: process.env.GIT_COMMIT ?? "unknown",
  builtAt: process.env.BUILT_AT ?? "unknown",
  env: process.env.NODE_ENV ?? "development",
  hostname: process.env.HOSTNAME ?? "unknown",
  version: process.env.APP_VERSION ?? "unknown",
};

const app = new Elysia()
  .use(swagger())
  .get("/", ({ headers }) => {
    const requestId = headers["x-amz-cf-id"];
    logger.info("handled GET /", { requestId, route: "GET /" });
    return "Hello Elysia! Version 6";
  })
  .get("/error", ({ headers }) => {
    const requestId = headers["x-amz-cf-id"];
    logger.error("handled GET /error", { requestId, route: "GET /error" });
    throw new Error("Error");
  })
  .get("/health", () => {
    return "OK";
  })
  .post("/", ({ headers }) => {
    const requestId = headers["x-amz-cf-id"];
    logger.info("handled POST /", { requestId, route: "POST /" });
    return "Hello Elysia! Version 6";
  })
  // /whoami — visual "which host did I land on?" page. Background colour is
  // hash-derived from the Host header so two browser tabs on different
  // domains are unmistakably distinct. Used to verify SNI cert attachment +
  // DNS routing from the Ravion Domains tab without reading log lines.
  .get("/whoami", ({ headers, set }) => {
    const host = headers["host"] ?? "unknown";
    const proto = headers["x-forwarded-proto"] ?? "http";
    const forwardedFor = headers["x-forwarded-for"] ?? "";
    const traceId = headers["x-amzn-trace-id"] ?? "";
    const hue = hostHue(host);
    set.headers["content-type"] = "text/html; charset=utf-8";
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>${host}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: hsl(${hue}, 70%, 92%); color: hsl(${hue}, 80%, 15%); margin: 0; padding: 3rem; }
  h1 { font-size: 3rem; margin: 0 0 1rem; word-break: break-all; }
  .badge { display: inline-block; padding: .25rem .75rem; border-radius: .5rem; background: hsl(${hue}, 70%, 30%); color: hsl(${hue}, 70%, 95%); font-weight: 600; font-size: .9rem; letter-spacing: .05em; text-transform: uppercase; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .5rem 1.5rem; margin-top: 2rem; font-family: ui-monospace, monospace; }
  dt { font-weight: 600; opacity: .7; }
  dd { margin: 0; word-break: break-all; }
</style></head>
<body>
  <span class="badge">${proto.toString().toUpperCase()}</span>
  <h1>${host}</h1>
  <dl>
    <dt>protocol</dt><dd>${proto}</dd>
    <dt>x-forwarded-for</dt><dd>${forwardedFor || "—"}</dd>
    <dt>x-amzn-trace-id</dt><dd>${traceId || "—"}</dd>
    <dt>version</dt><dd>${BUILD_INFO.version}</dd>
    <dt>commit</dt><dd>${BUILD_INFO.commit}</dd>
    <dt>hostname</dt><dd>${BUILD_INFO.hostname}</dd>
  </dl>
</body></html>`;
  })
  // /headers — raw JSON dump of every incoming header. Catches "wrong ALB
  // hit me" or "request didn't terminate TLS" bugs that pretty pages hide.
  .get("/headers", ({ headers }) => headers)
  // /version — runtime identity for verifying that a destroy + redeploy
  // actually rolled the workload without breaking the cert/domain wiring.
  // Returned as JSON so it's curl-friendly in CI smoke tests.
  .get("/version", () => BUILD_INFO)
  .listen(3000);

logger.info("server started", {
  hostname: app.server?.hostname,
  port: app.server?.port,
});
