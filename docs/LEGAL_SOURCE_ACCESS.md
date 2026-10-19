# Phase 4 — Kiểm tra nguồn và chính sách truy cập

## Nguồn bắt đầu

Adapter đầu tiên là `gdt-english-legal-documents`, trỏ tới trang **Legal Documents** của General Department of Taxation (Ministry of Finance):

- Trang danh mục: <https://gdt.gov.vn/wps/portal/english/documents/>
- `robots.txt`: <https://gdt.gov.vn/robots.txt>
- Trang chính sách/điểm truy cập được kiểm tra: chính trang danh mục ở trên

Ngày kiểm tra: 2026-10-13.

Quan sát được:

- Trang danh mục có thể truy cập bằng HTTP và trả về các liên kết văn bản.
- `robots.txt` hiện không có lệnh cấm toàn bộ đường dẫn cho user-agent của ThueRadar; lệnh cấm quan sát được áp dụng cho `coccocbot`.
- Chưa xác minh được điều khoản cấp phép riêng cho việc thu thập hàng loạt hoặc tái phân phối. Vì vậy live ingestion bị khóa bằng `SOURCE_ACCESS_APPROVED=1` và cần phê duyệt con người trước khi bật.
- Adapter không dùng `/api/` hay các đường dẫn bị hạn chế của nguồn khác. Không suy diễn rằng robots.txt đồng nghĩa với giấy phép khai thác dữ liệu.

## Quy tắc crawler

`scripts/crawl-legal-sources.mjs` có:

- adapter riêng theo source key;
- timeout và retry có backoff;
- giới hạn tốc độ tối thiểu 250ms giữa các request (mặc định 1500ms);
- giới hạn số trang/số mục;
- lọc domain HTTPS cùng host;
- deduplication theo URL nguồn;
- checksum SHA-256 của nội dung chuẩn hóa;
- `externalId` theo URL nguồn và versioning qua `DocumentVersion`/checksum;
- dry-run mặc định;
- log JSON cho từng sự kiện;
- live mode chỉ được bật khi có `DATABASE_URL` và `SOURCE_ACCESS_APPROVED=1`.

## Chạy dry-run

Lệnh dưới đây sẽ truy cập nguồn thật nhưng không ghi database:

```bash
npm run crawl:sources
```

Giới hạn rõ hơn:

```bash
node scripts/crawl-legal-sources.mjs --dry-run --max-pages=1 --max-items=5 --delay-ms=1500
```

Dry-run chỉ chứng minh khả năng truy cập/parse tại thời điểm chạy; không chứng minh đã nhập dữ liệu vào ThueRadar.

## Live ingestion

Chỉ chạy sau khi đã:

1. xác nhận quyền truy cập và mục đích sử dụng với đơn vị quản lý nguồn;
2. kiểm tra database dev/staging và migration tương ứng;
3. đặt `SOURCE_ACCESS_APPROVED=1`;
4. cung cấp `DATABASE_URL` an toàn.

```bash
SOURCE_ACCESS_APPROVED=1 node scripts/crawl-legal-sources.mjs --live --max-items=20
```

Bản ghi được tạo ở trạng thái `DRAFT`; không tự động công bố thành `VERIFIED`.
