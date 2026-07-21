import test from "node:test";
import assert from "node:assert/strict";
import { decodeInvoiceData } from "./invoice";

test("decodeInvoiceData decodes base64 invoice payloads", () => {
  const encoded = "data:application/pdf;base64,SGVsbG8gV29ybGQ=";
  const decoded = decodeInvoiceData(encoded);

  assert.ok(decoded);
  assert.equal(decoded?.mimeType, "application/pdf");
  assert.equal(new TextDecoder().decode(decoded?.bytes ?? new Uint8Array()), "Hello World");
});
