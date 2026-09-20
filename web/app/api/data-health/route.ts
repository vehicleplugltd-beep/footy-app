import { NextResponse } from "next/server";
import { getFootyDataHealth } from "@/lib/data-health";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getFootyDataHealth(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
