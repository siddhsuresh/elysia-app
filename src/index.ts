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
  .listen(3000);

logger.info("server started", {
  hostname: app.server?.hostname,
  port: app.server?.port,
});
