import "server-only";

/**
 * Writes the real reason an account action failed to the server log. The pages show the same short message for every
 * failure on purpose, so without this there is nothing to diagnose from. No email address or password is logged.
 */
export function logAuthError(action: string, error: { message?: string; status?: number; code?: string }) {
  console.error(`[auth] ${action} failed: ${error.message ?? "unknown error"} (status ${error.status ?? "n/a"}, code ${error.code ?? "n/a"})`);
}
