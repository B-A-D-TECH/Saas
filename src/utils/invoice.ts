export function decodeInvoiceData(invoiceData: string | null | undefined): { mimeType: string; bytes: Uint8Array } | null {
  if (!invoiceData) return null;

  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(invoiceData);
  if (!match) return null;

  const mimeType = match[1] ? match[1] : "application/octet-stream";
  const base64 = match[2];

  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { mimeType, bytes };
  } catch {
    return null;
  }
}

export function downloadInvoice(invoiceData: string | null | undefined, fileName: string | null | undefined): void {
  if (typeof window === "undefined") return;

  const decoded = decodeInvoiceData(invoiceData);
  if (!decoded) return;

  const blob = new Blob([decoded.bytes], { type: decoded.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName?.trim() || "facture.pdf";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function toInvoiceDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Impossible de lire la facture"));
    };
    reader.onerror = () => reject(new Error("Impossible de lire la facture"));
    reader.readAsDataURL(file);
  });
}
