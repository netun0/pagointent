import { fetchZkProof } from "@/lib/zklogin/server";
import { chainMode } from "@/lib/sui/config";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const mode = chainMode();
    if (mode === "local") return Response.json({ error: "Sui is not configured." }, { status: 503 });

    const body = (await request.json()) as {
      jwt?: string;
      extendedEphemeralPublicKey?: string;
      maxEpoch?: number;
      jwtRandomness?: string;
      salt?: string;
    };

    const jwt = body.jwt?.trim();
    const extendedEphemeralPublicKey = body.extendedEphemeralPublicKey?.trim();
    const jwtRandomness = body.jwtRandomness?.trim();
    const salt = body.salt?.trim();
    const maxEpoch = body.maxEpoch;

    if (!jwt || !extendedEphemeralPublicKey || !jwtRandomness || !salt || !maxEpoch) {
      return Response.json({ error: "Missing zkLogin proof parameters." }, { status: 400 });
    }

    const proof = await fetchZkProof(mode, {
      jwt,
      extendedEphemeralPublicKey,
      maxEpoch,
      jwtRandomness,
      salt,
      keyClaimName: "sub",
    });

    return Response.json(proof);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proof request failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
