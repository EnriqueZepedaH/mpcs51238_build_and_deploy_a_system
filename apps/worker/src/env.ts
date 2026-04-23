import { z } from "zod";

const workerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TWELVE_DATA_API_KEY: z.string().min(1),
  TWELVE_DATA_BASE_URL: z.string().url().default("https://api.twelvedata.com"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(900_000),
  MAX_SYMBOLS_PER_RUN: z.coerce.number().int().positive().default(8),
  FRESHNESS_TARGET_SECONDS: z.coerce.number().int().positive().default(1800)
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function getWorkerEnv(): WorkerEnv {
  return workerEnvSchema.parse(process.env);
}

