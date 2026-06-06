import { NextRequest, NextResponse } from "next/server";

const BFF = process.env.BFF_URL ?? "http://bff-api:3001";
const SECRET = process.env.INTERNAL_SECRET ?? "";
const headers = () => ({ "Content-Type": "application/json", "X-Internal-Secret": SECRET });

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const res = await fetch(`${BFF}/api/v1/channels/invite/${params.token}`, {
      headers: headers(),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const body = await request.json();
    const res = await fetch(`${BFF}/api/v1/channels/invite/${params.token}/accept`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
