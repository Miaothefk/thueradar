import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/prisma";
import { getUserBySessionToken } from "@/lib/auth";
import { spawn } from "node:child_process";

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database chưa được cấu hình." }, { status: 503 });
  const token = request.cookies.get("thueradar_session")?.value;
  const user = token ? await getUserBySessionToken(token) : null;
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Chỉ ADMIN được chạy đồng bộ thủ công." }, { status: 403 });
  const child = spawn(process.execPath, ["scripts/sync-worker.mjs", "--manual"], {
    cwd: process.cwd(),
    env: process.env,
    detached: false,
    stdio: "ignore",
  });
  child.unref();
  return NextResponse.json({
    status: "QUEUED",
    message: "Đã xếp lịch worker đồng bộ. Kiểm tra SchedulerRun/log để biết kết quả thực tế.",
  }, { status: 202 });
}
