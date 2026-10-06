import type { Metadata } from "next";
import { Caveat, Fraunces } from "next/font/google";
import { InlineScript } from "@/components/InlineScript";
import { THEME_BOOT_SCRIPT } from "@/lib/preferences-core";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HIBITAT",
  description: "Every memory is connected to someone.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets data-theme before React hydrates, so the attribute differs by design.
    <html lang="en" className={`${fraunces.variable} ${caveat.variable}`} data-theme="dark" suppressHydrationWarning>
      <head>
        <InlineScript html={THEME_BOOT_SCRIPT} />
      </head>
      <body>{children}</body>
    </html>
  );
}
