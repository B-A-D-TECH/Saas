/**
 * Global Constants for SaaS Application
 */

export const ROLES = ["Super Admin", "Admin", "Manager", "Serveur", "Cuisine", "Caissier"] as const;

export const PLAN_TYPES = ["free", "starter", "professional", "enterprise"] as const;

export const SERVICE_MODES = ["sur_place", "emporter"] as const;

export const ORDER_STATUSES = ["recue", "preparation", "prete", "payee"] as const;

export const DEFAULT_PAGINATION_LIMIT = 20;
export const MAX_PAGINATION_LIMIT = 100;

export const TRIAL_DAYS = 14;

export const PASSWORD_MIN_LENGTH = 8;
export const SLUG_MAX_LENGTH = 255;
export const NAME_MAX_LENGTH = 255;

/**
 * Feature Flags
 */
export const FEATURES = {
  INVENTORY_MANAGEMENT: true,
  SUPPLIER_MANAGEMENT: true,
  AUDIT_LOGGING: true,
  MULTI_LOCATION: false,
  ONLINE_ORDERING: false,
  DELIVERY_INTEGRATION: false,
} as const;
