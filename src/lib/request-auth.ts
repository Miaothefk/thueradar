import { NextRequest } from "next/server";
import { getUserBySessionToken } from "@/lib/auth";

export async function getRequestUser(request: NextRequest) {
  const token = request.cookies.get("thueradar_session")?.value;
  return token ? getUserBySessionToken(token) : null;
}
