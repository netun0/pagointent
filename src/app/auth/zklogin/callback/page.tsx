"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { fundAddress } from "@/lib/actions";
import { emitCustodyChange } from "@/lib/custody";
import { completeGoogleZkLogin } from "@/lib/zklogin/flow";

function idTokenFromLocation() {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const fromHash = hash.get("id_token");
  if (fromHash) return fromHash;
  const query = new URLSearchParams(window.location.search);
  return query.get("id_token");
}

export default function ZkLoginCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idToken = idTokenFromLocation();
    if (!idToken) {
      setError("Google did not return an id_token. Check the OAuth redirect URI.");
      return;
    }

    let cancelled = false;
    completeGoogleZkLogin(idToken)
      .then((session) => fundAddress(session.address).catch(() => null))
      .then(() => {
        if (cancelled) return;
        emitCustodyChange();
        router.replace("/compose");
      })
      .catch((reason: Error) => {
        if (cancelled) return;
        setError(reason.message);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-semibold tracking-tight">zkLogin could not finish</h1>
        <p className="mt-2 text-sm text-stop">{error}</p>
        <Button asChild className="mt-4">
          <Link href="/compose">Back to Compose</Link>
        </Button>
      </div>
    );
  }

  return <p className="text-muted-foreground">Finishing Google zkLogin…</p>;
}
