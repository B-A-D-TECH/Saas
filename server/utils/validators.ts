import { z } from "zod";
import { ValidationError } from "./errors";

/**
 * Common validation schemas
 */

export const UUIDSchema = z.string().uuid("Invalid UUID format");
export const EmailSchema = z.string().email("Invalid email format");
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

export const TenantNameSchema = z.string().min(2).max(255);
export const TenantSlugSchema = z
  .string()
  .min(2)
  .max(255)
  .regex(/^[a-z0-9-]+$/);

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

/**
 * Validator helper to catch and format validation errors
 */
export function validate<T>(schema: z.ZodSchema, data: unknown): T {
  try {
    return schema.parse(data) as T;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formatted = error.errors.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path || "root"] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );
      throw new ValidationError("Validation failed", formatted);
    }
    throw error;
  }
}
