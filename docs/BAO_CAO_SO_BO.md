# ThueRadar - Bao cao so bo

Ngay bao cao: 23/11/2026

## 1. Muc tieu

ThueRadar la nen tang tra cuu phap luat thue Viet Nam, ket hop kho van ban chinh thuc, truong hop hieu luc, kiem duyet noi dung va ho tro tra loi bang AI co trich dan.

## 2. Trang thai tong quan

He thong da hoan thanh lop prototype va staging cho cac luong cot loi:

- Giao dien Next.js bang tieng Viet, co responsive co ban.
- Crawler cong khai GDT, tai PDF, trich xuat text va ghi checksum.
- Supabase staging da ket noi va migration da ap dung.
- Du lieu GDT da crawl, trich xuat va luu vao database staging.
- Trang quan tri co dashboard thong ke, duyet van ban va xu ly bao cao AI.
- Dang nhap, session cookie va phan quyen ROLE da co.
- AI Azure OpenAI tra loi co citation va canh bao khi hieu luc UNKNOWN.
- Windows Task Scheduler da duoc tao lich chay 02:00 moi ngay.

## 3. Da xac minh bang du lieu/hanh vi

| Hang muc | Ket qua |
|---|---|
| Database staging | Ket noi thanh cong |
| Prisma migration | 2 migration da tim thay; migration hieu luc da ap dung |
| Source | 1 ban ghi |
| Document | 17 ban ghi sau live sync |
| DocumentVersion | 16 ban ghi |
| Crawler | Da crawl 20 ban ghi; 16 PDF duoc tach text/ghi thanh cong |
| SchedulerRun | status COMPLETED, trigger manual, attempt 1 |
| Windows Task Scheduler | Task Ready, chi chay lan thu nghiem thanh cong, LastTaskResult 0 |
| Lint | PASS |
| Typecheck | PASS |
| Production build | PASS |
| RAG unit test | 4/4 PASS |
| API/guard test | 3/5 truoc khi server local chay; can lap lai voi server duoc cau hinh |
| Login, moderation, documents va AI | Da thu nghiem tren Preview HTTPS |

## 4. Cac trang da co

- Trang chu.
- Kho van ban va bo loc.
- Chi tiet van ban va lich su phien ban.
- Trang AI hoi dap co danh gia va bao cao.
- Trang dang nhap.
- Trang quan tri/admin chi hien cho tai khoan admin/reviewer duoc phan quyen.
- Muc quan tri:
  - duyet va cong bo van ban;
  - xu ly bao cao khach hang;
  - thong ke van ban, phan hoi va SchedulerRun.

## 5. Con viec chua hoan thanh

### P0 - Bat buoc truoc production

1. Tach hoan toan Production va staging.
2. Kiem tra migration va du lieu tren database Production bang backup/rollback.
3. Rut gon secret khoi moi log va audit cau hinh.
4. Kiem thu auth/role end-to-end bang database staging:
   - USER khong truy cap admin.
   - REVIEWER chi duoc moderation co quyen.
   - ADMIN duoc xem dashboard va xu ly bao cao.
   - logout huy session.
   - doc/ghi database read-back sau moi action.
5. Xu ly cac lo hong HIGH trong npm audit va ghi quyet dinh cho tung dependency.
6. Them alert va quy trinh replay khi SchedulerRun FAILED.

### P1 - Nen tang chat luong

1. Them OCR cho PDF scan khong co text layer.
2. Tang cuong phan tich thay the/bi bai bo/hieu luc.
3. Bo sung ghi chu kiem duyet va ly do VERIFIED.
4. Them monitoring va log tap trung cho crawler, AI, scheduler.
5. Xay full Playwright cho desktop/tablet/mobile va authenticated flow.
6. Thu nghiem trang thong bao/saved documents/topic follow voi du lieu that.

### P2 - Hoan thien san pham

1. Them onboarding va huong dan nhap.
2. Them lich su hoat dong cua admin.
3. Them goi service va thao tac quan ly doanh nghiep neu ban san pham SaaS.
4. Them terms of use, privacy policy va disclaimer y nghia phap ly.
5. Kiem tra tuong thich trinh duyet va accessibility.

## 6. De xuat huong di

Hien tai nen dat he thong o muc:

- Prototype kinh doanh duoc: co.
- He thong staging hoat dong: co.
- San sang trinh chieu bai tap: co dieu kien.
- San sang ban cho doanh nghiep that: chua hoan toan.
- San sang production legal advisory: chua sign-off.

## 7. Kiem thu can luu vao phan thu hoach

- Crawl/ingest co danh dau nguon va PDF.
- Text extraction.
- Dry-run/live mode.
- Kiem duyet DRAFT -> IN_REVIEW -> VERIFIED.
- RAG chi lay VERIFIED.
- AI tra loi co citation va canh bao UNKNOWN.
- Feedback/rating/reports.
- Scheduler va run history.
- UI admin/dashboard/responsive.

## 8. Ghi chu an toan

Ket qua crawler va AI khong tu dong duoc coi la tham van phap luat chinh thuc neu hieu luc UNKNOWN.
Moi noi dung VERIFIED can duoc kiem duyet thu cong va can theo doi van ban thay the/hieu luc sau nay.
