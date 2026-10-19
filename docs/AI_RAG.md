# Phase 5 — RAG và citation

## Luồng xử lý

1. `POST /api/ai/ask` nhận câu hỏi ở backend.
2. RAG chỉ truy hồi `Document` có `status=VERIFIED` và có nội dung.
3. Provider adapter nhận câu hỏi cùng các nguồn được đánh nhãn `[D1]`, `[D2]`.
4. Citation policy từ chối câu trả lời không có citation hoặc có citation không tồn tại.
5. API trả metadata nguồn gồm document title, số hiệu, source URL để người dùng kiểm chứng.

## Trạng thái an toàn

- `NO_EVIDENCE`: không có văn bản phù hợp; không gọi provider.
- `PROVIDER_NOT_CONFIGURED`: có nguồn nhưng chưa có key; không giả lập câu trả lời.
- `PROVIDER_ERROR`: provider lỗi mạng/HTTP/phản hồi; không trả nội dung chưa kiểm chứng.
- `INVALID_CITATIONS`: provider không đáp ứng citation policy; nội dung bị loại.
- `ANSWERED`: chỉ khi có citation hợp lệ.

## Cấu hình

Provider được gọi hoàn toàn ở server. Không đặt API key trong `NEXT_PUBLIC_*` và không trả key trong response/log.

- OpenAI: `OPENAI_API_KEY`, tùy chọn `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Azure OpenAI: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, tùy chọn `AZURE_OPENAI_API_VERSION`

## Kiểm thử

```bash
npm run test:rag
```

Test bao phủ citation hợp lệ, citation không tồn tại, câu hỏi không có bằng chứng, và lỗi HTTP từ provider. Test không cần database hoặc API key thật.
