import { NextResponse, type NextRequest } from "next/server";
import { getAuthPayload } from "@/lib/auth/request";

export async function GET(request: NextRequest) {
  const payload = getAuthPayload(request);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ user: payload });
}
