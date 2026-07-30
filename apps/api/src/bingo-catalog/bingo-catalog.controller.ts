import { Controller, Get, Headers } from "@nestjs/common";

import { AuthService } from "../auth/auth.service.js";
import {
  BingoCatalogService,
  type BingoCatalogItem,
} from "./bingo-catalog.service.js";

@Controller("api/v1/bingos")
export class BingoCatalogController {
  constructor(
    private readonly catalog: BingoCatalogService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  async list(
    @Headers("x-user-id") userId: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
  ): Promise<{ readonly items: BingoCatalogItem[] }> {
    return {
      items: await this.catalog.list(
        await this.auth.requireUserId(cookieHeader, userId),
      ),
    };
  }
}
