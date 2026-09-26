"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStatus } from "@/lib/actions";
import type { ChainStatus } from "@/lib/sui/types";
import { cn } from "cn";

const links = [
  { href: "/pay", label: "Pay" },
  { href: "/scan", label: "Scan" },
  { href: "/wallet", label: "Wallet" },
  { href: "/learn", label: "Learn" },
  { href: "/market", label: "Market" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<ChainStatus | null>(null);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const live = status && status.mode !== "local";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="font-serif text-2xl tracking-tight">
            Intenses
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                  pathname.startsWith(link.href) && "bg-card text-foreground shadow-sm",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className={cn("rounded-full border px-2.5 py-1", live ? "border-emerald-700/30 text-emerald-800" : "text-muted-foreground")}>
              {status ? (live ? `Sui ${status.mode}` : "Preview ledger") : "Checking Sui…"}
            </span>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">{children}</div>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-24 text-sm text-muted-foreground md:pb-8">
        Built for the ETHGlobal Sui track. The USDC here is a test coin with 6 decimals, not Circle’s dollar.
        {status?.referenceGasPrice ? ` Reference gas is ${status.referenceGasPrice} MIST.` : ""}
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-1 py-3 text-center text-xs text-muted-foreground",
                pathname.startsWith(link.href) && "text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
