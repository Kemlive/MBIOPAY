import jwt from "jsonwebtoken";

function requireSecret(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${name} environment variable is required in production but was not set.`);
    }
    return fallback;
  }
  return value;
}

const ACCESS_SECRET = requireSecret("JWT_SECRET", "mbio-dev-access-secret-do-not-use-in-prod");
const REFRESH_SECRET = requireSecret("REFRESH_SECRET", "mbio-dev-refresh-secret-do-not-use-in-prod");

export interface JwtPayload {
  id: number;
}

export function signAccess(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefresh(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
