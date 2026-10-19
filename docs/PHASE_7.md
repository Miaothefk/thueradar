# Giai đoạn 7 — Lưu, theo dõi, thông báo, phản hồi và kiểm duyệt

Các thao tác Phase 7 đều đi qua API server và ghi vào PostgreSQL:

- `SavedDocument`: lưu/bỏ lưu, danh sách văn bản đã lưu; quyền giới hạn theo user hiện tại.
- `TopicFollow`: theo dõi/bỏ theo dõi chủ đề; không tạo bản ghi trùng.
- `Notification`: thông báo theo user, đọc/chưa đọc; khi văn bản chuyển sang `VERIFIED`, follower của chủ đề nhận thông báo.
- `AiAnswer` và `AiFeedback`: câu trả lời `ANSWERED` được lưu cùng citations; user đăng nhập có thể đánh giá 1–5 hoặc gửi báo cáo. Mỗi loại phản hồi có một bản ghi/user/câu trả lời.
- Kiểm duyệt: REVIEWER/ADMIN xử lý báo cáo AI và chuyển trạng thái văn bản qua API. Thay đổi được ghi `AuditEvent`.

Khi chưa có `DATABASE_URL`, API trả trạng thái cấu hình/lỗi phù hợp; giao diện không hiển thị thành công giả. Cần tạo migration an toàn trên development/staging trước khi triển khai production; không chạy migration tự động trong repository này.
