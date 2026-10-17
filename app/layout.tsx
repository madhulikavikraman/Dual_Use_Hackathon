import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Saira } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the VoiceFlare brand (headings on the landing page, /global and the tour).
const saira = Saira({
  variable: "--font-saira",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "VoiceFlare", template: "%s · VoiceFlare" },
  description:
    "Before an automated system wakes a zone, VoiceFlare asks the people at its edge, shows how many phones it will wake, and relays only what a named human approved. Hackathon demo: synthetic residents, simulated sends.",
  applicationName: "VoiceFlare",
};

export const viewport: Viewport = {
  themeColor: "#050505",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${saira.variable} h-full antialiased`}
    >
      {/* Browser extensions (e.g. Grammarly) add attributes to <body>; don't warn about them. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
