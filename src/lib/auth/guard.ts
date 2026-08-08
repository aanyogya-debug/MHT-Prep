import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { getAuthPayload } from "./request";
import type { AuthTokenPayload } from "./jwt";

type GuardResult =
  | { ok: true; payload: AuthTokenPayload }
  | { ok: false; response: NextResponse };

export function requireAuth(request: NextRequest): GuardResult {
  const payload = getAuthPayload(request);
  if (!payload) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, payload };
}

export function requireRole(request: NextRequest, role: Role): GuardResult {
  const auth = requireAuth(request);
  if (!auth.ok) return auth;
  if (auth.payload.role !== role) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}
