import {
  acceptIntent,
  act,
  bootstrap,
  buildTransaction,
  getBalances,
  getIntent,
  getStatus,
  listActivity,
  listIntents,
  listListings,
  submitTransaction,
} from "@/lib/sui/service";

export const dynamic = "force-dynamic";

function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Request failed.";
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const op = url.searchParams.get("op");
  try {
    if (op === "status") return Response.json(await getStatus());
    if (op === "intents") return Response.json({ intents: await listIntents() });
    if (op === "intent") return Response.json({ intent: await getIntent(url.searchParams.get("id") ?? "") });
    if (op === "listings") return Response.json({ listings: await listListings() });
    if (op === "balance") return Response.json(await getBalances(url.searchParams.get("owner") ?? ""));
    if (op === "activity") return Response.json({ activity: await listActivity(url.searchParams.get("owner") ?? "") });
    return fail("Unknown read.", 404);
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const op = body.op;
    if (op === "bootstrap") return Response.json(await bootstrap(String(body.address ?? "")));
    if (op === "accept") {
      return Response.json(
        await acceptIntent({
          intentId: String(body.intentId ?? ""),
          secretHex: String(body.secretHex ?? ""),
          payee: String(body.payee ?? ""),
        }),
      );
    }
    if (op === "build") return Response.json(await buildTransaction(body as never));
    if (op === "submit") return Response.json(await submitTransaction(String(body.bytes ?? ""), String(body.signature ?? "")));
    if (op === "act") return Response.json(await act(body as never));
    return fail("Unknown action.", 404);
  } catch (error) {
    return fail(error);
  }
}
