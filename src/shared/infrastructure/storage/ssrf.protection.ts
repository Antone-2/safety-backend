import { getEnv } from "../../../config/index.js";

const env = getEnv();

const ALLOWED_DOMAINS = new Set(
  [
    "drive.google.com",
    "docs.google.com",
    "accounts.google.com",
    "www.googleapis.com",
    "play.google.com",
    "lh3.googleusercontent.com",
    "lh4.googleusercontent.com",
    "lh5.googleusercontent.com",
    "lh6.googleusercontent.com",
    ...((env as any).SSRF_ALLOWED_DOMAINS || "")
      .split(",")
      .map((value: string) => value.trim())
      .filter(Boolean),
  ].map((domain) => domain.toLowerCase()),
);

const ALLOWED_SCHEMES = new Set(["https", "http"]);

function isPrivateIp(host: string): boolean {
  const lowered = host.toLowerCase();
  if (lowered === "localhost" || lowered === "127.0.0.1" || lowered === "::1") {
    return true;
  }

  const parts = lowered.split(".").map(Number);
  if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }

  if (lowered.startsWith("10.") || lowered.startsWith("192.168.") || lowered.startsWith("172.")) {
    return true;
  }

  return false;
}

export function isUrlAllowedForFetch(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol.replace(":", ""))) {
    return false;
  }

  if (ALLOWED_DOMAINS.size > 0) {
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_DOMAINS.has(hostname)) {
      return false;
    }
  }

  if (isPrivateIp(parsed.hostname)) {
    return false;
  }

  return true;
}

export async function safeFetch(input: string, init?: globalThis.RequestInit) {
  if (!isUrlAllowedForFetch(input)) {
    throw new Error("URL is not allowed for outbound fetch");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
        ...(init?.headers || {}),
      },
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}
