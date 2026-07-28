import "reflect-metadata";

import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, it } from "vitest";

import { HealthController } from "../src/health/health.controller.js";

describe("health endpoint", () => {
  it("returns an ok response", async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();

    await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200)
      .expect({ status: "ok" });

    await app.close();
  });
});
