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

  const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://127.0.0.1:8001";

  try {
    const upstream = await fetch(`${pythonUrl}/api/v1/collect/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: channelId }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status });
    }
    return NextResponse.json({ jobId: (data as { job_id: string }).job_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
