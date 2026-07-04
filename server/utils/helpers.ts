/**
 * Common helper utilities
 */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateSlug(text: string, suffix?: string): string {
  let slug = slugify(text);
  if (suffix) {
    slug = `${slug}-${suffix}`;
  }
  return slug;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract tenant ID from request
 */
export function getTenantId(
  headerTenant?: string,
  tokenTenant?: string
): string | null {
  const tenant = (headerTenant ?? "").trim();
  return tenant || tokenTenant || null;
}

/**
 * Log with context
 */
export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  action?: string;
}

export function createLogger(context: LogContext = {}) {
  const prefix = [
    context.requestId && `[${context.requestId}]`,
    context.tenantId && `[tenant:${context.tenantId}]`,
    context.userId && `[user:${context.userId}]`,
    context.action && `[${context.action}]`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    info: (message: string, data?: unknown) => {
      console.log(`${prefix} ${message}`, data || "");
    },
    warn: (message: string, data?: unknown) => {
      console.warn(`${prefix} ⚠️  ${message}`, data || "");
    },
    error: (message: string, error?: unknown) => {
      console.error(`${prefix} ❌ ${message}`, error || "");
    },
    debug: (message: string, data?: unknown) => {
      if (process.env.DEBUG) {
        console.debug(`${prefix} 🐛 ${message}`, data || "");
      }
    },
  };
}
