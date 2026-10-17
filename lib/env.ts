import { z } from "zod";

// Server-only env. Import from route handlers / server code, never from client components.
// Only the Anthropic key is required. Supabase and Retell are optional: without Supabase the app
// stores data in a local file (fine for one laptop running the demo); without Retell, calls go to
// the browser phone page and the simulator.
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));
/** Empty env lines (FOO=) count as unset, so defaults apply. */
const blankToUndefined = (v: unknown) => (typeof v === "string" && !v.trim() ? undefined : v);

const serverSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  AGENT_MODEL: z.preprocess(blankToUndefined, z.string().default("claude-haiku-5-5")),
  ANALYSIS_MODEL: z.preprocess(blankToUndefined, z.string().default("claude-sonnet-5-5")),
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  /** "local" forces the file store even when Supabase is configured. */
  STORAGE: z.preprocess(blankToUndefined, z.enum(["auto", "local", "supabase"]).default("auto")),
  APP_BASE_URL: optionalString,
  // Retell AI (phone-network transport). All optional.
  RETELL_API_KEY: optionalString,
  RETELL_FROM_NUMBER: optionalString, // E.164 number bought in Retell
  RETELL_AGENT_ID_EN: optionalString,
  RETELL_AGENT_ID_ES: optionalString,
  RETELL_AGENT_ID_KO: optionalString,
  RETELL_AGENT_ID_ZH: optionalString,
  RETELL_AGENT_ID_HI: optionalString,
  RETELL_AGENT_ID_FR: optionalString,
  // Volunteer phone numbers for the six demo devices (E.164). Optional.
  DEVICE_PHONE_1: optionalString,
  DEVICE_PHONE_2: optionalString,
  DEVICE_PHONE_3: optionalString,
  DEVICE_PHONE_4: optionalString,
  DEVICE_PHONE_5: optionalString,
  DEVICE_PHONE_6: optionalString,
  // Feeds and integrations.
  FEED_TOKEN: z.preprocess(blankToUndefined, z.string().default("demo")),
  ARCGIS_API_KEY: optionalString,
  NASA_FIRMS_MAP_KEY: optionalString,
  SUPERVISOR_NAME: z.preprocess(blankToUndefined, z.string().default("Overnight supervisor")),
  CALLBACK_NUMBER: z.preprocess(blankToUndefined, z.string().default("(213) 555-0142")),
  VERIFICATION_PHRASE: z.preprocess(blankToUndefined, z.string().default("blue heron")),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Like serverEnv() but returns the list of problems instead of throwing (for /api/health). */
export function checkEnv(): string[] {
  const parsed = serverSchema.safeParse(process.env);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

/** Which data store the server uses. */
export function storageBackend(): "supabase" | "local" {
  const env = serverEnv();
  if (env.STORAGE === "local") return "local";
  const hasSupabase = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
  if (env.STORAGE === "supabase" && !hasSupabase) {
    throw new Error("STORAGE=supabase but NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }
  return hasSupabase ? "supabase" : "local";
}

/** True when the Retell transport can place real phone calls. */
export function retellEnabled(): boolean {
  const env = serverEnv();
  return Boolean(env.RETELL_API_KEY && env.RETELL_FROM_NUMBER && env.RETELL_AGENT_ID_EN);
}

// Public env, inlined at build time. Next only inlines direct `process.env.NEXT_PUBLIC_*` reads.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
