import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (client) return client;
  // Short timeout + one retry: an in-call turn that hangs is worse than one that fails fast.
  client = new Anthropic({ apiKey: serverEnv().ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 });
  return client;
}

export const agentModel = () => serverEnv().AGENT_MODEL;
export const analysisModel = () => serverEnv().ANALYSIS_MODEL;
