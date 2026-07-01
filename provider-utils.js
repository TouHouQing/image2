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
    editable: true,
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
  return /(^|[-_/])image($|[-_/])|imagen|image-generation|gpt-image/.test(normalized);
}

export function normalizeImageOutputFormat(format) {
  const normalized = String(format || "")
    .trim()
    .toLowerCase()
    .replace(/^image\//, "")
    .replace("jpg", "jpeg");
  return ["png", "jpeg", "webp"].includes(normalized) ? normalized : "";
}

export function shouldTranscodeImageResult(providerId, requestedFormat, actualFormat) {
  const requested = normalizeImageOutputFormat(requestedFormat);
  const actual = normalizeImageOutputFormat(actualFormat);
  return providerId === "gpt" && Boolean(requested) && Boolean(actual) && requested !== actual;
}

export function isPartialImageStreamPayload(payload) {
  const type = String(payload?.type || "").toLowerCase();
  return Boolean(type && type.includes("partial_image"));
}

export function getImage2QualitySizeTier(quality) {
  switch (String(quality || "").trim().toLowerCase()) {
    case "low":
      return "1K";
    case "medium":
      return "2K";
    case "high":
      return "4K";
    default:
      return "";
  }
}

export function resolveImage2RequestSize(quality, resolvedSize) {
  const tier = getImage2QualitySizeTier(quality);
  if (!tier) return resolvedSize;

  const dimensions = parseImageDimensions(resolvedSize);
  if (!dimensions) {
    return {
      "1K": "1024x1024",
      "2K": "2048x2048",
      "4K": "2880x2880",
    }[tier];
  }

  return dimensionsForImage2Tier(dimensions.width, dimensions.height, tier);
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
  const selectedValue = hasOptions && options.includes(currentModel)
    ? currentModel
    : hasOptions
      ? pickFetchedModel(options)
      : "";
  return {
    options,
    placeholder: hasOptions ? "请选择已获取模型" : "请先获取模型",
    disabled: !hasOptions,
    selectedValue,
    lockInput: hasOptions,
  };
}

export function getProviderForModel(modelId) {
  return PROVIDERS[classifyModelId(modelId)] || PROVIDERS.gpt;
}

export function getGenerationEndpoint(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}/images/generations`;
}

export function getChatCompletionsEndpoint(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

export function getGeminiApiBaseUrl(baseUrl) {
  return normalizeBaseUrl(baseUrl)
    .replace(/\/openai$/i, "")
    .replace(/\/v\d+(?:alpha|beta)?$/i, "/v1beta")
    .replace(/\/+$/, "");
}

export function getGeminiModelsEndpoint(baseUrl) {
  return `${getGeminiApiBaseUrl(baseUrl)}/models`;
}

export function getModelListEndpoints(baseUrl) {
  return [...new Set([
    `${normalizeBaseUrl(baseUrl)}/models`,
    getGeminiModelsEndpoint(baseUrl),
  ])];
}

export function getGeminiGenerationEndpoint(baseUrl, modelId) {
  const normalizedBase = getGeminiApiBaseUrl(baseUrl);
  const normalizedModel = String(modelId || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
  return `${normalizedBase}/models/${encodeURIComponent(normalizedModel)}:generateContent`;
}

export function getGeminiStreamGenerationEndpoint(baseUrl, modelId) {
  const normalizedBase = getGeminiApiBaseUrl(baseUrl);
  const normalizedModel = String(modelId || DEFAULT_GEMINI_MODEL).replace(/^models\//, "");
  return `${normalizedBase}/models/${encodeURIComponent(normalizedModel)}:streamGenerateContent?alt=sse`;
}

export function getGenerationEndpointForModel(baseUrl, modelId) {
  if (classifyModelId(modelId) !== "gemini") return getGenerationEndpoint(baseUrl);
  return getGeminiGenerationEndpoint(baseUrl, modelId);
}

export function getEditEndpoint(baseUrl) {
  return `${normalizeBaseUrl(baseUrl)}/images/edits`;
}

export function isGoogleGeminiBaseUrl(baseUrl) {
  return /^https:\/\/generativelanguage\.googleapis\.com\//i.test(normalizeBaseUrl(baseUrl));
}

export function getGeminiModeForBaseUrl(baseUrl) {
  return "native";
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
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  };
}

export function buildGeminiChatPayload(model, prompt) {
  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    modalities: ["image", "text"],
    stream: false,
  };

  return payload;
}

export function buildGeminiEditPayload(prompt, imageParts) {
  const normalizedPrompt = String(prompt || "").trim();
  return {
    contents: [
      {
        parts: [
          {
            text: `请基于参考图进行编辑，只修改用户指定的部分，尽量保持其余内容、风格、光线和构图完全不变，只返回编辑后的图片，不要输出解释。用户要求：${normalizedPrompt}`,
          },
          ...(Array.isArray(imageParts) ? imageParts : []).filter(Boolean).map((image) => ({
            inline_data: {
              mime_type: image.mimeType || "image/png",
              data: image.data || "",
            },
          })),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };
}

export function extractModelIdsFromResponse(responseJson) {
  const openAIModels = Array.isArray(responseJson?.data)
    ? responseJson.data.map((item) => item?.id || item?.name).filter(Boolean)
    : [];
  const geminiModels = Array.isArray(responseJson?.models)
    ? responseJson.models.map((item) => item?.name || item?.id).filter(Boolean)
    : [];
  return [...new Set([...openAIModels, ...geminiModels])];
}

function parseImageDimensions(size) {
  const match = String(size || "").trim().match(/^(\d+)x(\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dimensionsForImage2Tier(width, height, tier) {
  const maxEdgeByTier = {
    "1K": 1024,
    "2K": 2048,
    "4K": 3840,
  };
  const maxPixelsByTier = {
    "1K": 1024 * 1024,
    "2K": 2048 * 2048,
    "4K": 3840 * 2160,
  };
  const minPixels = 655360;
  const maxEdge = maxEdgeByTier[tier] || 2048;
  const maxPixels = maxPixelsByTier[tier] || maxPixelsByTier["2K"];
  const ratio = clamp(width / height, 1 / 3, 3);
  let outputWidth;
  let outputHeight;

  if (ratio >= 1) {
    outputWidth = maxEdge;
    outputHeight = maxEdge / ratio;
  } else {
    outputHeight = maxEdge;
    outputWidth = maxEdge * ratio;
  }

  if (outputWidth * outputHeight > maxPixels) {
    const scale = Math.sqrt(maxPixels / (outputWidth * outputHeight));
    outputWidth *= scale;
    outputHeight *= scale;
  }

  outputWidth = roundImageDimension(outputWidth);
  outputHeight = roundImageDimension(outputHeight);

  if (outputWidth * outputHeight > maxPixels) {
    const scale = Math.sqrt(maxPixels / (outputWidth * outputHeight));
    outputWidth = floorImageDimension(outputWidth * scale);
    outputHeight = floorImageDimension(outputHeight * scale);
  }

  if (outputWidth * outputHeight < minPixels) {
    if (outputWidth >= outputHeight) {
      outputHeight = ceilImageDimension(minPixels / outputWidth);
    } else {
      outputWidth = ceilImageDimension(minPixels / outputHeight);
    }
  }

  return `${outputWidth}x${outputHeight}`;
}

function roundImageDimension(value) {
  return Math.max(256, Math.round(value / 16) * 16);
}

function floorImageDimension(value) {
  return Math.max(256, Math.floor(value / 16) * 16);
}

function ceilImageDimension(value) {
  return Math.max(256, Math.ceil(value / 16) * 16);
}

export function extractGeminiImageItems(responseJson) {
  const candidates = [
    ...(Array.isArray(responseJson?.candidates) ? responseJson.candidates : []),
    ...(Array.isArray(responseJson?.response?.candidates) ? responseJson.response.candidates : []),
  ];
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

export function extractChatCompletionImageItems(responseJson) {
  const choices = Array.isArray(responseJson?.choices) ? responseJson.choices : [];
  const items = [];

  choices.forEach((choice) => {
    const message = choice?.message || choice?.delta || {};
    const revisedPrompt = getRevisedPromptFromChatContent(message.content);
    const images = [
      ...(message.image ? [message.image] : []),
      ...(Array.isArray(message.images) ? message.images : []),
      ...(Array.isArray(message.content_parts) ? message.content_parts : []),
      ...(Array.isArray(message.content) ? message.content : []),
      ...(getImageLikeContentParts(message.content)),
    ];

    images.forEach((image) => {
      const url =
        image?.image_url?.url ||
        image?.imageUrl?.url ||
        image?.image?.url ||
        image?.url ||
        image?.data_url ||
        "";
      const b64 =
        image?.b64_json ||
        image?.image_base64 ||
        image?.base64 ||
        image?.data ||
        "";

      if (url) {
        items.push({
          dataUrl: url,
          mimeType: getMimeTypeFromDataUrl(url),
          revisedPrompt,
        });
      } else if (b64) {
        const mimeType = image?.mime_type || image?.mimeType || "image/png";
        items.push({
          dataUrl: `data:${mimeType};base64,${b64}`,
          mimeType,
          revisedPrompt,
        });
      }
    });
  });

  const responseOutputs = [
    ...(Array.isArray(responseJson?.output) ? responseJson.output : []),
    ...(Array.isArray(responseJson?.response?.output) ? responseJson.response.output : []),
  ];
  responseOutputs.forEach((output) => {
    const content = Array.isArray(output?.content) ? output.content : [];
    content.forEach((part) => {
      extractDataUrlImageItemsFromText(part?.text || "").forEach((item) => {
        items.push({
          ...item,
          revisedPrompt: "",
        });
      });
    });
  });

  return items;
}

function getMimeTypeFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+)[;,]/i);
  return match?.[1] || "";
}

function getRevisedPromptFromChatContent(content) {
  if (typeof content !== "string") return "";
  return isImageString(content) || extractDataUrlImageItemsFromText(content).length ? "" : content;
}

function getImageLikeContentParts(content) {
  if (typeof content !== "string") return [];
  const embeddedImages = extractDataUrlImageItemsFromText(content).map((item) => ({
    data_url: item.dataUrl,
  }));
  if (embeddedImages.length) return embeddedImages;
  if (!isImageString(content)) return [];
  return [{ data_url: normalizeImageString(content) }];
}

function extractDataUrlImageItemsFromText(text) {
  const raw = String(text || "");
  return [...raw.matchAll(/data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi)].map((match) => {
    const mimeType = match[1];
    const b64 = match[2];
    return {
      dataUrl: `data:${mimeType};base64,${b64}`,
      mimeType,
    };
  });
}

function isImageString(value) {
  const normalized = String(value || "").trim();
  return /^data:image\//i.test(normalized) || isBareImageBase64(normalized);
}

function normalizeImageString(value) {
  const normalized = String(value || "").trim();
  if (/^data:image\//i.test(normalized)) return normalized;
  return `data:image/png;base64,${normalized}`;
}

function isBareImageBase64(value) {
  return /^(iVBORw0KGgo|\/9j\/|UklGR)/.test(value);
}
