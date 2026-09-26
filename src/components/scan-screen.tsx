"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function pathFromScan(text: string) {
  try {
    const url = new URL(text, window.location.origin);
    if (url.pathname.startsWith("/i/")) return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
  if (text.startsWith("/i/")) return text;
  return null;
}

export function ScanScreen() {
  const router = useRouter();
  const region = useRef<HTMLDivElement>(null);
  const [paste, setPaste] = useState("");
  const [camera, setCamera] = useState<"idle" | "on" | "denied">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (camera !== "on" || !region.current) return;
    let scanner: { stop: () => Promise<void> } | null = null;
    let stopped = false;
    const host = region.current;
    host.id = "intenses-qr";
    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (stopped) return;
      const instance = new Html5Qrcode(host.id);
      scanner = instance;
      try {
        await instance.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            const next = pathFromScan(decoded);
            if (!next) return;
            instance.stop().catch(() => undefined);
            router.push(next);
          },
          () => undefined,
        );
      } catch {
        if (!stopped) setCamera("denied");
      }
    });
    return () => {
      stopped = true;
      scanner?.stop().catch(() => undefined);
    };
  }, [camera, router]);

  function openPasted(event: React.FormEvent) {
    event.preventDefault();
    const next = pathFromScan(paste.trim());
    if (!next) {
      setError("Paste the full Intenses link, the one that starts with the site and /i/.");
      return;
    }
    router.push(next);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-serif text-4xl tracking-tight">Scan an intent</h1>
      <p className="mt-2 text-muted-foreground">
        The code is the claim. Opening it shows the amount, the reason, and the date. Nothing moves until you accept.
      </p>
      <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
        <div ref={region} className="min-h-64 bg-[#1c1612]" />
      </div>
      {camera === "denied" ? (
        <p className="mt-3 text-sm text-[#9a3b28]">The camera stayed closed. Paste the link instead.</p>
      ) : null}
      {camera !== "on" ? (
        <Button className="mt-4 h-11 rounded-full px-5" onClick={() => setCamera("on")}>
          Use the camera
        </Button>
      ) : null}
      <form onSubmit={openPasted} className="mt-8 space-y-3">
        <Label htmlFor="link">Or paste the link</Label>
        <Input id="link" className="h-11 bg-card px-3" placeholder="https://…/i/0x…?k=…" value={paste} onChange={(event) => setPaste(event.target.value)} />
        <Button type="submit" variant="outline" className="h-11 bg-card">
          Open the intent
        </Button>
        {error ? <p className="text-sm text-[#9a3b28]">{error}</p> : null}
      </form>
    </div>
  );
}
