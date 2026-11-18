import { NextResponse } from "next/server";
import { getIss } from "@/lib/nasa";

export const revalidate = 20;

export async function GET() {
  return NextResponse.json(await getIss());
}
