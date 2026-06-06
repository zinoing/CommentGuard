import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const pythonUrl = process.env.PYTHON_SERVICE_URL ?? "http://127.0.0.1:8001";

  try {
    const upstream = await fetch(
      `${pythonUrl}/api/v1/collect/status/${params.jobId}`,
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
