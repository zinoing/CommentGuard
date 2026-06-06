import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: { channelId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { channelId } = body;
  if (!channelId || typeof channelId !== "string") {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const bffUrl = process.env.BFF_URL ?? "http://bff-api:3001";
  const internalSecret = process.env.INTERNAL_SECRET ?? "";

  try {
    const upstream = await fetch(`${bffUrl}/api/v1/collect/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": internalSecret,
      },
      body: JSON.stringify({ channelId }),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
