import "server-only";
import type { ToolName } from "@/lib/agent/tools";
import type { CallVars } from "@/lib/types";

// Call lifecycle and the shared tool executor (owned by the engine lane).
// Signatures are fixed; the Retell lane imports executeTool and startInboundCall.

export interface ToolResult {
  /** Text returned to the model as the tool result (Claude tool_result or Retell function response). */
  result: string;
  /** The tool ended the call (end_call). */
  end?: boolean;
}

/** Run one of the seven tools for a call. Validates input, writes rows, logs refusals. */
export async function executeTool(callId: string, name: ToolName, args: Record<string, unknown>): Promise<ToolResult> {
  void callId; void name; void args;
  throw new Error("executeTool: not implemented yet");
}

/** A call arriving on the public line (Retell inbound or the browser /call page). */
export async function startInboundCall(input: {
  from_number: string | null;
  transport: "retell" | "browser";
  retell_call_id?: string | null;
  lang_code?: string | null;
}): Promise<{ call_id: string; vars: CallVars }> {
  void input;
  throw new Error("startInboundCall: not implemented yet");
}
