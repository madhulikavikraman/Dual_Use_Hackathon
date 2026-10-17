import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { agentModel, anthropic } from "@/lib/anthropic";
import type { CallPurpose } from "@/lib/types";
import { renderPrompt } from "./prompt";
import { toolDefsFor } from "./tools";

// Strict tool schemas are compiled on first use (then cached for a day), which made the first answered call
// take ~13 s in testing. After a scenario reset we send one tiny request per tool set so the first real call
// starts at normal speed. Failures are ignored: this is only a warm-up.

const PURPOSES: CallPurpose[] = ["resident", "inbound", "linked_contact", "sentinel", "canary"];

export async function warmAgent(): Promise<{ purpose: CallPurpose; ms: number; ok: boolean }[]> {
  return Promise.all(
    PURPOSES.map(async (purpose) => {
      const t = Date.now();
      try {
        await anthropic().messages.create({
          model: agentModel(),
          max_tokens: 256,
          system: [{ type: "text", text: renderPrompt({ purpose }), cache_control: { type: "ephemeral" } }],
          tools: toolDefsFor(purpose).map((d) => ({
            name: d.name, description: d.description, input_schema: d.input_schema as Anthropic.Tool.InputSchema, strict: true,
          })),
          messages: [{ role: "user", content: "[Warm-up request. Reply with one word: ready.]" }],
          output_config: { effort: "low" },
        });
        return { purpose, ms: Date.now() - t, ok: true };
      } catch {
        return { purpose, ms: Date.now() - t, ok: false };
      }
    }),
  );
}
