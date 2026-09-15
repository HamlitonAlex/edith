const compatible = (id, name, baseUrl) => ({ id, name, protocol: "openai", baseUrl });

export const MODEL_PROVIDERS = [
  compatible("openai", "OpenAI", "https://api.openai.com/v1"),
  { id: "anthropic", name: "Anthropic Claude", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", name: "Google Gemini", protocol: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  compatible("deepseek", "DeepSeek", "https://api.deepseek.com"),
  compatible("qwen", "阿里云百炼 · 通义千问", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
  compatible("zhipu", "智谱 GLM", "https://open.bigmodel.cn/api/paas/v4"),
  compatible("moonshot", "Moonshot · Kimi", "https://api.moonshot.cn/v1"),
  compatible("doubao", "火山引擎 · 豆包", "https://ark.cn-beijing.volces.com/api/v3"),
  compatible("minimax", "MiniMax", "https://api.minimax.chat/v1"),
  compatible("mistral", "Mistral AI", "https://api.mistral.ai/v1"),
  compatible("groq", "Groq", "https://api.groq.com/openai/v1"),
  compatible("xai", "xAI · Grok", "https://api.x.ai/v1"),
  compatible("openrouter", "OpenRouter", "https://openrouter.ai/api/v1"),
  compatible("ollama", "Ollama / LM Studio", "http://127.0.0.1:11434/v1"),
  compatible("custom", "自定义兼容接口", ""),
];

export const getProvider = providerId => MODEL_PROVIDERS.find(provider => provider.id === providerId) || MODEL_PROVIDERS.at(-1);
const trimSlash = value => String(value || "").trim().replace(/\/+$/, "");
const baseFor = (provider, endpoint) => trimSlash(endpoint || provider.baseUrl);

function authHeaders(provider, apiKey) {
  if (provider.protocol === "anthropic") return {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (provider.protocol === "gemini") return { "x-goog-api-key": apiKey };
  return apiKey ? { authorization: `Bearer ${apiKey}` } : {};
}

async function checkedJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || `连接失败（${response.status}）`;
    throw new Error(detail);
  }
  return payload;
}

export async function fetchProviderModels({ providerId, apiKey = "", endpoint = "", fetchImpl = globalThis.fetch }) {
  const provider = getProvider(providerId);
  const base = baseFor(provider, endpoint);
  if (!base) throw new Error("请填写 API 地址");
  const url = provider.protocol === "gemini" ? `${base}/models` : `${base}/models`;
  const payload = await checkedJson(await fetchImpl(url, { headers: authHeaders(provider, apiKey) }));
  const source = provider.protocol === "gemini" ? payload?.models : payload?.data;
  return (Array.isArray(source) ? source : [])
    .filter(item => item && (provider.protocol !== "gemini" || !Array.isArray(item.supportedGenerationMethods) || item.supportedGenerationMethods.includes("generateContent")))
    .map(item => String(item.id || item.name || "").replace(/^models\//, ""))
    .filter(Boolean)
    .sort();
}

export async function requestProviderReply({ providerId, apiKey = "", endpoint = "", model, messages, system = "", fetchImpl = globalThis.fetch }) {
  const provider = getProvider(providerId);
  const base = baseFor(provider, endpoint);
  if (!base || !model) throw new Error("模型连接信息不完整");
  const inputMessages = (Array.isArray(messages) ? messages : []).filter(item => item && typeof item === "object");
  let url;
  let body;
  if (provider.protocol === "anthropic") {
    url = `${base}/messages`;
    const anthropicMessages = inputMessages.filter(item => item.role !== "system").map(item => ({
      role: item.role,
      content: Array.isArray(item.content) ? item.content.filter(Boolean).map(part => {
        if (part.type !== "image_url") return { type: "text", text: part.text || "" };
        const imageUrl = part.image_url?.url;
        const match = typeof imageUrl === "string" ? imageUrl.match(/^data:([^;]+);base64,(.+)$/) : null;
        return match ? { type: "image", source: { type: "base64", media_type: match[1], data: match[2] } } : { type: "text", text: "[图片附件]" };
      }) : item.content,
    }));
    body = { model, max_tokens: 1400, system, messages: anthropicMessages };
  } else if (provider.protocol === "gemini") {
    url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
    body = {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: inputMessages.filter(item => item.role !== "system").map(item => ({
        role: item.role === "assistant" ? "model" : "user",
        parts: Array.isArray(item.content) ? item.content.filter(Boolean).map(part => {
          if (part.type !== "image_url") return { text: part.text || "" };
          const imageUrl = part.image_url?.url;
          const match = typeof imageUrl === "string" ? imageUrl.match(/^data:([^;]+);base64,(.+)$/) : null;
          return match ? { inlineData: { mimeType: match[1], data: match[2] } } : { text: "[图片附件]" };
        }) : [{ text: String(item.content || "") }],
      })),
      generationConfig: { temperature: 0.55 },
    };
  } else {
    url = `${base}/chat/completions`;
    body = { model, temperature: 0.55, messages: [...(system ? [{ role: "system", content: system }] : []), ...inputMessages] };
  }
  const payload = await checkedJson(await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders(provider, apiKey) },
    body: JSON.stringify(body),
  }));
  const text = provider.protocol === "anthropic"
    ? (Array.isArray(payload?.content) ? payload.content : []).map(part => part?.text || "").join("")
    : provider.protocol === "gemini"
      ? (Array.isArray(payload?.candidates?.[0]?.content?.parts) ? payload.candidates[0].content.parts : []).map(part => part?.text || "").join("")
      : payload?.choices?.[0]?.message?.content || payload?.output_text;
  if (!String(text || "").trim()) throw new Error("模型没有返回可显示的内容");
  return String(text).trim();
}
