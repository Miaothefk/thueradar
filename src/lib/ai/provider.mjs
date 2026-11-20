export class AiProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "AiProviderError";
    this.code = options.code || "PROVIDER_ERROR";
    this.status = options.status;
  }
}

function required(value, name) {
  if (!value) throw new AiProviderError(`${name} chưa được cấu hình.`, { code: "NOT_CONFIGURED" });
  return value;
}

export function getProviderConfig(env = process.env) {
  if (env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT) {
    return {
      kind: "azure-openai",
      apiKey: env.AZURE_OPENAI_API_KEY,
      endpoint: env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, ""),
      deployment: required(env.AZURE_OPENAI_DEPLOYMENT, "AZURE_OPENAI_DEPLOYMENT"),
      apiVersion: env.AZURE_OPENAI_API_VERSION || "2024-10-21",
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      kind: "openai",
      apiKey: env.OPENAI_API_KEY,
      endpoint: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }
  return null;
}

export function createAiProvider(env = process.env, fetchImpl = fetch) {
  const config = getProviderConfig(env);
  if (!config) return null;

  return {
    kind: config.kind,
    async generateAnswer({ question, sources }) {
      const sourceContext = sources
        .map((source) => `[${source.id}] ${source.title}\nHiệu lực: ${source.legalStatus || "UNKNOWN"}\n${source.content}`)
        .join("\n\n");
      const system = [
        "Bạn là trợ lý nghiên cứu pháp luật thuế Việt Nam.",
        "Chỉ dùng thông tin trong các nguồn được cung cấp.",
        "Nếu nguồn không đủ, nói rõ chưa đủ bằng chứng và không suy đoán.",
        "Nếu hiệu lực của nguồn là UNKNOWN, phải nói rõ chưa xác định được hiệu lực và không khẳng định nguồn còn hiệu lực.",
        "Mỗi nhận định pháp lý phải có ít nhất một citation dạng [D1], [D2].",
        "Không tạo citation không tồn tại trong danh sách nguồn.",
      ].join(" ");
      const payload = {
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Câu hỏi: ${question}\n\nNguồn:\n${sourceContext}` },
        ],
        temperature: 0,
      };
      let url;
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` };
      if (config.kind === "azure-openai") {
        url = `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;
        headers["api-key"] = config.apiKey;
        delete headers.Authorization;
      } else {
        url = `${config.endpoint.replace(/\/$/, "")}/chat/completions`;
        payload.model = config.model;
      }

      let response;
      try {
        response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(payload) });
      } catch {
        throw new AiProviderError("Không thể kết nối AI provider.", { code: "NETWORK_ERROR" });
      }
      if (!response.ok) {
        throw new AiProviderError("AI provider trả về lỗi.", { code: "PROVIDER_HTTP_ERROR", status: response.status });
      }
      const body = await response.json();
      const answer = body?.choices?.[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new AiProviderError("AI provider không trả về nội dung hợp lệ.", { code: "INVALID_PROVIDER_RESPONSE" });
      }
      return answer.trim();
    },
  };
}
