import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** mock = synthetic dev data; synced = daily-synced summaries stored in Postgres */
  DATA_ADAPTER: z.enum(["mock", "synced"]).default("mock"),
  AUTH_DEV_LOGIN: z.string().optional(),
  BQ_PROJECT_ID: z.string().optional(),
  BQ_DATASET: z.string().optional(),
  /** Comma-separated Axonify tenant ids to sync (the accounts the dashboards cover). */
  BQ_TENANT_IDS: z.string().optional(),
  BQ_MAPPING_FILE: z.string().default("config/bigquery-mapping.json"),
});

export type Env = z.infer<typeof schema>;

/** Validated lazily so `next build` does not need runtime secrets. */
export function getEnv(): Env {
  const env = schema.parse(process.env);
  if (env.NODE_ENV === "production" && env.DATA_ADAPTER === "mock") {
    throw new Error("DATA_ADAPTER=mock is not permitted in production. Use DATA_ADAPTER=synced.");
  }
  return env;
}

export const devLoginEnabled = () =>
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_LOGIN === "true";
