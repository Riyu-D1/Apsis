import { NextResponse } from "next/server";
import { getEpic } from "@/lib/nasa";

export async function GET() {
  return NextResponse.json(await getEpic());
}
