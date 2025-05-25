import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import winston, { transports } from "winston";

const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ]
});

const app = new Elysia()
  .use(swagger())
  .get("/", ({headers}) => {
    const requestId = headers["x-amz-cf-id"]
    logger.info("Hi from GET", { requestId });
    return "Hello Elysia! Version 4";
  })
  .get("/error", ({headers}) => {
    const requestId = headers["x-amz-cf-id"]
    logger.error("Error", { requestId });
    throw new Error("Error");
  })
  .post("/", ({headers}) => {
    const requestId = headers["x-amz-cf-id"]
    logger.info("Hi from POST", { requestId });
    return "Hello Elysia! Version 4";
  })
  .listen(3000);

logger.debug(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
