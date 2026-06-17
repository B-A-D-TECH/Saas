export async function ping() {
  // Minimal repository stub. Replace with real DB check when migrating.
  try {
    // For now return a synthetic OK to avoid touching DB
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
