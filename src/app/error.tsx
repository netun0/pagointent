"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/context";

export default function ErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  const { messages } = useI18n();
  return (
    <div className="max-w-lg">
      <h1 className="text-4xl font-semibold tracking-tight">{messages.error.title}</h1>
      <p className="mt-2 text-muted-foreground">{error.message}</p>
      <Button className="mt-4" onClick={reset}>
        {messages.error.retry}
      </Button>
    </div>
  );
}
