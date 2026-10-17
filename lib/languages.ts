// Supported call languages. One list for the agent prompt, the browser phone's speech engines,
// the Retell agent per language, and the roster. Safe on server and client.

export interface LanguageInfo {
  code: string; // BCP-47, also the browser SpeechRecognition / SpeechSynthesis lang
  name: string; // English name, as stored on households.language
  native: string; // how the agent greets in that language
  retellEnv: string | null; // env var holding the Retell agent id for this language
  voice: "good" | "thin"; // thin: prefer text mode or SMS (PRD D-15)
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en-US", name: "English", native: "English", retellEnv: "RETELL_AGENT_ID_EN", voice: "good" },
  { code: "es-US", name: "Spanish", native: "Español", retellEnv: "RETELL_AGENT_ID_ES", voice: "good" },
  { code: "ko-KR", name: "Korean", native: "한국어", retellEnv: "RETELL_AGENT_ID_KO", voice: "good" },
  { code: "zh-CN", name: "Chinese (Mandarin)", native: "中文", retellEnv: "RETELL_AGENT_ID_ZH", voice: "good" },
  { code: "hi-IN", name: "Hindi", native: "हिन्दी", retellEnv: "RETELL_AGENT_ID_HI", voice: "good" },
  { code: "fr-FR", name: "French", native: "Français", retellEnv: "RETELL_AGENT_ID_FR", voice: "good" },
  { code: "hy-AM", name: "Armenian", native: "Հայերեն", retellEnv: null, voice: "thin" },
  { code: "fil-PH", name: "Tagalog", native: "Tagalog", retellEnv: null, voice: "thin" },
];

export function languageByCode(code: string | null | undefined): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export function languageByName(name: string | null | undefined): LanguageInfo {
  return LANGUAGES.find((l) => l.name === name) ?? LANGUAGES[0];
}
