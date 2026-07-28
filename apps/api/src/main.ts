import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { readApiEnvironment } from "./config/environment.js";

async function bootstrap(): Promise<void> {
  const environment = readApiEnvironment();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: environment.corsOrigins.length > 0 ? environment.corsOrigins : true,
    credentials: true,
    allowedHeaders: ["content-type", "idempotency-key"],
    methods: ["GET", "POST", "OPTIONS"],
  });
  app.enableShutdownHooks();
  await app.listen(environment.port, "0.0.0.0");
}

await bootstrap();
