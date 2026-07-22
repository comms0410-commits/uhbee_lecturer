import { env } from "cloudflare:workers";
import { ensureCoreSchema } from "@/db/runtime";

const COOKIE_NAME = "uhb_instructor_session";
const SESSION_SECONDS = 60 * 60 * 12;
const PBKDF2_ITERATIONS = 210_000;
const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function cookieValue(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

async function signingKey() {
  if (!env.ADMIN_SESSION_SECRET) return null;
  return crypto.subtle.importKey("raw", encoder.encode(env.ADMIN_SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function passwordKey(password: string) {
  return crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
}

export async function hashInstructorPassword(password: string, suppliedSalt?: string) {
  const salt = suppliedSalt ? fromBase64Url(suppliedSalt) : crypto.getRandomValues(new Uint8Array(16));
  const key = await passwordKey(password);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: toBase64Url(new Uint8Array(bits)), salt: toBase64Url(salt) };
}

export async function verifyInstructorPassword(password: string, expectedHash: string, salt: string) {
  const actual = (await hashInstructorPassword(password, salt)).hash;
  if (actual.length !== expectedHash.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  return difference === 0;
}

export async function createInstructorSession(email: string, username: string) {
  const key = await signingKey();
  if (!key) throw new Error("강사 로그인이 아직 설정되지 않았습니다.");
  const payload = toBase64Url(encoder.encode(JSON.stringify({ email, username, expiresAt: Date.now() + SESSION_SECONDS * 1000 })));
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function getInstructorSession(request: Request) {
  try {
    const token = cookieValue(request);
    if (!token) return null;
    const [payload, signature] = token.split(".");
    const key = await signingKey();
    if (!payload || !signature || !key) return null;
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { email?: string; username?: string; expiresAt?: number };
    if (!parsed.email || !parsed.username || Number(parsed.expiresAt ?? 0) <= Date.now()) return null;
    const db = await ensureCoreSchema();
    const account = await db.prepare(`SELECT c.user_email, c.username FROM instructor_credentials c
      JOIN users u ON u.email = c.user_email AND u.role = 'instructor'
      JOIN instructor_profiles p ON p.user_email = u.email AND p.registered_by_admin = 1
      WHERE c.user_email = ? AND c.username = ?`).bind(parsed.email, parsed.username).first<{ user_email: string; username: string }>();
    return account ? { email: account.user_email, username: account.username } : null;
  } catch {
    return null;
  }
}

export function instructorSessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearInstructorSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}
