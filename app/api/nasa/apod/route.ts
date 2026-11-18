import { NextResponse } from "next/server";
import { getApod } from "@/lib/nasa";

export async function GET() {
  return NextResponse.json(await getApod());
}
