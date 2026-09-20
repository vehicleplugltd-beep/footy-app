import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminSession,
  validateAdminKey,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const credentialId = await validateAdminKey(password).catch(() => null);

  if (!credentialId) {
    return NextResponse.json({ error: "Invalid owner key." }, { status: 401 });
  }

  const session = await createAdminSession(credentialId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return response;
}
