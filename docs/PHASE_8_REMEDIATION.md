# Phase 8 — Checklist khắc phục và kiểm thử staging

Tài liệu này ghi lại các việc còn thiếu sau Phase 8 và thứ tự thực hiện an toàn. Trạng thái hiện tại vẫn là `NEEDS_SIGNOFF`; không bước nào dưới đây được coi là bằng chứng production-ready cho đến khi có kết quả kiểm thử thực tế.

## Trạng thái còn thiếu

| Ưu tiên | Hạng mục | Trạng thái |
|---|---|---|
| P0 | PostgreSQL staging, Prisma migration và integration tests | Chưa xác minh |
| P0 | Sửa exit code của scheduler CLI trên Windows | Đang lỗi |
| P0 | Xử lý 4 HIGH production dependency vulnerabilities | Chưa xử lý |
| P1 | Nâng Node.js lên patch được dependency hỗ trợ | Chưa làm |
| P1 | Xác minh outbound HTTPS/DNS và crawler dry-run | Bị chặn bởi môi trường hiện tại |
| P1 | Cấu hình AI provider server-side và kiểm thử provider thật | Chưa cấu hình |
| P1 | Chạy worker thật, kiểm tra `SchedulerRun`, cấu hình scheduler production | Chưa xác minh |
| P2 | Authenticated E2E và viewport mobile/tablet | Chưa có |
| P2 | Monitoring, alerting và quy trình replay run lỗi | Chưa cấu hình |

## Nguyên tắc an toàn

- Chỉ dùng database development/staging riêng; không dùng production cho `prisma migrate dev`.
- Không chạy lệnh xóa/reset như `prisma migrate reset`, `db push --force-reset` hoặc `DROP DATABASE`.
- Không commit `.env.local`, API key, password, connection string hoặc log chứa secret.
- Chỉ bật `SOURCE_ACCESS_APPROVED=1` sau khi đã review [LEGAL_SOURCE_ACCESS.md](./LEGAL_SOURCE_ACCESS.md) và có phê duyệt nguồn.
- Không gọi AI provider hoặc live crawler để “cho có kết quả”; mọi kết luận phải dựa trên log và dữ liệu kiểm tra.

## Bước 0 — Chuẩn bị công cụ

Mở PowerShell tại thư mục repository:

```powershell
Set-Location "C:\Users\hoang\OneDrive\Máy tính\thueradar"
git status --short
node --version
npm --version
```

Nâng Node.js lên bản LTS/patch được hỗ trợ bởi Next.js và dependency hiện tại, sau đó mở terminal mới và kiểm tra:

```powershell
node --version
```

Không tiếp tục nếu Node vẫn dưới engine floor được báo trong `npm install`.

## Bước 1 — Tạo PostgreSQL staging

