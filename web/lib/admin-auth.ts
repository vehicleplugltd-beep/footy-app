import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const DEFAULT_SUPABASE_URL = "https://nlmtcimkqymynsyflimv.supabase.co";
export const ADMIN_COOKIE = "footy_admin_session";

function config() {
  const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? { url, key } : null;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function equalHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

async function rest<T>(path: string, init: RequestInit = {}) {
  const cfg = config();
  if (!cfg) throw new Error("Admin storage is not configured.");
  const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Admin storage failed (${response.status}).`);
  }
  const body = await response.text();
  return body ? (JSON.parse(body) as T) : (null as T);
}

export async function validateAdminKey(value: string) {
  if (!value) return null;
  const rows = await rest<Array<{ id: string; key_hash: string }>>(
    "footy_admin_credentials?select=id,key_hash&id=eq.owner-primary&active=eq.true&limit=1",
  );
  const credential = rows[0];
  if (!credential || !equalHex(hash(value), credential.key_hash)) return null;
  return credential.id;
}

export async function createAdminSession(credentialId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  await rest("footy_admin_sessions", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      token_hash: hash(token),
      credential_id: credentialId,
      expires_at: expiresAt,
    }),
  });

  return { token, expiresAt };
}

export async function hasAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  const rows = await rest<Array<{ token_hash: string }>>(
    `footy_admin_sessions?select=token_hash&token_hash=eq.${hash(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`,
  ).catch(() => []);

  return rows.length > 0;
}

export async function revokeAdminToken(token: string | undefined) {
  if (!token) return;
  await rest(`footy_admin_sessions?token_hash=eq.${hash(token)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  }).catch(() => null);
}
