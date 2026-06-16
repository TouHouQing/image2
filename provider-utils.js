export const DEFAULT_BASE_URL = "https://sub.tohoqing.com/v1";
export const DEFAULT_MODEL = "gpt-image-2";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash-preview-image-generation";

export const PROVIDERS = {
  gpt: {
    id: "gpt",
    label: "Image2",
    defaultModel: DEFAULT_MODEL,
    editable: true,
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    defaultModel: DEFAULT_GEMINI_MODEL,
    editable: false,
  },
};

export function normalizeBaseUrl(url) {
  let normalized = String(url || DEFAULT_BASE_URL).trim();
  if (!normalized) normalized = DEFAULT_BASE_URL;
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  normalized = normalized.replace(/\/+$/, "");
  if (/\/openai$/i.test(normalized)) return normalized;
  if (!/\/v\d+(?:beta|alpha)?$/i.test(normalized)) normalized = `${normalized}/v1`;
  return normalized;
}

export function classifyModelId(modelId) {
  const normalized = String(modelId || "").toLowerCase();
  if (/gemini|imagen/.test(normalized)) return "gemini";
  return "gpt";
}

export function supportsImageGenerationModel(modelId) {
  const normalized = String(modelId || "").toLowerCase();
  return /image|gemini|imagen/.test(normalized);
}

export function pickInitialModel(models, currentModel = "") {
  const available = Array.isArray(models) ? models.filter(Boolean) : [];
  if (currentModel && available.includes(currentModel)) return currentModel;
  return (
    available.find((model) => classifyModelId(model) === "gpt" && /image/i.test(model)) ||
    available.find((model) => classifyModelId(model) === "gemini") ||
    available[0] ||
    currentModel ||
    DEFAULT_MODEL
  );
}

export function pickFetchedModel(models) {
  const available = Array.isArray(models) ? models.filter(Boolean) : [];
  return (
    available.find((model) => classifyModelId(model) === "gemini") ||
    available.find((model) => classifyModelId(model) === "gpt" && /image/i.test(model)) ||
    available[0] ||
    DEFAULT_MODEL
  );
}

export function getModelSelectState(models, currentModel = "") {
  const options = [...new Set((Array.isArray(models) ? models : []).filter(Boolean))];
  const hasOptions = options.length > 0;
  return {
    options,
    placeholder: hasOptions ? "请选择已获取模型" : "请先获取模型",
    disabled: !hasOptions,
    selectedValue: hasOptions && options.includes(currentModel) ? currentModel : "",
    lockInput: hasOptions,
  };
}

export function getProviderForModel(modelId) {
  return PROVIDERS[classifyModelId(modelId)] || PROVIDERS.gpt;
}

export function getGenerationEndpoint(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}/images/generations`;
}

export function getGeminiGenerationEndpoint(baseUrl, modelId) {
  const normalizedBase = normalizeBaseUrl(baseUrl)
    .replace(/\/openai$/i, "")
    .replace(/\/+$/, "");
  const normalizedModel = String(modelId || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
  return `${normalizedBase}/models/${encodeURIComponent(normalizedModel)}:generateContent`;
}

export function getEditEndpoint(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}/images/edits`;
}

export function isGoogleGeminiEndpoint(endpoint) {
  return /^https:\/\/generativelanguage\.googleapis\.com\//i.test(String(endpoint || ""));
}

export function buildGeminiGeneratePayload(prompt) {
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };
}

export function extractGeminiImageItems(responseJson) {
  const candidates = Array.isArray(responseJson?.candidates) ? responseJson.candidates : [];
  const items = [];

  candidates.forEach((candidate) => {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const revisedPrompt = parts
      .map((part) => part?.text)
      .filter(Boolean)
      .join("\n");

    parts.forEach((part) => {
      const inlineData = part?.inlineData || part?.inline_data;
      const b64 = inlineData?.data;
      if (!b64) return;
      items.push({
        b64,
        mimeType: inlineData.mimeType || inlineData.mime_type || "",
        revisedPrompt,
      });
    });
  });

  return items;
}
