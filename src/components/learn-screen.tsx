"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mintBadge } from "@/lib/actions";
import { decryptKey, readVault, useLessons, writeLessons } from "@/lib/custody";
import { lessons } from "@/lib/lessons";
import { cn } from "cn";

export function LearnScreen() {
  const done = useLessons();
  const [open, setOpen] = useState(lessons[0].id);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<string | null>(null);

  function complete(id: string) {
    writeLessons(Array.from(new Set([...done, id])));
  }

  const finished = done.length >= lessons.length;

  async function mint(event: React.FormEvent) {
    event.preventDefault();
    const vault = readVault();
    if (!vault) {
      setError("Accept a payment first so there is an address to receive the badge.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const secret = await decryptKey(password, vault);
      const receipt = await mintBadge(secret);
      setBadge(receipt.badgeId ?? receipt.digest);
      toast.success("Learner badge minted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not mint the badge.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm uppercase tracking-[0.16em] text-[#9a3b28]">Free, on purpose</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">Learn the wallet you just got</h1>
      <p className="mt-2 text-muted-foreground">
        Five short lessons. When you finish, Intenses mints a learner badge to your Sui address. Nothing here is a
        substitute for reading the transaction yourself.
      </p>
      <div className="mt-6 space-y-3">
        {lessons.map((lesson, index) => {
          const completeAlready = done.includes(lesson.id);
          const expanded = open === lesson.id;
          return (
            <article key={lesson.id} className="rounded-2xl border bg-card">
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 px-4 py-4 text-left"
                onClick={() => setOpen(expanded ? "" : lesson.id)}
              >
                <span>
                  <span className="text-sm text-muted-foreground">{index + 1}</span>
                  <span className="ml-3 font-medium">{lesson.title}</span>
                </span>
                <span className={cn("text-xs", completeAlready ? "text-emerald-800" : "text-muted-foreground")}>
                  {completeAlready ? "Read" : `${lesson.minutes} min`}
                </span>
              </button>
              {expanded ? (
                <div className="space-y-3 px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {lesson.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {!completeAlready ? (
                    <Button type="button" variant="secondary" onClick={() => complete(lesson.id)}>
                      I’ve read this
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      <section className="mt-8 rounded-2xl border bg-card p-5">
        <h2 className="font-serif text-2xl">Learner badge</h2>
        {badge ? (
          <p className="mt-2 text-sm text-muted-foreground">Minted. The badge object is {badge}.</p>
        ) : finished ? (
          <form onSubmit={mint} className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">Unlock the payee wallet. You sign the mint. The badge cannot be transferred.</p>
            <Label htmlFor="badge-password">Password</Label>
            <Input id="badge-password" type="password" className="h-11 bg-background px-3" value={password} onChange={(event) => setPassword(event.target.value)} />
            <Button className="h-11 rounded-full px-5" disabled={busy}>
              {busy ? "Minting…" : "Mint the badge"}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{lessons.length - done.length} lessons left before the badge will mint.</p>
        )}
        {error ? <p className="mt-3 text-sm text-[#9a3b28]">{error}</p> : null}
      </section>
    </div>
  );
}
