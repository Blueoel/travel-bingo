import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { readApiEnvironment } from "./config/environment.js";

async function bootstrap(): Promise<void> {
  const environment = readApiEnvironment();
  const app = await NestFactory.create(AppModule);

  // Photo evidence is sent as a base64 data URL. Keep this slightly above the
  // verifier's 8 MB binary limit because base64 adds roughly 33% overhead.
  app.useBodyParser("json", { limit: "12mb" });
  app.useBodyParser("urlencoded", { limit: "1mb", extended: true });

  app.enableCors({
    origin: environment.corsOrigins.length > 0 ? environment.corsOrigins : true,
    credentials: true,
    allowedHeaders: [
      "content-type",
      "idempotency-key",
      ...(process.env.NODE_ENV === "production" ? [] : ["x-user-id"]),
    ],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  app.enableShutdownHooks();
  await app.listen(environment.port, "0.0.0.0");
}

await bootstrap();
