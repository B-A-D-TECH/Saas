import test from "node:test";
import assert from "node:assert/strict";
import { buildQuotePayload } from "./quote.ts";

test("buildQuotePayload generates quote values from billing settings", () => {
  const quote = buildQuotePayload(
    {
      lines: [{ name: "Pizza", qty: 2, unitPrice: 50 }],
    },
    {
      quoteEnabled: true,
      quotePrefix: "DEV",
      taxRate: 10,
      paymentTerms: "Paiement à la livraison",
      footer: "Merci pour votre confiance",
    },
    { companyName: "Le Petit Bistro" },
  );

  assert.ok(quote);
  assert.equal(quote?.reference.startsWith("DEV-"), true);
  assert.equal(quote?.subtotal, 100);
  assert.equal(quote?.taxRate, 10);
  assert.equal(quote?.taxAmount, 10);
  assert.equal(quote?.total, 110);
  assert.equal(quote?.paymentTerms, "Paiement à la livraison");
  assert.equal(quote?.footer, "Merci pour votre confiance");
});
