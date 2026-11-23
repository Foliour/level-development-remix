// Password gate for /taiwan2026.
//
// After the shared password is entered we set an HttpOnly cookie holding
// `<expiry>.<hmac>`. The HMAC key mixes SESSION_SECRET with the current
// password, so changing TAIWAN_PASSWORD instantly logs everyone out.

const COOKIE_NAME = "taiwan2026_session";
const SESSION_DAYS = 30;
const encoder = new TextEncoder();

type AuthEnv = Pick<Env, "TAIWAN_PASSWORD" | "SESSION_SECRET">;

function assertConfigured(env: AuthEnv) {
  if (!env.TAIWAN_PASSWORD || !env.SESSION_SECRET) {
    throw new Response(
      "Scrapbook is not configured (missing TAIWAN_PASSWORD or SESSION_SECRET).",
      { status: 500 },
    );
  }
}

async function hmac(env: AuthEnv, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${env.SESSION_SECRET}:${env.TAIWAN_PASSWORD}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Constant-time comparison via hashing both sides to equal length.
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

function readCookie(request: Request): string | null {
  const header = request.headers.get("Cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

export async function isAuthenticated(
  request: Request,
  env: AuthEnv,
): Promise<boolean> {
  assertConfigured(env);
  const value = readCookie(request);
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env, exp));
}

export async function checkPassword(
  password: string,
  env: AuthEnv,
): Promise<boolean> {
  assertConfigured(env);
  return safeEqual(password.trim(), env.TAIWAN_PASSWORD);
}

function cookieAttrs(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  // Path=/ (not /taiwan2026) because Remix fetches route data from
  // /taiwan2026.data, which a /taiwan2026 cookie path would not match.
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export async function createSessionCookie(
  request: Request,
  env: AuthEnv,
): Promise<string> {
  const exp = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sig = await hmac(env, exp);
  return `${COOKIE_NAME}=${exp}.${sig}; Max-Age=${SESSION_DAYS * 86400}; ${cookieAttrs(request)}`;
}

export function clearSessionCookie(request: Request): string {
  return `${COOKIE_NAME}=; Max-Age=0; ${cookieAttrs(request)}`;
}
