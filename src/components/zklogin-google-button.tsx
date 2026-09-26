"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { beginGoogleZkLogin } from "@/lib/zklogin/flow";

type Props = {
  label: string;
  busyLabel: string;
  disabled?: boolean;
  variant?: "default" | "outline";
  className?: string;
};

export function ZkLoginGoogleButton({ label, busyLabel, disabled, variant = "outline", className }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className={className}>
      <Button
        type="button"
        variant={variant}
        className="h-11 w-full px-5 sm:w-auto"
        disabled={disabled || busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          beginGoogleZkLogin().catch((reason: Error) => {
            setError(reason.message);
            setBusy(false);
          });
        }}
      >
        {busy ? busyLabel : label}
      </Button>
      {error ? <p className="mt-2 text-sm text-stop">{error}</p> : null}
    </div>
  );
}
