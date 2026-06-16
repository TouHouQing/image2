import assert from "node:assert/strict";
import {
  DEFAULT_BASE_URL,
  classifyModelId,
  getGenerationEndpoint,
  getModelSelectState,
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
    selectedValue: "",
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
