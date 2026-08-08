import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";
import { requireEnv } from "@/lib/env";

export interface AuthTokenPayload {
  sub: string; // user id
  email: string;
  role: Role;
}

const TOKEN_EXPIRY = "7d";

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, requireEnv("JWT_SECRET"), { expiresIn: TOKEN_EXPIRY });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, requireEnv("JWT_SECRET")) as AuthTokenPayload;
}

// Auth disimpan di localStorage (bukan cookie) — dikirim client via header
// `Authorization: Bearer <token>`.
export function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}
