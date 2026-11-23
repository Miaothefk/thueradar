# Phase 6 — Scheduler và worker đồng bộ

## Thiết kế

Worker độc lập nằm tại `scripts/sync-worker.mjs`. Worker:

- dùng `Asia/Ho_Chi_Minh`;
- chỉ chạy khung giờ cấu hình khi dùng `--scheduled`;
- dùng PostgreSQL advisory lock để chống chạy trùng;
- dùng `SchedulerRun` để lưu lịch sử và trạng thái;
- retry tăng dần theo `SYNC_MAX_RETRIES` và `SYNC_RETRY_DELAY_MS`;
- gọi crawler Phase 4 bằng live mode;
- ghi log JSON ra stdout/stderr;
- không dùng `setInterval`, frontend timer hoặc tiến trình web lâu dài.

Mặc định worker không thể chạy nếu thiếu `DATABASE_URL` hoặc `SOURCE_ACCESS_APPROVED=1` cho live ingestion.

## Chạy thủ công

```bash
npm run sync:worker
```

Lệnh này chỉ là worker CLI; kết quả phải được kiểm tra trong log và bảng `SchedulerRun`.

Ngoài ra, `POST /api/admin/sync` cho phép ADMIN đã đăng nhập xếp một worker thủ công. Endpoint trả `202 QUEUED`, không giả vờ rằng đồng bộ đã hoàn tất.

## Cấu hình production

Do GitHub-hosted runners ở khu vực cloud không truy cập ổn định được GDT, GitHub Actions phải
chạy trên một self-hosted runner đã đăng ký với nhãn `thueradar-sync`, hoặc worker nên chạy
bằng Windows Task Scheduler trên máy luôn có kết nối mạng đến GDT.

Không coi workflow GitHub-hosted chạy `ubuntu-latest` là chứng cứ crawl thành công.

Chọn một scheduler của nền tảng triển khai để gọi:

```bash
npm run sync:worker
```

vào 02:00 giờ Việt Nam. Nếu nền tảng chỉ nhận cron UTC, 02:00 Asia/Ho_Chi_Minh tương đương 19:00 UTC ngày hôm trước trong giai đoạn UTC+7; cần kiểm tra quy tắc timezone/DST của nền tảng trước khi áp dụng.

Ví dụ:

- GitHub Actions: dùng `schedule`, thiết lập `timezone` nếu nền tảng hỗ trợ; nếu không, dùng `cron: '0 19 * * *'` và ghi rõ đây là ngày UTC trước.
- Azure Functions/Container Apps Jobs: cấu hình schedule timezone `Asia/Ho_Chi_Minh` ở nền tảng nếu khả dụng, hoặc chuyển đổi UTC có kiểm soát.
- Kubernetes CronJob: dùng `spec.timeZone: Asia/Ho_Chi_Minh` nếu cluster hỗ trợ; nếu không, dùng UTC và tài liệu hóa chuyển đổi.

Không đặt worker trong `next dev`, `next start`, frontend hoặc web request dài hạn. Không coi việc khai báo cron là bằng chứng scheduler đã hoạt động; cần một lần chạy thành công có `SchedulerRun.status=COMPLETED` và log tương ứng.
