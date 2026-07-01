import assert from "node:assert/strict";
import {
  DEFAULT_BASE_URL,
  buildGeminiChatPayload,
  buildGeminiResponsesEditPayload,
  buildGeminiGeneratePayload,
  classifyModelId,
  extractChatCompletionImageItems,
  extractGeminiImageItems,
  extractModelIdsFromResponse,
  getChatCompletionsEndpoint,
  getGeminiModelsEndpoint,
  getGeminiGenerationEndpoint,
  getGenerationEndpointForModel,
  getGenerationEndpoint,
  getModelListEndpoints,
  getModelSelectState,
  getGeminiModeForBaseUrl,
  getImage2QualitySizeTier,
  getResponsesEndpoint,
  isPartialImageStreamPayload,
  normalizeImageOutputFormat,
  resolveImage2RequestSize,
  shouldTranscodeImageResult,
  isGoogleGeminiBaseUrl,
  isGoogleGeminiEndpoint,
  normalizeBaseUrl,
  pickInitialModel,
  pickFetchedModel,
  supportsImageGenerationModel,
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
  getChatCompletionsEndpoint("sub.tohoqing.com"),
  "https://sub.tohoqing.com/v1/chat/completions",
);
assert.equal(
  getResponsesEndpoint("sub.tohoqing.com"),
  "https://sub.tohoqing.com/v1/responses",
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
  "https://sub.tohoqing.com/v1beta/models/gemini-2.5-flash-image:generateContent",
);
assert.equal(
  getGenerationEndpointForModel("https://sub.tohoqing.com/v1", "gemini-3.1-flash-image"),
  "https://sub.tohoqing.com/v1beta/models/gemini-3.1-flash-image:generateContent",
);
assert.equal(
  getGenerationEndpointForModel(
    "https://generativelanguage.googleapis.com/v1beta/openai",
    "gemini-3.1-flash-image",
  ),
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
);
assert.equal(getGeminiModeForBaseUrl("https://sub.tohoqing.com/v1"), "native");
assert.equal(getGeminiModeForBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai"), "native");
assert.equal(
  getGeminiModelsEndpoint("https://sub.tohoqing.com/v1"),
  "https://sub.tohoqing.com/v1beta/models",
);
assert.deepEqual(getModelListEndpoints("https://sub.tohoqing.com/v1"), [
  "https://sub.tohoqing.com/v1/models",
  "https://sub.tohoqing.com/v1beta/models",
]);
assert.deepEqual(getModelListEndpoints("https://generativelanguage.googleapis.com/v1beta/openai"), [
  "https://generativelanguage.googleapis.com/v1beta/openai/models",
  "https://generativelanguage.googleapis.com/v1beta/models",
]);
assert.deepEqual(extractModelIdsFromResponse({
  data: [{ id: "gpt-image-2" }, { name: "gemini-3.1-flash-image" }],
}), ["gpt-image-2", "gemini-3.1-flash-image"]);
assert.deepEqual(extractModelIdsFromResponse({
  models: [{ name: "models/gemini-3.1-flash-image" }],
}), ["models/gemini-3.1-flash-image"]);
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
    imageConfig: {
      aspectRatio: "1:1",
    },
  },
});
assert.deepEqual(buildGeminiChatPayload("gemini-3.1-flash-image", "画一只猫"), {
  model: "gemini-3.1-flash-image",
  messages: [
    {
      role: "user",
      content: "画一只猫",
    },
  ],
  modalities: ["image", "text"],
  stream: false,
});
assert.deepEqual(
  buildGeminiResponsesEditPayload("gemini-3.1-flash-image", "加一颗红星", [
    "data:image/png;base64,iVBORw0KGgoAAA",
  ]),
  {
    model: "gemini-3.1-flash-image",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "加一颗红星 Respond with exactly one Markdown image using an inline data URL, no prose.",
          },
          {
            type: "input_image",
            image_url: "data:image/png;base64,iVBORw0KGgoAAA",
          },
        ],
      },
    ],
    stream: false,
  },
);
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
assert.deepEqual(
  extractGeminiImageItems({
    response: {
      candidates: [
        {
          content: {
            parts: [
              { text: "wrapped" },
              { inlineData: { mimeType: "image/png", data: "iVBORw0KGgoBBB" } },
            ],
          },
        },
      ],
    },
  }),
  [
    { b64: "iVBORw0KGgoBBB", mimeType: "image/png", revisedPrompt: "wrapped" },
  ],
);
assert.deepEqual(
  extractChatCompletionImageItems({
    choices: [
      {
        message: {
          content: "ok",
          images: [
            { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAA" } },
            { imageUrl: { url: "data:image/jpeg;base64,/9j/4AAQ" } },
          ],
        },
      },
    ],
  }),
  [
    { dataUrl: "data:image/png;base64,iVBORw0KGgoAAA", mimeType: "image/png", revisedPrompt: "ok" },
    { dataUrl: "data:image/jpeg;base64,/9j/4AAQ", mimeType: "image/jpeg", revisedPrompt: "ok" },
  ],
);
assert.deepEqual(
  extractChatCompletionImageItems({
    choices: [
      {
        message: {
          image: { image_url: { url: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4" } },
        },
      },
      {
        message: {
          content: "data:image/png;base64,iVBORw0KGgoAAA",
        },
      },
      {
        message: {
          content: "/9j/4AAQ",
        },
      },
    ],
  }),
  [
    { dataUrl: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4", mimeType: "image/webp", revisedPrompt: "" },
    { dataUrl: "data:image/png;base64,iVBORw0KGgoAAA", mimeType: "image/png", revisedPrompt: "" },
    { dataUrl: "data:image/png;base64,/9j/4AAQ", mimeType: "image/png", revisedPrompt: "" },
  ],
);
assert.deepEqual(
  extractChatCompletionImageItems({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "![image](data:image/jpeg;base64,/9j/4AAQ)",
          },
        ],
      },
    ],
  }),
  [
    { dataUrl: "data:image/jpeg;base64,/9j/4AAQ", mimeType: "image/jpeg", revisedPrompt: "" },
  ],
);
assert.equal(classifyModelId("gpt-image-2"), "gpt");
assert.equal(classifyModelId("gemini-2.0-flash-preview-image-generation"), "gemini");
assert.equal(classifyModelId("imagen-4.0-generate-preview"), "gemini");
assert.equal(supportsImageGenerationModel("gemini-2.5-flash"), false);
assert.equal(supportsImageGenerationModel("gemini-3.1-flash-image"), true);
assert.equal(supportsImageGenerationModel("gpt-5.2"), false);
assert.equal(supportsImageGenerationModel("gpt-image-2"), true);
assert.equal(getImage2QualitySizeTier("low"), "1K");
assert.equal(getImage2QualitySizeTier("medium"), "2K");
assert.equal(getImage2QualitySizeTier("high"), "4K");
assert.equal(getImage2QualitySizeTier("auto"), "");
assert.equal(resolveImage2RequestSize("low", "2048x2048"), "1024x1024");
assert.equal(resolveImage2RequestSize("medium", "2048x2048"), "2048x2048");
assert.equal(resolveImage2RequestSize("high", "2048x2048"), "2880x2880");
assert.equal(resolveImage2RequestSize("high", "2048x1152"), "3840x2160");
assert.equal(resolveImage2RequestSize("low", "2048x1152"), "1024x640");
assert.equal(resolveImage2RequestSize("high", "3840x512"), "3840x1280");
assert.equal(resolveImage2RequestSize("auto", "2048x2048"), "2048x2048");
assert.equal(resolveImage2RequestSize("auto", "auto"), "auto");
assert.equal(normalizeImageOutputFormat("jpg"), "jpeg");
assert.equal(normalizeImageOutputFormat("image/png"), "png");
assert.equal(normalizeImageOutputFormat("webp"), "webp");
assert.equal(normalizeImageOutputFormat("gif"), "");
assert.equal(shouldTranscodeImageResult("gpt", "png", "jpeg"), true);
assert.equal(shouldTranscodeImageResult("gpt", "jpeg", "jpg"), false);
assert.equal(shouldTranscodeImageResult("gpt", "png", "png"), false);
assert.equal(shouldTranscodeImageResult("gemini", "png", "jpeg"), false);
assert.equal(shouldTranscodeImageResult("gpt", "gif", "jpeg"), false);
assert.equal(isPartialImageStreamPayload({ type: "image_generation.partial_image", b64_json: "preview" }), true);
assert.equal(isPartialImageStreamPayload({ type: "image_edit.partial_image", b64_json: "preview" }), true);
assert.equal(
  isPartialImageStreamPayload({
    type: "response.image_generation_call.partial_image",
    partial_image_b64: "preview",
  }),
  true,
);
assert.equal(isPartialImageStreamPayload({ type: "image_generation.completed", b64_json: "final" }), false);
assert.equal(isPartialImageStreamPayload({ b64_json: "final" }), false);

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
