export interface QuoteLineInput {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface BillingSettingsLike {
  quoteEnabled?: boolean;
  quotePrefix?: string;
  invoicePrefix?: string;
  taxRate?: number;
  paymentTerms?: string;
  footer?: string;
}

export interface GeneralSettingsLike {
  companyName?: string;
}

export interface BuiltQuotePayload {
  reference: string;
  invoiceReference: string;
  companyName: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentTerms: string;
  footer: string;
  enabled: boolean;
  lines: Array<{ name: string; qty: number; unitPrice: number; total: number }>;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildQuotePayload(
  input: { lines: QuoteLineInput[] },
  billing: BillingSettingsLike = {},
  general: GeneralSettingsLike = {},
): BuiltQuotePayload | null {
  const enabled = billing.quoteEnabled ?? true;
  if (!enabled) return null;

  const lines = input.lines.map((line) => ({
    name: line.name,
    qty: Math.max(1, Math.round(line.qty || 1)),
    unitPrice: safeNumber(line.unitPrice),
    total: safeNumber(line.unitPrice) * Math.max(1, Math.round(line.qty || 1)),
  }));

  const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
  const taxRate = Math.max(0, Math.min(100, safeNumber(billing.taxRate)));
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  const quotePrefix = (billing.quotePrefix ?? "DEV").toString().trim() || "DEV";
  const invoicePrefix = (billing.invoicePrefix ?? "FAC").toString().trim() || "FAC";

  return {
    reference: `${quotePrefix}-0001`,
    invoiceReference: `${invoicePrefix}-0001`,
    companyName: general.companyName?.trim() || "Votre entreprise",
    subtotal,
    taxRate,
    taxAmount,
    total,
    paymentTerms: billing.paymentTerms?.trim() || "Paiement à la livraison",
    footer: billing.footer?.trim() || "Merci pour votre confiance.",
    enabled,
    lines,
  };
}
