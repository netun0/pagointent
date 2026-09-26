import { Suspense } from "react";
import { IntentScreen } from "@/components/intent-screen";

export default function IntentPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Opening the intent…</p>}>
      <IntentScreen />
    </Suspense>
  );
}
