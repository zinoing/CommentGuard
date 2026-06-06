import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const BFF = process.env.BFF_URL ?? "http://bff-api:3001";
const SECRET = process.env.INTERNAL_SECRET ?? "";

export async function GET(_req: NextRequest) {
  const channelId = (await cookies()).get("cg_channel_id")?.value;
  if (!channelId) {
    return NextResponse.json({ error: "No channel selected" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BFF}/api/v1/collect/history?channelId=${encodeURIComponent(channelId)}`,
      { headers: { "X-Internal-Secret": SECRET } },
    );
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
