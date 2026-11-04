import type { AccountInput } from "./salesforce-accounts";

/** Every made-up row carries this prefix on its Salesforce account ID, so the sample data can be told apart and removed without touching real rows. */
export const SAMPLE_PREFIX = "MOCK-SF-";
export const isSampleId = (id: string | null | undefined) => !!id && id.startsWith(SAMPLE_PREFIX);

// Four CSMs, so 16 clients give each of them four. The .invalid addresses can never receive mail or match a real sign-in.
const CSMS = [
  { name: "Sarah K.", email: "sarah.k@sample.invalid" },
  { name: "Mohamed R.", email: "mohamed.r@sample.invalid" },
  { name: "Ahmed L.", email: "ahmed.l@sample.invalid" },
  { name: "Claire M.", email: "claire.m@sample.invalid" },
];
const INDUSTRIES = ["Retail", "Aviation", "Banking", "Healthcare", "Automotive", "Hospitality", "Logistics", "Education"];
const REGIONS = ["UAE", "KSA", "Qatar", "Oman"];
// Industries guessed from the client's name, so the sample data does not call an airline a school. Anything unmatched cycles through INDUSTRIES.
const HINTS: [RegExp, string][] = [
  [/emirates|etihad|fly|airline|airways|aviation/i, "Aviation"],
  [/adidas|chalhoub|retail|mall|store|fashion/i, "Retail"],
  [/boehringer|pharma|med|health|clinic|hospital|pmeclix/i, "Healthcare"],
  [/bank|cbuae|finance|insur/i, "Banking"],
  [/^gm$|motor|auto/i, "Automotive"],
  [/learn|edu|school|academy|tira/i, "Education"],
];
const industryFor = (name: string, i: number) => HINTS.find(([re]) => re.test(name))?.[1] ?? INDUSTRIES[i % INDUSTRIES.length];

// Licences are a little above the registered users, as a real contract would be.
const HEADROOM = [1.05, 1.15, 1.3, 1.5];
const LICENCES = [800, 500, 350, 1200, 250, 2000, 600, 450, 900, 300, 1500, 700, 400, 1000, 550, 280];
const RENEWAL_IN_DAYS = [18, 34, 52, 71, 88, 104, 126, 150, 175, 205, 240, 270, 300, 330, 355, 390];

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Made-up Salesforce rows for the given clients: CSMs, industry, region, licences, value and renewal dates spread over the next
 * year, so the internal pages have something to show. Deterministic for a given list and day, and always valid for the importer.
 */
export function buildSampleAccounts(clients: { id: string; name: string; users?: number }[], today: string): AccountInput[] {
  return clients.map((c, i) => {
    const csm = CSMS[i % CSMS.length];
    const licenses = c.users ? Math.max(50, Math.ceil((c.users * HEADROOM[i % HEADROOM.length]) / 10) * 10) : LICENCES[i % LICENCES.length];
    const currency = i % 3 === 2 ? "AED" : "USD";
    const perLicence = 12 + (i % 5) * 1.5;
    const renewalDate = addDays(today, RENEWAL_IN_DAYS[(i * 5) % RENEWAL_IN_DAYS.length]);
    return {
      clientId: c.id,
      salesforceAccountId: `${SAMPLE_PREFIX}${String(i + 1).padStart(3, "0")}`,
      industry: industryFor(c.name, i),
      region: REGIONS[i % REGIONS.length],
      csmName: csm.name,
      csmEmail: csm.email,
      licenses,
      licenseValue: Math.round(licenses * perLicence * (currency === "AED" ? 3.67 : 1)),
      currency,
      contractStart: addDays(renewalDate, i % 2 === 0 ? -365 : -730),
      renewalDate,
    };
  });
}
