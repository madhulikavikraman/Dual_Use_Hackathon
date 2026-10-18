// Call-screen labels in the eight call languages. The phone page shows English with the caller's
// language underneath on the buttons that matter, so a volunteer and a resident can both use it.

export type LabelKey =
  | "answer" | "decline" | "hold" | "listening" | "typeInstead" | "useVoice" | "send" | "hangUp" | "ended"
  | "line" | "simulated" | "soundCheck" | "typeHere" | "thinking" | "tap" | "silentHint";

const L: Record<string, Partial<Record<LabelKey, string>>> = {
  "en-US": {
    silentHint: "No sound? Turn off Silent mode and turn the volume up.",
    tap: "Tap to talk", answer: "Answer", decline: "Decline", hold: "Hold to talk", listening: "Listening…", typeInstead: "Type instead",
    useVoice: "Use voice", send: "Send", hangUp: "Hang up", ended: "Call ended", line: "Emergency information line",
    simulated: "Demo call", soundCheck: "Sound check. You will hear the call here.", typeHere: "Type your answer",
    thinking: "…",
  },
  "es-US": {
    silentHint: "¿No se oye? Desactive el modo silencio y suba el volumen.",
    tap: "Toque para hablar", answer: "Contestar", decline: "Rechazar", hold: "Mantenga presionado para hablar", listening: "Escuchando…",
    typeInstead: "Escribir", useVoice: "Usar voz", send: "Enviar", hangUp: "Colgar", ended: "Llamada terminada",
    line: "Línea de información de emergencias", simulated: "Llamada de demostración",
    soundCheck: "Prueba de sonido. Aquí escuchará la llamada.", typeHere: "Escriba su respuesta",
  },
  "ko-KR": {
    silentHint: "소리가 안 들리나요? 무음 모드를 끄고 볼륨을 높이세요.",
    tap: "눌러서 말하기", answer: "받기", decline: "거절", hold: "누르고 말하기", listening: "듣는 중…", typeInstead: "입력하기", useVoice: "음성 사용",
    send: "보내기", hangUp: "끊기", ended: "통화 종료", line: "긴급 정보 전화", simulated: "데모 통화",
    soundCheck: "소리 확인입니다. 여기에서 통화를 듣게 됩니다.", typeHere: "답변을 입력하세요",
  },
  "zh-CN": {
    silentHint: "听不到声音？请关闭静音模式并调高音量。",
    tap: "点击说话", answer: "接听", decline: "拒绝", hold: "按住说话", listening: "正在听…", typeInstead: "打字", useVoice: "使用语音",
    send: "发送", hangUp: "挂断", ended: "通话已结束", line: "紧急信息热线", simulated: "演示通话",
    soundCheck: "声音测试。您将在这里听到来电。", typeHere: "请输入您的回答",
  },
  "hi-IN": {
    silentHint: "आवाज़ नहीं आ रही? साइलेंट मोड बंद करें और आवाज़ बढ़ाएँ।",
    tap: "बोलने के लिए टैप करें", answer: "उठाएँ", decline: "अस्वीकार करें", hold: "बोलने के लिए दबाकर रखें", listening: "सुन रहे हैं…", typeInstead: "टाइप करें",
    useVoice: "आवाज़ से बोलें", send: "भेजें", hangUp: "कॉल काटें", ended: "कॉल समाप्त", line: "आपातकालीन सूचना लाइन",
    simulated: "डेमो कॉल", soundCheck: "ध्वनि जाँच। आप कॉल यहाँ सुनेंगे।", typeHere: "अपना जवाब टाइप करें",
  },
  "fr-FR": {
    silentHint: "Pas de son ? Désactivez le mode silencieux et montez le volume.",
    tap: "Touchez pour parler", answer: "Répondre", decline: "Refuser", hold: "Maintenez pour parler", listening: "J’écoute…", typeInstead: "Écrire",
    useVoice: "Utiliser la voix", send: "Envoyer", hangUp: "Raccrocher", ended: "Appel terminé",
    line: "Ligne d’information d’urgence", simulated: "Appel de démonstration", soundCheck: "Test du son. Vous entendrez l’appel ici.",
    typeHere: "Écrivez votre réponse",
  },
  "hy-AM": {
    silentHint: "Ձայն չե՞ք լսում։ Անջատեք լուռ ռեժիմը և բարձրացրեք ձայնը։",
    tap: "Հպեք և խոսեք", answer: "Պատասխանել", decline: "Մերժել", hold: "Սեղմեք և խոսեք", listening: "Լսում եմ…", typeInstead: "Գրել",
    useVoice: "Ձայնով", send: "Ուղարկել", hangUp: "Անջատել", ended: "Զանգն ավարտվեց", line: "Արտակարգ տեղեկատվական գիծ",
    simulated: "Ցուցադրական զանգ", soundCheck: "Ձայնի ստուգում։", typeHere: "Գրեք ձեր պատասխանը",
  },
  "fil-PH": {
    silentHint: "Walang tunog? I-off ang Silent mode at lakasan ang volume.",
    tap: "I-tap para magsalita", answer: "Sagutin", decline: "Tanggihan", hold: "Pindutin para magsalita", listening: "Nakikinig…", typeInstead: "Mag-type",
    useVoice: "Gumamit ng boses", send: "Ipadala", hangUp: "Ibaba", ended: "Natapos ang tawag",
    line: "Linya ng impormasyong pang-emergency", simulated: "Demo na tawag",
    soundCheck: "Pagsusuri ng tunog. Dito mo maririnig ang tawag.", typeHere: "I-type ang iyong sagot",
  },
};

/** English label. */
export function en(key: LabelKey): string {
  return L["en-US"][key] ?? key;
}

/** The label in the call's language, or null when it is English or missing. */
export function native(key: LabelKey, lang: string): string | null {
  if (lang.toLowerCase().startsWith("en")) return null;
  const table = L[lang] ?? L[Object.keys(L).find((k) => k.split("-")[0] === lang.split("-")[0]) ?? ""];
  return table?.[key] ?? null;
}

/** The label in the call's language, falling back to English. */
export function label(key: LabelKey, lang: string): string {
  return native(key, lang) ?? en(key);
}
