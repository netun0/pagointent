"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { getStatus } from "@/lib/actions";
import type { ChainStatus } from "@/lib/sui/types";
import { cn } from "cn";

const links = [
  { href: "/compose", label: "Compose" },
  { href: "/obligations", label: "Obligations" },
  { href: "/merchants", label: "Merchants" },
  { href: "/desk", label: "Desk" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<ChainStatus | null>(null);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const live = status && status.mode !== "local";

  return (
    <div className="relative z-10 flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b12]/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 text-sm font-semibold tracking-tight">
            <Logo size={44} alt="PagoIntent" />
            <span className="truncate">PagoIntent</span>
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
          <div className="ml-auto flex shrink-0 items-center gap-2 text-xs sm:gap-3">
            <Link href="/wallet" className="font-mono uppercase tracking-[0.14em] text-muted-foreground hover:text-[#7af7e2]">
              Keys
            </Link>
            <span
              title={status ? (live ? `Sui ${status.mode}` : status.rpcError || "Sui offline") : "Checking Sui"}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono uppercase tracking-[0.12em]",
                live ? "border-[#3dffc8]/40 text-[#7af7e2]" : "border-white/10 text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", live ? "bg-[#3dffc8] shadow-[0_0_8px_#3dffc8]" : "bg-muted-foreground")} />
              <span className="hidden sm:inline">
                {status ? (live ? `Sui ${status.mode}` : "Sui offline") : "Checking Sui…"}
              </span>
            </span>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</div>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-24 font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground md:pb-8">
        PagoIntent decides whether an agent is allowed to pay.
        Settlement is test USDC on Sui. The obligation is denominated in yen at a rate frozen in the object.
        {status?.referenceGasPrice ? ` Reference gas ${status.referenceGasPrice} MIST.` : ""}
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
