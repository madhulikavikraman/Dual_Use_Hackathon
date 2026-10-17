import type { Metadata } from "next";
import DeviceSheet from "@/components/phone/DeviceSheet";

// /phones — the device sheet: QR codes for the volunteers' phones, who each plays, live presence.

export const metadata: Metadata = {
  title: "Device sheet · VoiceFlare",
  description: "QR codes and live presence for the volunteer phones in the VoiceFlare demo.",
};

export default function PhonesPage() {
  return (
    <div className="flex min-h-dvh w-full flex-1 flex-col bg-slate-100 text-slate-900 print:bg-white">
      <DeviceSheet />
    </div>
  );
}