Chọn một PostgreSQL staging riêng (managed PostgreSQL hoặc PostgreSQL local). Tạo database và user riêng cho ThueRadar. Lưu connection string trong secret manager hoặc `.env.local`, không ghi vào git:

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/thueradar_staging?schema=public"
```

Kiểm tra biến môi trường trong phiên PowerShell hiện tại, không in toàn bộ secret:

```powershell
if ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
  Write-Error "DATABASE_URL is missing"
  exit 1
}
Write-Output "DATABASE_URL is configured"
```

Nếu dùng `.env.local`, đặt giá trị vào file đó và kiểm tra `.gitignore` đã loại trừ file. Không paste password vào chat.

## Bước 2 — Tạo và review migration

Hiện schema đã có nhưng migration thực tế chưa được xác minh. Trên database staging rỗng:

```powershell
npx prisma generate
npx prisma migrate dev --name init
```

Review thư mục migration được tạo và SQL trước khi tiếp tục:

```powershell
Get-ChildItem -Recurse .\prisma\migrations
git diff -- .\prisma\schema.prisma .\prisma\migrations
npx prisma migrate status
```

Nếu migration có thao tác drop/alter làm mất dữ liệu, dừng lại để review thủ công. Chỉ dùng `npx prisma migrate deploy` cho database staging/production đã có migration được review và backup/rollback plan:

```powershell
npx prisma migrate deploy
```

## Bước 3 — Tạo dữ liệu kiểm thử và xác minh auth/RBAC

Tạo tối thiểu ba tài khoản test, mỗi tài khoản một role `USER`, `REVIEWER`, `ADMIN`. Dùng cơ chế seed/one-off script có kiểm soát của dự án; không chèn password thô. Sau đó chạy test với database staging:

```powershell
npm run typecheck
npm run test:phase8
```

Bổ sung/chạy integration cases sau:

- đăng nhập đúng và sai mật khẩu;
- cookie session là HTTP-only, hết hạn đúng;
- logout làm session mất hiệu lực;
- USER không đọc/sửa dữ liệu của user khác;
- USER không gọi endpoint reviewer/admin;
- REVIEWER/ADMIN thực hiện moderation hợp lệ;
- save/follow/notification đọc lại được từ database;
- audit event được tạo sau thao tác thành công;
- request thiếu/không hợp lệ trả lỗi rõ ràng.

Mỗi case phải kiểm tra cả HTTP status, response body và database read-back; không chỉ kiểm tra UI.

## Bước 4 — Sửa scheduler CLI trước khi chạy production

Lỗi hiện tại: `node scripts\sync-worker.mjs --manual` trên Windows có thể trả exit code `0` khi thiếu `DATABASE_URL`. Cần sửa entrypoint để:

1. nhận diện đúng khi file được chạy trực tiếp trên Windows;
2. gọi `runSyncWorker()` trong CLI path;
3. ghi lỗi có cấu trúc ra stderr;
4. gọi `process.exitCode = 1` khi cấu hình/worker thất bại;
5. không nuốt exception.

Kiểm thử bắt buộc sau khi sửa:

```powershell
$env:DATABASE_URL = ""
node .\scripts\sync-worker.mjs --manual
if ($LASTEXITCODE -eq 0) { throw "Expected non-zero exit code" }
```

Sau đó chạy với database staging và source approval hợp lệ. Xác minh cả log JSON và bản ghi `SchedulerRun`:

```powershell
# Nạp DATABASE_URL từ secret store của môi trường staging; không ghi giá trị thật vào shell history.
$env:SOURCE_ACCESS_APPROVED = "1"
node .\scripts\sync-worker.mjs --manual
npm run typecheck
npm run lint
```

Không đặt connection string thật trong lệnh hoặc commit vào profile PowerShell.

## Bước 5 — Xử lý dependency vulnerabilities

Chụp baseline:

```powershell
npm audit --omit=dev --audit-level=high
npm ls prisma "@prisma/client" next
```

Review dependency chain của `deepmerge-ts` và `effect`, sau đó nâng cấp theo nhóm tương thích, ưu tiên bản patch/minor trước. Không chạy `npm audit fix --force` trực tiếp trên nhánh đang làm việc.

Sau mỗi thay đổi `package.json`/`package-lock.json`:

```powershell
npm install
npx prisma generate
npm run lint
npm run typecheck
npm run test:rag
npm run test:phase8
npm run build
npm audit --omit=dev --audit-level=high
```

Chỉ đánh dấu đạt khi audit không còn HIGH, hoặc có quyết định security review được ghi rõ kèm lý do và hạn xử lý.

## Bước 6 — Xác minh crawler và nguồn pháp luật

Đọc [LEGAL_SOURCE_ACCESS.md](./LEGAL_SOURCE_ACCESS.md), xác minh quyền truy cập, robots policy, rate limit và điều khoản sử dụng. Từ môi trường được phép outbound HTTPS:

```powershell
$env:SOURCE_ACCESS_APPROVED = "1"
node .\scripts\crawl-legal-sources.mjs --dry-run --max-items=1
```

Kiểm tra:

- timeout/retry hoạt động;
- chỉ truy cập domain được allowlist;
- URL trùng bị loại;
- checksum được tạo;
- dry-run không ghi database;
- log không chứa secret;
- lỗi mạng trả exit code khác `0`.

Chỉ chạy live ingestion khi dry-run thành công và có phê duyệt. Sau đó kiểm tra `IngestionRun`, document draft và version/checksum trong staging.

## Bước 7 — Cấu hình AI provider an toàn

Chọn OpenAI-compatible hoặc Azure OpenAI. Đặt key/endpoint/deployment trong secret store server-side, tuyệt đối không dùng `NEXT_PUBLIC_*`. Khởi động server staging rồi kiểm tra:

- câu hỏi có evidence trả citation hợp lệ;
- câu hỏi không có evidence trả trạng thái thiếu bằng chứng và không gọi provider;
- citation không tồn tại bị từ chối;
- provider timeout/4xx/5xx trả lỗi không làm lộ API key;
- `AiAnswer` và citation được lưu sau câu trả lời thành công;
- feedback/rating/report chỉ hoạt động với user đã đăng nhập.

Chạy regression:

```powershell
npm run test:rag
npm run test:phase8
npm run test:e2e
```

## Bước 8 — Xác minh scheduler production

Chọn đúng một nền tảng (GitHub Actions, Azure Functions/Container Apps Jobs hoặc Kubernetes CronJob). Cấu hình timezone `Asia/Ho_Chi_Minh` nếu nền tảng hỗ trợ; nếu dùng UTC, ghi rõ quy đổi 02:00 Việt Nam thành 19:00 UTC ngày trước.

Lần chạy kiểm soát phải có:

- trigger được ghi nhận;
- worker log JSON;
- retry/lock hoạt động;
- một `SchedulerRun` có `status=COMPLETED`;
- không có run trùng cùng `runKey`;
- lỗi tạo `FAILED` và không bị báo thành công giả.

Sau đó mới bật lịch hằng ngày và cấu hình alert khi run failed/missed.

## Bước 9 — Mở rộng E2E và chạy full gate

Thêm viewport desktop, tablet, mobile; authenticated flows cho USER/REVIEWER/ADMIN; kiểm tra lỗi 401/403/503 và empty state. Chạy toàn bộ:

```powershell
npx prisma generate
npm run lint
npm run typecheck
npm run test:rag
npm run test:phase8
npm run test:e2e
npm run build
npm audit --omit=dev --audit-level=high
```

Nếu có integration test database, chạy thêm suite đó và lưu exit code/log. Cập nhật [runtime-validation-report.md](../runtime-validation-report.md) bằng kết quả mới, không xóa các kết quả thất bại trước đó.

## Tiêu chí sign-off cuối

Chỉ chuyển khỏi `NEEDS_SIGNOFF` khi tất cả điều kiện sau có bằng chứng:

- migration đã review và chạy thành công trên staging;
- auth, ownership, role authorization và audit log đã test read-back;
- dependency HIGH đã xử lý hoặc được security owner chấp thuận bằng văn bản;
- scheduler CLI có exit code đúng và production scheduler có `COMPLETED` run;
- crawler dry-run/live staging được xác minh theo policy;
- AI provider staging trả citation kiểm chứng được và không lộ secret;
- authenticated E2E và viewport chính đã đạt;
- lint, typecheck, tests, build và audit đều có kết quả lưu lại.
