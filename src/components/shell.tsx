"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/" className="text-sm font-medium tracking-tight">
            PagoIntent
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                  (pathname === link.href || pathname.startsWith(`${link.href}/`)) && "bg-card text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs">
            <Link href="/wallet" className="text-muted-foreground hover:text-foreground">
              Keys
            </Link>
            <span className={cn("rounded-md border px-2 py-1", live ? "border-emerald-800/30 text-emerald-900" : "text-muted-foreground")}>
              {status ? (live ? `Sui ${status.mode}` : "Preview ledger") : "Checking Sui…"}
            </span>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">{children}</div>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-24 text-sm text-muted-foreground md:pb-8">
        Orbital moves money. Yodl pays a merchant who already has a local rail. PagoIntent decides whether an agent is allowed to pay.
        Settlement is test USDC on Sui, not Circle’s dollar. The obligation is denominated in yen at a rate frozen in the object.
        {status?.referenceGasPrice ? ` Reference gas is ${status.referenceGasPrice} MIST.` : ""}
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-1 py-3 text-center text-xs text-muted-foreground",
                (pathname === link.href || pathname.startsWith(`${link.href}/`)) && "text-foreground",
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
