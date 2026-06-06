import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const bffUrl = process.env.BFF_URL ?? "http://bff-api:3001";
  const internalSecret = process.env.INTERNAL_SECRET ?? "";

  try {
    const upstream = await fetch(
      `${bffUrl}/api/v1/collect/status/${params.jobId}`,
      {
        headers: { "X-Internal-Secret": internalSecret },
      },
    );
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
