# Phase 4 — Kiểm tra nguồn và chính sách truy cập

## Nguồn bắt đầu

Adapter công khai hiện tại là `gdt-vietnamese-legal-documents`, trỏ tới **Hệ thống văn bản** của Cục Thuế:

- Trang danh mục: <https://gdt.gov.vn/wps/portal/home/documents>
- `robots.txt`: <https://gdt.gov.vn/robots.txt>
- Trang chính sách/điểm truy cập được kiểm tra: chính trang danh mục ở trên

Adapter tiếng Anh cũ vẫn có thể chọn bằng `--source=gdt-english`.

Ngày kiểm tra: 2026-10-13.

Quan sát được:

- Trang danh mục có thể truy cập bằng GET và trả về số/ký hiệu, ngày ban hành, trang chi tiết và tệp PDF đính kèm.
- Phần tìm kiếm nâng cao có CAPTCHA; crawler không tự động gửi biểu mẫu CAPTCHA và không gọi API nội bộ bị hạn chế.
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
- tự tải PDF công khai từ đúng host nguồn và giới hạn dung lượng;
- trích xuất lớp văn bản PDF bằng `pdf-parse`;
- lưu `pdfChecksum`, URL file đính kèm và trạng thái `contentExtraction` trong metadata phiên bản;
- `externalId` theo URL nguồn và versioning qua `DocumentVersion`/checksum;
- dry-run mặc định;
- log JSON cho từng sự kiện;
- live mode chỉ được bật khi có `DATABASE_URL` và `SOURCE_ACCESS_APPROVED=1`.

## Chạy dry-run

Lệnh dưới đây sẽ truy cập nguồn thật nhưng không ghi database:

```bash
node --use-system-ca scripts/crawl-legal-sources.mjs --source=gdt-vietnamese --dry-run --max-pages=1 --max-items=5 --delay-ms=1500
```
Trên môi trường Linux/Vercel thường chỉ cần `node scripts/crawl-legal-sources.mjs ...`. Tuỳ chọn `--use-system-ca` chỉ cần khi Node.js trên Windows báo lỗi chứng thư TLS cục bộ.

Dry-run chỉ chứng minh khả năng truy cập/parse tại thời điểm chạy; không chứng minh đã nhập dữ liệu vào ThueRadar.

`contentExtraction` có các trạng thái:

- `TEXT_EXTRACTED`: PDF có lớp chữ và đã trích xuất được;
- `NO_TEXT_LAYER`: PDF là bản scan hoặc không có lớp chữ, cần OCR riêng;
- `NO_ATTACHMENT`: trang chi tiết không có file đính kèm.

Crawler không dùng OCR trong bước này để tránh tự suy diễn nội dung từ ảnh. Những văn bản `NO_TEXT_LAYER` phải được đánh dấu để xử lý bổ sung trước khi đưa vào RAG.

## Live ingestion

Chỉ chạy sau khi đã:

1. xác nhận quyền truy cập và mục đích sử dụng với đơn vị quản lý nguồn;
2. kiểm tra database dev/staging và migration tương ứng;
3. đặt `SOURCE_ACCESS_APPROVED=1`;
4. cung cấp `DATABASE_URL` an toàn.

```bash
SOURCE_ACCESS_APPROVED=1 node --use-system-ca scripts/crawl-legal-sources.mjs --source=gdt-vietnamese --live --max-items=20
```

Bản ghi được tạo ở trạng thái `DRAFT`; không tự động công bố thành `VERIFIED`.
