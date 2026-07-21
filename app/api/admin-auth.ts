import { env } from "cloudflare:workers";

const COOKIE_NAME = "uhb_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameText(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacKey() {
  if (!env.ADMIN_SESSION_SECRET) return null;
  return crypto.subtle.importKey("raw", encoder.encode(env.ADMIN_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

export function adminAuthConfigured() {
  return Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD_HASH && env.ADMIN_SESSION_SECRET);
}

export async function validAdminCredentials(username: string, password: string) {
  if (!adminAuthConfigured()) return false;
  const passwordHash = await sha256(password);
  return sameText(username, env.ADMIN_USERNAME ?? "") && sameText(passwordHash, env.ADMIN_PASSWORD_HASH ?? "");
}

export async function createAdminSession(username: string) {
  const key = await hmacKey();
  if (!key) throw new Error("관리자 로그인이 아직 설정되지 않았습니다.");
  const payload = toBase64Url(encoder.encode(JSON.stringify({ username, expiresAt: Date.now() + SESSION_SECONDS * 1000 })));
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function hasAdminSession(request: Request) {
  try {
    const token = cookieValue(request);
    if (!token || !env.ADMIN_USERNAME) return false;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return false;
    const key = await hmacKey();
    if (!key) return false;
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return false;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { username?: string; expiresAt?: number };
    return parsed.username === env.ADMIN_USERNAME && Number(parsed.expiresAt ?? 0) > Date.now();
  } catch {
    return false;
  }
}

export function adminSessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearAdminSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
