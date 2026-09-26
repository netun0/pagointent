"use client";

import { Button } from "@/components/ui/button";

export default function ErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-4xl">This screen hit a snag.</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
