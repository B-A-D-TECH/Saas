import type { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../auth.ts";
import { InvalidTokenError, ForbiddenError } from "../utils/errors.ts";
import { getTenantId } from "../utils/helpers.ts";

export interface AuthPayload {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      tenantId?: string;
    }
  }
}

export type Role = "Super Admin" | "Admin" | "Manager" | "Serveur" | "Cuisine" | "Caissier";

const roleHierarchy: Record<Role, number> = {
  "Super Admin": 1,
  Admin: 2,
  Manager: 3,
  Serveur: 4,
  Cuisine: 5,
  Caissier: 6,
};

function normalizeRole(role: unknown): Role {
  const raw = String(role ?? "").trim().toLowerCase();
  const aliases: Record<string, Role> = {
    "super admin": "Super Admin",
    "superadmin": "Super Admin",
    admin: "Admin",
    manager: "Manager",
    serveur: "Serveur",
    cuisine: "Cuisine",
    caissier: "Caissier",
  };

  return aliases[raw] ?? (Object.keys(roleHierarchy).find((candidate) => candidate.toLowerCase() === raw) as Role | undefined) ?? "Caissier";
}

/**
 * Authentication middleware - verifies JWT token
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const header = String(req.header("Authorization") ?? "");
    const token = header.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      throw new InvalidTokenError("Missing authentication token");
    }

    const payload = verifyJwt(token) as unknown as AuthPayload;
    req.user = payload;
    req.tenantId = getTenantId(
      req.header("x-tenant-id"),
      payload.tenantId
    ) ?? undefined;

    next();
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      res.status(401).json(error.toJSON());
    } else {
      res.status(401).json(new InvalidTokenError().toJSON());
    }
  }
}

/**
 * Authorization middleware - requires specific role
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as AuthPayload | undefined;

    if (!user || !allowedRoles.includes(normalizeRole(user.role))) {
      const error = new ForbiddenError("Insufficient permissions");
      res.status(403).json(error.toJSON());
      return;
    }

    next();
  };
}

/**
 * Multi-tenant isolation middleware
 */
export function tenantIsolation(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = req.user as AuthPayload | undefined;
  const tenantId = getTenantId(req.header("x-tenant-id"), user?.tenantId);

  if (!tenantId) {
    const error = new InvalidTokenError("Missing tenant context");
    res.status(401).json(error.toJSON());
    return;
  }

  // Verify user's tenant matches request tenant
  if (user && user.tenantId !== tenantId) {
    const error = new ForbiddenError("Tenant mismatch");
    res.status(403).json(error.toJSON());
    return;
  }

  req.tenantId = tenantId;
  next();
}

/**
 * Optional authentication
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const header = String(req.header("Authorization") ?? "");
    const token = header.replace(/^Bearer\s+/i, "").trim();

    if (token) {
      const payload = verifyJwt(token) as unknown as AuthPayload;
      req.user = payload;
      req.tenantId = getTenantId(
        req.header("x-tenant-id"),
        payload.tenantId
      ) ?? undefined;
    }
  } catch (error) {
    // Silently ignore auth errors for optional auth
  }

  next();
}

