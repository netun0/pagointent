import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const sans = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-face",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  title: "PagoIntent — autonomous payments, only when the terms are true",
  description:
    "A programmable obligation layer for agentic commerce on Sui. Lock funds, and release them only when the merchant, price, destination, and proof of delivery all hold.",
  openGraph: {
    title: "PagoIntent — autonomous payments, only when the terms are true",
    description:
      "A programmable obligation layer for agentic commerce on Sui. Lock funds, and release them only when the merchant, price, destination, and proof of delivery all hold.",
    images: [{ url: "/pagointent-mark.jpg", width: 1024, height: 1024, alt: "PagoIntent" }],
  },
  twitter: {
    card: "summary",
    images: ["/pagointent-mark.jpg"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Shell>{children}</Shell>
        <Toaster />
      </body>
    </html>
  );
}
