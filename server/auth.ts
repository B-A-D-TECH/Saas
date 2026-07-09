import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? "saas-secret-key";
const JWT_SECRET_FALLBACKS = [
  process.env.JWT_SECRET,
  process.env.JWT_SECRET_ALT,
  "saas-secret-key",
  "dev-secret-key-change-in-production",
].filter((value): value is string => Boolean(value));
const JWT_EXPIRY: jwt.SignOptions["expiresIn"] = "2h";

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 3, parallelism: 1 });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function createJwt(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyJwt(token: string): Record<string, unknown> {
  for (const secret of JWT_SECRET_FALLBACKS) {
    try {
      return jwt.verify(token, secret) as Record<string, unknown>;
    } catch {
      // try next candidate
    }
  }

  throw new Error("Invalid token");
}

export function createToken(): string {
  return randomUUID();
}
