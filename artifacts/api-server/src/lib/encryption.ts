import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "mbio-dev-32-byte-fallback-key!!!";
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const [ivHex, data] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  return decipher.update(data, "hex", "utf8") + decipher.final("utf8");
}
