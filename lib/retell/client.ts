import "server-only";

// Retell AI client (owned by the Retell lane). The engine's dispatcher calls placeRetellCall for
// volunteer devices with a phone number when RETELL_API_KEY is set. Signature is fixed.

export interface PlaceRetellCallInput {
  call_id: string; // our call id; send it as metadata.call_id so webhooks and tools map back
  to_number: string; // E.164
  lang_code: string; // picks the Retell agent for that language (falls back to English)
  dynamic_variables: Record<string, string>;
}

export async function placeRetellCall(input: PlaceRetellCallInput): Promise<{ retell_call_id: string }> {
  void input;
  throw new Error("placeRetellCall: not implemented yet");
}
