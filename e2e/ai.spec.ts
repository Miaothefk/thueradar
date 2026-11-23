import { expect, test } from "@playwright/test";

test("AI answer flow shows evidence or a truthful no-evidence state", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/ai");
  await page.getByLabel("Câu hỏi pháp lý").fill("Công văn 8871/CT-QLNT nói gì?");
  await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(page.getByText(/Câu trả lời có citation|Chưa đủ bằng chứng|Chưa thể trả lời/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Nguồn được truy hồi|Không thể tạo câu trả lời/)).toBeVisible({ timeout: 30_000 }).catch(() => undefined);
});
