const BASE = import.meta.env.VITE_API_URL || "https://mbiopay-production-5f7f.up.railway.app";

const TOKEN_KEY = "mbio_access";
const REFRESH_KEY = "mbio_refresh";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!res.ok) {
      clearTokens();
      return null;
    }

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiFetch(path: string, opts: RequestInit = {}) {
  let token = getAccessToken();

  const doFetch = (t: string | null) =>
    fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(opts.headers ?? {}),
      },
    });

  let res = await doFetch(token);

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await doFetch(newToken);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), {
      status: res.status,
      data: body,
    });
  }

  return res.json();
}

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  usernameSet: boolean;
  emailVerified: boolean;
  totpEnabled: boolean;
  createdAt: string;
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    return await apiFetch("/api/auth/me");
  } catch {
    return null;
  }
}

export interface SignupResult {
  requiresVerification: true;
  email: string;
}

export interface LoginResult {
  requiresTOTP?: true;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;
}

export async function signup(email: string, username: string, password: string): Promise<SignupResult> {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Signup failed");
  return body;
}

export async function verifyEmail(email: string, code: string): Promise<AuthUser> {
  const res = await fetch(`${BASE}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Verification failed");
  setTokens(body.accessToken, body.refreshToken);
  return body.user;
}

export async function resendVerification(email: string): Promise<void> {
  const res = await fetch(`${BASE}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Failed to resend code");
}

export async function login(email: string, password: string, totpToken?: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, totpToken }),
  });
  const body = await res.json();

  if (res.status === 403 && body.requiresVerification) {
    throw Object.assign(new Error(body.error ?? "Email not verified"), {
      requiresVerification: true,
      email: body.email,
    });
  }

  if (!res.ok) throw new Error(body.error ?? "Login failed");

  if (body.requiresTOTP) {
    return { requiresTOTP: true, email: body.email };
  }

  setTokens(body.accessToken, body.refreshToken);
  return { user: body.user };
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  clearTokens();
  await apiFetch("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {});
}

export async function setup2FA(): Promise<{ secret: string; qr: string; otpauthUrl: string }> {
  return apiFetch("/api/auth/2fa/setup");
}

export async function enable2FA(token: string): Promise<void> {
  await apiFetch("/api/auth/2fa/enable", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function disable2FA(password: string, token: string): Promise<void> {
  await apiFetch("/api/auth/2fa/disable", {
    method: "POST",
    body: JSON.stringify({ password, token }),
  });
}
