const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
  }
  return res.json();
}

export interface AuthUser {
  id: number;
  uid: string;
  email: string;
  username: string;
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    return await apiFetch("/api/auth/me");
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(email: string, username: string, password: string): Promise<AuthUser> {
  return apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
