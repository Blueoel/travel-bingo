import {
  Controller,
  Get,
  Headers,
  Post,
  Res,
  UnauthorizedException,
} from "@nestjs/common";

import {
  AUTH_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE_MS,
  AuthService,
} from "./auth.service.js";

interface CookieResponse {
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
}

@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("guest")
  async guest(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<{
    readonly user: { readonly id: string; readonly nickname: string };
  }> {
    const existing = await this.authService.getUser(cookieHeader);
    if (existing) return { user: existing };
    const { token, user } = await this.authService.createGuest();
    response.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
    return { user };
  }

  @Get("me")
  async me(@Headers("cookie") cookieHeader: string | undefined): Promise<{
    readonly user: { readonly id: string; readonly nickname: string };
  }> {
    const user = await this.authService.getUser(cookieHeader);
    if (!user) {
      throw new UnauthorizedException("A valid user session is required.");
    }
    return { user };
  }

  @Post("logout")
  async logout(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<{ readonly success: true }> {
    await this.authService.revoke(cookieHeader);
    response.clearCookie(AUTH_COOKIE_NAME, cookieOptions());
    return { success: true };
  }
}

function cookieOptions(): Record<string, unknown> {
  const production = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE_MS,
  };
}
