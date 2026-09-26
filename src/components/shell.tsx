"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { LanguageSelect, useI18n } from "@/i18n/context";
import { getStatus } from "@/lib/actions";
import type { ChainStatus } from "@/lib/sui/types";
import { cn } from "@/lib/utils";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { messages, t } = useI18n();
  const [status, setStatus] = useState<ChainStatus | null>(null);

  const links = [
    { href: "/compose", label: messages.nav.compose },
    { href: "/obligations", label: messages.nav.obligations },
    { href: "/merchants", label: messages.nav.merchants },
    { href: "/desk", label: messages.nav.desk },
  ];

  useEffect(() => {
    getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  return (
    <div className="relative z-10 flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b12]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-semibold tracking-tight sm:gap-2.5">
            <Logo size={40} alt="PagoIntent" />
            <span className="hidden truncate text-[#3dffc8] sm:inline">PagoIntent</span>
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground",
                    active && "bg-[#3dffc8]/10 text-[#7af7e2] shadow-[inset_0_0_0_1px_rgba(61,255,200,0.35)]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3 text-xs">
            <LanguageSelect />
            <Link
              href="/wallet"
              className="font-mono uppercase tracking-[0.14em] text-muted-foreground hover:text-[#7af7e2]"
            >
              {messages.nav.keys}
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</div>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-24 font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground md:pb-8">
        {messages.shell.footer}
        {status?.referenceGasPrice ? ` ${t(messages.shell.refGas, { rgp: status.referenceGasPrice })}` : ""}
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#070b12]/90 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-4">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-1 py-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground",
                  active && "text-[#7af7e2]",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
