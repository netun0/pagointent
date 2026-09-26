import { fetchUserSalt } from "@/lib/zklogin/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jwt?: string };
    const jwt = body.jwt?.trim();
    if (!jwt) return Response.json({ error: "Missing JWT." }, { status: 400 });
    const salt = await fetchUserSalt(jwt);
    return Response.json({ salt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Salt request failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
