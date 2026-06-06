// DEV ONLY — remove before GA
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(null, { status: 404 });
  }

  const BFF = process.env.BFF_URL ?? "http://bff-api:3001";
  const SECRET = process.env.INTERNAL_SECRET ?? "";

  try {
    const body = await request.json();
    const res = await fetch(`${BFF}/api/dev/channel-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": SECRET },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
