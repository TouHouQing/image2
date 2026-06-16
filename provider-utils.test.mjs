import assert from "node:assert/strict";
import {
  DEFAULT_BASE_URL,
  buildGeminiGeneratePayload,
  buildGeminiImagePayload,
  classifyModelId,
  extractGeminiImageItems,
  getGeminiGenerationEndpoint,
  getGenerationEndpointForModel,
  getGenerationEndpoint,
  getModelSelectState,
  getGeminiModeForBaseUrl,
  isGoogleGeminiBaseUrl,
  isGoogleGeminiEndpoint,
  normalizeBaseUrl,
  pickInitialModel,
  pickFetchedModel,
} from "./provider-utils.js";

assert.equal(normalizeBaseUrl(""), DEFAULT_BASE_URL);
assert.equal(normalizeBaseUrl("sub.tohoqing.com"), "https://sub.tohoqing.com/v1");
assert.equal(normalizeBaseUrl("https://sub.tohoqing.com/v1/"), "https://sub.tohoqing.com/v1");
assert.equal(
  normalizeBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai/"),
  "https://generativelanguage.googleapis.com/v1beta/openai",
);
assert.equal(
  getGenerationEndpoint("https://generativelanguage.googleapis.com/v1beta/openai"),
  "https://generativelanguage.googleapis.com/v1beta/openai/images/generations",
);
assert.equal(
  getGenerationEndpoint("sub.tohoqing.com"),
  "https://sub.tohoqing.com/v1/images/generations",
);
assert.equal(
  getGeminiGenerationEndpoint(
    "https://generativelanguage.googleapis.com/v1beta/openai",
    "gemini-2.5-flash-image",
  ),
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
);
assert.equal(
  getGeminiGenerationEndpoint("https://sub.tohoqing.com/v1", "models/gemini-2.5-flash-image"),
  "https://sub.tohoqing.com/v1/images/generations",
);
assert.equal(
  getGenerationEndpointForModel("https://sub.tohoqing.com/v1", "gemini-3.1-flash-image"),
  "https://sub.tohoqing.com/v1/images/generations",
);
assert.equal(
  getGenerationEndpointForModel(
    "https://generativelanguage.googleapis.com/v1beta/openai",
    "gemini-3.1-flash-image",
  ),
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
);
assert.equal(getGeminiModeForBaseUrl("https://sub.tohoqing.com/v1"), "images");
assert.equal(getGeminiModeForBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai"), "native");
assert.equal(
  isGoogleGeminiEndpoint("https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-image:generateContent"),
  true,
);
assert.equal(isGoogleGeminiBaseUrl("https://sub.tohoqing.com/v1"), false);
assert.equal(isGoogleGeminiBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai"), true);
assert.deepEqual(buildGeminiGeneratePayload("画一只猫"), {
  contents: [
    {
      role: "user",
      parts: [{ text: "画一只猫" }],
    },
  ],
  generationConfig: {
    responseModalities: ["TEXT", "IMAGE"],
  },
});
assert.deepEqual(buildGeminiImagePayload("gemini-3.1-flash-image", "画一只猫", { n: 2, size: "1024x1024" }), {
  model: "gemini-3.1-flash-image",
  prompt: "画一只猫",
  response_format: "b64_json",
  n: 2,
  size: "1024x1024",
});
assert.deepEqual(
  extractGeminiImageItems({
    candidates: [
      {
        content: {
          parts: [
            { text: "ok" },
            { inlineData: { mimeType: "image/png", data: "iVBORw0KGgoAAA" } },
            { inline_data: { mime_type: "image/jpeg", data: "/9j/4AAQ" } },
          ],
        },
      },
    ],
  }),
  [
    { b64: "iVBORw0KGgoAAA", mimeType: "image/png", revisedPrompt: "ok" },
    { b64: "/9j/4AAQ", mimeType: "image/jpeg", revisedPrompt: "ok" },
  ],
);
assert.equal(classifyModelId("gpt-image-2"), "gpt");
assert.equal(classifyModelId("gemini-2.0-flash-preview-image-generation"), "gemini");
assert.equal(classifyModelId("imagen-4.0-generate-preview"), "gemini");

assert.equal(
  pickInitialModel(["gemini-2.0-flash-preview-image-generation", "gpt-image-2"]),
  "gpt-image-2",
);
assert.equal(
  pickInitialModel(["gemini-2.0-flash-preview-image-generation"], "gpt-image-2"),
  "gemini-2.0-flash-preview-image-generation",
);
assert.equal(
  pickInitialModel(["imagen-4.0-generate-preview", "gemini-2.0-flash-preview-image-generation"]),
  "imagen-4.0-generate-preview",
);
assert.equal(
  pickFetchedModel(["gpt-image-2", "gemini-2.0-flash-preview-image-generation"]),
  "gemini-2.0-flash-preview-image-generation",
);
assert.equal(
  pickFetchedModel(["gpt-image-2"]),
  "gpt-image-2",
);
assert.deepEqual(
  getModelSelectState(["gemini-2.0-flash-preview-image-generation"], "gpt-image-2"),
  {
    options: ["gemini-2.0-flash-preview-image-generation"],
    placeholder: "请选择已获取模型",
    disabled: false,
    selectedValue: "gemini-2.0-flash-preview-image-generation",
    lockInput: true,
  },
);
assert.deepEqual(
  getModelSelectState(["gpt-image-2"], "gemini-2.0-flash-preview-image-generation"),
  {
    options: ["gpt-image-2"],
    placeholder: "请选择已获取模型",
    disabled: false,
    selectedValue: "gpt-image-2",
    lockInput: true,
  },
);
assert.deepEqual(
  getModelSelectState([], "gpt-image-2"),
  {
    options: [],
    placeholder: "请先获取模型",
    disabled: true,
    selectedValue: "",
    lockInput: false,
  },
);

console.log("provider-utils tests passed");
