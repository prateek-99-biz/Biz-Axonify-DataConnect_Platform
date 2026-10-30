/** Checks for the email and password fields on the sign-up, invite and set-password forms. Each returns a message, or null when fine. */
export const MIN_PASSWORD = 10;

export const normalizeEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function emailProblem(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254 ? null : "Enter a valid email address.";
}

const KNOWN_PROBLEMS = new Set([
  "Enter a valid email address.",
  `Use at least ${MIN_PASSWORD} characters.`,
  "Use both letters and numbers.",
  "The two passwords do not match.",
]);

/** A message passed back through the address bar is shown only if it is one of ours, so a crafted link cannot put its own words on the page. */
export const knownProblem = (text: string | null | undefined): string | null => (text && KNOWN_PROBLEMS.has(text) ? text : null);

export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return "Use both letters and numbers.";
  if (password !== confirm) return "The two passwords do not match.";
  return null;
}
