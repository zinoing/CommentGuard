// DEV ONLY — remove before GA
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  // localhost resolves to ::1 on this host; Python service listens on 127.0.0.1 only
  const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://127.0.0.1:8001";

  try {
    const upstream = await fetch(`${pythonUrl}/dev/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: channelId }),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
