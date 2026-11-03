/** Which of the global filters a page actually reads. Showing the rest would only be controls that do nothing there. */
export interface FilterScope { client: boolean; industry: boolean; period: boolean }

const ALL: FilterScope = { client: true, industry: true, period: true };
const PERIOD_ONLY: FilterScope = { client: false, industry: false, period: true };
const NONE: FilterScope = { client: false, industry: false, period: false };

// Pages that ignore the filters entirely.
const UNFILTERED = ["/settings", "/data-reliability", "/how-it-works", "/metrics"];

/**
 * A client's profile is already one client, and Compare picks its own clients with tick boxes, so both use only the period.
 * A page that is not listed gets every filter, so a new page is never left without them by accident.
 */
export function filterScope(path: string): FilterScope {
  if (UNFILTERED.some((p) => path === p || path.startsWith(p + "/"))) return NONE;
  if (path === "/clients/compare" || path.startsWith("/clients/")) return PERIOD_ONLY;
  return ALL;
}
