import type { NextRequest } from "next/server";
import { getBearerToken, verifyAuthToken, type AuthTokenPayload } from "./jwt";

export function getAuthPayload(request: NextRequest): AuthTokenPayload | null {
  const token = getBearerToken(request.headers.get("authorization"));
  if (!token) return null;

  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}
