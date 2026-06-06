import { NextRequest, NextResponse } from "next/server";

const BFF = process.env.BFF_URL ?? "http://bff-api:3001";
const SECRET = process.env.INTERNAL_SECRET ?? "";
const headers = () => ({ "Content-Type": "application/json", "X-Internal-Secret": SECRET });

export async function GET() {
  try {
    const res = await fetch(`${BFF}/api/v1/channels`, { headers: headers() });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BFF}/api/v1/channels`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
