import {
  agentAct,
  act,
  bootstrap,
  buildTransaction,
  cosign,
  getBalances,
  getObligation,
  getStatus,
  listDesks,
  listObligations,
  prepareSponsored,
  submitTransaction,
  verifyMerchant,
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
    if (op === "obligations") return Response.json({ obligations: await listObligations() });
    if (op === "obligation") return Response.json({ obligation: await getObligation(url.searchParams.get("id") ?? "") });
    if (op === "desks") return Response.json(await listDesks());
    if (op === "balance") return Response.json(await getBalances(url.searchParams.get("owner") ?? ""));
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
    if (op === "build") return Response.json(await buildTransaction(body as never));
    if (op === "submit") return Response.json(await submitTransaction(String(body.bytes ?? ""), String(body.signature ?? "")));
    if (op === "prepare") return Response.json(await prepareSponsored(body as never));
    if (op === "cosign") return Response.json(await cosign(String(body.bytes ?? ""), String(body.signature ?? "")));
    if (op === "verify") return Response.json(await verifyMerchant(String(body.merchant ?? ""), String(body.merchantName ?? "")));
    if (op === "agent") return Response.json(await agentAct(body as never));
    if (op === "act") return Response.json(await act(body as never));
    return fail("Unknown action.", 404);
  } catch (error) {
    return fail(error);
  }
}
