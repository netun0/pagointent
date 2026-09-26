import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-outfit",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "PagoIntent — autonomous payments, only when the terms are true",
  description:
    "A programmable obligation layer for agentic commerce on Sui. Lock funds, and release them only when the merchant, price, destination, and proof of delivery all hold.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
          <Shell>{children}</Shell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
