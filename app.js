import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  buildGeminiGeneratePayload,
  buildGeminiImagePayload,
  classifyModelId,
  extractGeminiImageItems,
  getEditEndpoint,
  getGeminiModeForBaseUrl,
  getGenerationEndpointForModel,
  getModelSelectState,
  getProviderForModel,
  isGoogleGeminiEndpoint,
  normalizeBaseUrl,
  pickFetchedModel,
  pickInitialModel,
  supportsImageGenerationModel,
} from "./provider-utils.js";

const SETTINGS_STORAGE_KEY = "toho-image-studio-settings";
const CACHE_ENABLED_STORAGE_KEY = "toho-image-studio-cache-enabled";
const LEGACY_API_KEY_STORAGE_KEY = "toho-image-studio-api-key";

const state = {
  mode: "generate",
  provider: "gpt",
  model: DEFAULT_MODEL,
  availableModels: [],
  apiKey: "",
  cacheEnabled: true,
  baseUrl: DEFAULT_BASE_URL,
  prompt: "",
  quality: "auto",
  size: "auto",
  output_format: "png",
  output_compression: 90,
  background: "auto",
  moderation: "auto",
  n: 1,
  stream: false,
  partial_images: 0,
  user: "",
  customWidth: 1024,
  customHeight: 1024,
  references: [],
  results: [],
  selectedResultId: null,
  maskDirty: false,
  maskHistory: [],
  brushSize: 48,
  isRunning: false,
};

const presets = {
  balanced: {
    quality: "auto",
    size: "auto",
    output_format: "png",
    background: "auto",
    moderation: "auto",
    output_compression: 90,
  },
  fast: {
    quality: "low",
    size: "1024x1024",
    output_format: "jpeg",
    background: "opaque",
    moderation: "auto",
    output_compression: 82,
  },
  detail: {
    quality: "high",
    size: "1536x1024",
    output_format: "png",
    background: "opaque",
    moderation: "auto",
    output_compression: 92,
  },
  shop: {
    quality: "high",
    size: "1024x1024",
    output_format: "webp",
    background: "opaque",
    moderation: "low",
    output_compression: 88,
  },
};

const recipeFragments = [
  "主体居中，边缘干净，适合电商主图，阴影自然。",
  "保留原图人物身份、服装材质和面部结构，只调整背景与光线。",
  "高端杂志摄影，柔和侧光，细节锐利但不过度磨皮。",
  "不要生成文字、水印、Logo 或多余肢体。",
  "统一色温，背景虚化，主体轮廓清晰。",
  "只修改涂抹区域，未涂抹区域保持完全不变。",
];

const elements = {
  apiKeyInput: document.querySelector("#apiKeyInput"),
  rememberKeyToggle: document.querySelector("#rememberKeyToggle"),
  toggleKeyButton: document.querySelector("#toggleKeyButton"),
  connectionPill: document.querySelector("#connectionPill"),
  connectionText: document.querySelector("#connectionText"),
  resetWorkspaceButton: document.querySelector("#resetWorkspaceButton"),
  promptInput: document.querySelector("#promptInput"),
  promptLabel: document.querySelector("#promptLabel"),
  runButton: document.querySelector("#runButton"),
  runButtonText: document.querySelector("#runButtonText"),
  customSizeRow: document.querySelector("#customSizeRow"),
  customWidthInput: document.querySelector("#customWidthInput"),
  customHeightInput: document.querySelector("#customHeightInput"),
  countInput: document.querySelector("#countInput"),
  countMinusButton: document.querySelector("#countMinusButton"),
  countPlusButton: document.querySelector("#countPlusButton"),
  compressionBlock: document.querySelector("#compressionBlock"),
  compressionInput: document.querySelector("#compressionInput"),
  testEndpointButton: document.querySelector("#testEndpointButton"),
  modelSelect: document.querySelector("#modelSelect"),
  modelInput: document.querySelector("#modelInput"),
  modelProviderPill: document.querySelector("#modelProviderPill"),
  modelProviderText: document.querySelector("#modelProviderText"),
  modelSummaryText: document.querySelector("#modelSummaryText"),
  userTagInput: document.querySelector("#userTagInput"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  noticeBar: document.querySelector("#noticeBar"),
  progressBar: document.querySelector("#progressBar"),
  emptyState: document.querySelector("#emptyState"),
  resultGrid: document.querySelector("#resultGrid"),
  resultCardTemplate: document.querySelector("#resultCardTemplate"),
  downloadSelectedButton: document.querySelector("#downloadSelectedButton"),
  useSelectedForEditButton: document.querySelector("#useSelectedForEditButton"),
  stageTitle: document.querySelector("#stageTitle"),
  imageUploadInput: document.querySelector("#imageUploadInput"),
  dropzone: document.querySelector("#dropzone"),
  referenceList: document.querySelector("#referenceList"),
  clearReferencesButton: document.querySelector("#clearReferencesButton"),
  apiBaseText: document.querySelector("#apiBaseText"),
  generateEndpointText: document.querySelector("#generateEndpointText"),
  editEndpointText: document.querySelector("#editEndpointText"),
  generateCurlCode: document.querySelector("#generateCurlCode"),
  editCurlCode: document.querySelector("#editCurlCode"),
  copyGenerateCurlButton: document.querySelector("#copyGenerateCurlButton"),
  copyEditCurlButton: document.querySelector("#copyEditCurlButton"),
  copyQqButton: document.querySelector("#copyQqButton"),
  historyList: document.querySelector("#historyList"),
  historyCounter: document.querySelector("#historyCounter"),
  recipeList: document.querySelector("#recipeList"),
  maskWorkbench: document.querySelector("#maskWorkbench"),
  canvasWrap: document.querySelector("#canvasWrap"),
  sourceCanvas: document.querySelector("#sourceCanvas"),
  maskCanvas: document.querySelector("#maskCanvas"),
  clearMaskButton: document.querySelector("#clearMaskButton"),
  undoMaskButton: document.querySelector("#undoMaskButton"),
  brushSizeInput: document.querySelector("#brushSizeInput"),
  maskPaintState: document.querySelector("#maskPaintState"),
};

const sourceCtx = elements.sourceCanvas.getContext("2d");
const maskCtx = elements.maskCanvas.getContext("2d");
let activePointerId = null;
let activeReferenceObjectUrl = null;
let hasHydratedCache = false;

function init() {
  loadCachedState();
  hasHydratedCache = true;
  renderRecipeChips();
  bindEvents();
  syncControlsFromState();
  renderAll();
}

function bindEvents() {
  elements.apiKeyInput.addEventListener("input", (event) => {
    state.apiKey = event.target.value.trim();
    persistBrowserCache();
    renderConnection();
  });

  elements.rememberKeyToggle.addEventListener("change", (event) => {
    state.cacheEnabled = event.target.checked;
    if (state.cacheEnabled) {
      persistBrowserCache();
    } else {
      clearBrowserCache();
    }
    renderConnection();
  });

  elements.toggleKeyButton.addEventListener("click", () => {
    elements.apiKeyInput.type = elements.apiKeyInput.type === "password" ? "text" : "password";
  });

  elements.resetWorkspaceButton.addEventListener("click", resetWorkspace);

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      renderAll();
    });
  });

  elements.promptInput.addEventListener("input", (event) => {
    state.prompt = event.target.value;
    persistBrowserCache();
    updateApiGuide();
  });

  document.querySelectorAll("[data-template]").forEach((button) => {
    button.addEventListener("click", () => appendPromptFragment(button.dataset.template));
  });

  document.querySelectorAll("[data-setting]").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest(".choice-chip");
      if (!button || button.classList.contains("disabled")) return;
      state[group.dataset.setting] = coerceSettingValue(group.dataset.setting, button.dataset.value);
      syncControlsFromState();
      renderParameterButtons();
    });
  });

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPreset = presets[button.dataset.preset];
      Object.assign(state, nextPreset);
      document.querySelectorAll("[data-preset]").forEach((presetButton) => {
        presetButton.classList.toggle("active", presetButton === button);
      });
      syncControlsFromState();
      renderParameterButtons();
    });
  });

  elements.customWidthInput.addEventListener("input", (event) => {
    state.customWidth = Number(event.target.value);
    syncControlsFromState();
  });

  elements.customHeightInput.addEventListener("input", (event) => {
    state.customHeight = Number(event.target.value);
    syncControlsFromState();
  });

  elements.countInput.addEventListener("input", (event) => {
    state.n = Number(event.target.value);
    syncControlsFromState();
    renderParameterButtons();
  });

  elements.countMinusButton.addEventListener("click", () => {
    state.n = Math.max(1, state.n - 1);
    syncControlsFromState();
    renderParameterButtons();
  });

  elements.countPlusButton.addEventListener("click", () => {
    state.n = Math.min(10, state.n + 1);
    syncControlsFromState();
    renderParameterButtons();
  });

  elements.compressionInput.addEventListener("input", (event) => {
    state.output_compression = Number(event.target.value);
    syncControlsFromState();
    renderParameterButtons();
  });

  elements.userTagInput.addEventListener("input", (event) => {
    state.user = event.target.value.trim();
    persistBrowserCache();
    updateApiGuide();
  });

  elements.baseUrlInput.addEventListener("input", (event) => {
    state.baseUrl = event.target.value.trim() || DEFAULT_BASE_URL;
    persistBrowserCache();
    updateApiGuide();
  });

  elements.baseUrlInput.addEventListener("blur", () => {
    state.baseUrl = normalizeBaseUrl(elements.baseUrlInput.value);
    syncControlsFromState();
  });

  elements.testEndpointButton.addEventListener("click", testEndpoint);
  elements.modelSelect.addEventListener("change", (event) => {
    state.model = event.target.value || DEFAULT_MODEL;
    applyProviderFromModel();
    syncControlsFromState();
    renderAll();
  });
  elements.modelInput.addEventListener("input", (event) => {
    state.model = event.target.value.trim() || DEFAULT_MODEL;
    applyProviderFromModel();
    renderAll();
  });
  elements.copyGenerateCurlButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyGuideText(elements.generateCurlCode.textContent, elements.copyGenerateCurlButton);
  });
  elements.copyEditCurlButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyGuideText(elements.editCurlCode.textContent, elements.copyEditCurlButton);
  });
  elements.copyQqButton.addEventListener("click", () => {
    copyGuideText(elements.copyQqButton.dataset.copyValue, elements.copyQqButton);
  });

  elements.runButton.addEventListener("click", runImageRequest);
  elements.downloadSelectedButton.addEventListener("click", downloadSelected);
  elements.useSelectedForEditButton.addEventListener("click", useSelectedForEdit);
  elements.imageUploadInput.addEventListener("change", (event) => handleFiles(event.target.files));
  elements.clearReferencesButton.addEventListener("click", clearReferences);
  elements.clearMaskButton.addEventListener("click", clearMask);
  elements.undoMaskButton.addEventListener("click", undoMask);

  elements.brushSizeInput.addEventListener("input", (event) => {
    state.brushSize = Number(event.target.value);
    persistBrowserCache();
  });

  ["dragenter", "dragover"].forEach((type) => {
    elements.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    elements.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("dragging");
    });
  });

  elements.dropzone.addEventListener("drop", (event) => {
    handleFiles(event.dataTransfer.files);
  });

  elements.maskCanvas.addEventListener("pointerdown", startMaskStroke);
  elements.maskCanvas.addEventListener("pointermove", continueMaskStroke);
  elements.maskCanvas.addEventListener("pointerup", finishMaskStroke);
  elements.maskCanvas.addEventListener("pointercancel", finishMaskStroke);
  window.addEventListener("resize", () => renderMaskWorkbench());
}

function renderConnection() {
  elements.connectionPill.classList.remove("ready", "error");
  if (state.apiKey) {
    elements.connectionPill.classList.add("ready");
    elements.connectionText.textContent = state.availableModels.length
      ? `${state.availableModels.length} 个模型`
      : "Key 已就绪";
  } else {
    elements.connectionText.textContent = "等待 API Key";
  }
}

function loadCachedState() {
  const cachePreference = localStorage.getItem(CACHE_ENABLED_STORAGE_KEY);
  state.cacheEnabled = cachePreference !== "false";

  if (!state.cacheEnabled) {
    clearBrowserCache();
    return;
  }

  try {
    const cached = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    applyCachedState(cached);
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  }

  const legacyApiKey = localStorage.getItem(LEGACY_API_KEY_STORAGE_KEY);
  if (legacyApiKey && !state.apiKey) {
    state.apiKey = legacyApiKey;
  }
  localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
}

function applyCachedState(cached) {
  if (!cached || typeof cached !== "object") return;

  state.apiKey = typeof cached.apiKey === "string" ? cached.apiKey : state.apiKey;
  state.baseUrl = typeof cached.baseUrl === "string" ? normalizeBaseUrl(cached.baseUrl) : state.baseUrl;
  state.model = typeof cached.model === "string" && cached.model ? cached.model : state.model;
  state.provider = ["gpt", "gemini"].includes(cached.provider) ? cached.provider : classifyModelId(state.model);
  state.availableModels = Array.isArray(cached.availableModels)
    ? cached.availableModels.filter((model) => typeof model === "string" && model)
    : state.availableModels;
  state.prompt = typeof cached.prompt === "string" ? cached.prompt : state.prompt;
  state.quality = ["auto", "low", "medium", "high"].includes(cached.quality)
    ? cached.quality
    : state.quality;
  state.size = isSupportedSize(cached.size) ? cached.size : state.size;
  state.output_format = ["png", "jpeg", "webp"].includes(cached.output_format)
    ? cached.output_format
    : state.output_format;
  state.output_compression = clampNumber(cached.output_compression, 0, 100, state.output_compression);
  state.background = ["auto", "opaque"].includes(cached.background) ? cached.background : state.background;
  state.moderation = ["auto", "low"].includes(cached.moderation) ? cached.moderation : state.moderation;
  state.n = clampNumber(cached.n, 1, 10, state.n);
  state.stream = typeof cached.stream === "boolean" ? cached.stream : state.stream;
  state.partial_images = clampNumber(cached.partial_images, 0, 3, state.partial_images);
  state.user = typeof cached.user === "string" ? cached.user : state.user;
  state.customWidth = clampNumber(cached.customWidth, 256, 3840, state.customWidth);
  state.customHeight = clampNumber(cached.customHeight, 256, 3840, state.customHeight);
  state.brushSize = clampNumber(cached.brushSize, 8, 160, state.brushSize);
}

function persistBrowserCache() {
  if (!hasHydratedCache) return;

  localStorage.setItem(CACHE_ENABLED_STORAGE_KEY, state.cacheEnabled ? "true" : "false");
  if (!state.cacheEnabled) {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
    return;
  }

  const cachePayload = {
    apiKey: state.apiKey,
    baseUrl: normalizeBaseUrl(state.baseUrl),
    provider: state.provider,
    model: state.model,
    availableModels: state.availableModels,
    prompt: state.prompt,
    quality: state.quality,
    size: state.size,
    output_format: state.output_format,
    output_compression: state.output_compression,
    background: state.background,
    moderation: state.moderation,
    n: state.n,
    stream: state.stream,
    partial_images: state.partial_images,
    user: state.user,
    customWidth: state.customWidth,
    customHeight: state.customHeight,
    brushSize: state.brushSize,
  };

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cachePayload));
  localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
}

function clearBrowserCache() {
  localStorage.setItem(CACHE_ENABLED_STORAGE_KEY, "false");
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
}

function renderAll() {
  applyProviderFromModel();
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.mode);
  });

  const isEdit = state.mode === "edit";
  const canEdit = supportsEditing();
  document.querySelectorAll(".edit-only").forEach((node) => {
    node.hidden = !isEdit || !canEdit;
  });
  document.querySelector('[data-mode="edit"]').disabled = !canEdit;
  document.querySelector('[data-mode="edit"]').title = canEdit ? "" : "Gemini 模式暂不支持此编辑工作流";
  document.querySelectorAll('[data-provider-only="gpt"]').forEach((node) => {
    node.hidden = state.provider !== "gpt";
  });

  elements.promptLabel.textContent = isEdit ? "编辑提示词" : "提示词";
  elements.stageTitle.textContent = isEdit ? "编辑工作区" : "生成结果";
  elements.runButtonText.textContent = isEdit ? "编辑图片" : "生成图片";
  elements.maskWorkbench.hidden = !isEdit || !canEdit || state.references.length === 0;

  renderConnection();
  renderModelSelect();
  renderParameterButtons();
  syncControlsFromState();
  renderReferences();
  renderResults();
  renderHistory();
  renderMaskWorkbench();
}

function syncControlsFromState() {
  applyProviderFromModel();
  elements.apiKeyInput.value = state.apiKey;
  elements.rememberKeyToggle.checked = state.cacheEnabled;
  elements.promptInput.value = state.prompt;
  if (document.activeElement !== elements.modelInput && elements.modelInput.value !== state.model) {
    elements.modelInput.value = state.model;
  }
  elements.countInput.value = String(state.n);
  document.querySelector("#countOutput").textContent = String(state.n);
  elements.compressionInput.value = String(state.output_compression);
  document.querySelector("#compressionOutput").textContent = String(state.output_compression);
  elements.customWidthInput.value = String(state.customWidth);
  elements.customHeightInput.value = String(state.customHeight);
  elements.customSizeRow.hidden = state.size !== "custom";
  elements.compressionBlock.hidden = state.provider !== "gpt" || state.output_format === "png";
  elements.userTagInput.value = state.user;
  elements.baseUrlInput.value = normalizeBaseUrl(state.baseUrl);
  state.baseUrl = elements.baseUrlInput.value;
  elements.brushSizeInput.value = String(state.brushSize);

  document.querySelector("#qualityOutput").textContent = state.quality;
  document.querySelector("#sizeOutput").textContent = getResolvedSize();
  document.querySelector("#formatOutput").textContent = state.output_format;
  document.querySelector("#backgroundOutput").textContent = state.background;
  document.querySelector("#moderationOutput").textContent = state.moderation;
  document.querySelector("#streamOutput").textContent = state.stream ? "on" : "off";
  document.querySelector("#partialImagesOutput").textContent = String(state.partial_images);
  document.querySelector("#fidelityOutput").textContent = `${state.model} 高保真`;
  renderProviderSummary();
  updateApiGuide();
  persistBrowserCache();
}

function applyProviderFromModel() {
  if (state.availableModels.length && !state.availableModels.includes(state.model)) {
    state.model = pickFetchedModel(state.availableModels);
  }
  state.provider = classifyModelId(state.model);
  if (state.provider !== "gpt") {
    state.mode = "generate";
    state.stream = false;
    state.partial_images = 0;
  }
}

function supportsEditing() {
  return getProviderForModel(state.model).editable;
}

function renderModelSelect() {
  const selectState = getModelSelectState(state.availableModels, state.model);
  if (selectState.selectedValue && selectState.selectedValue !== state.model) {
    state.model = selectState.selectedValue;
    applyProviderFromModel();
  }
  elements.modelSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = selectState.placeholder;
  elements.modelSelect.append(placeholder);
  selectState.options.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    elements.modelSelect.append(option);
  });
  elements.modelSelect.disabled = selectState.disabled;
  elements.modelSelect.value = selectState.selectedValue;
  elements.modelInput.readOnly = selectState.lockInput;
  elements.modelInput.title = selectState.lockInput ? "已根据获取到的模型锁定；如需切换请使用模型下拉" : "";
}

function renderProviderSummary() {
  const provider = getProviderForModel(state.model);
  elements.modelProviderPill.dataset.provider = provider.id;
  elements.modelProviderText.textContent = provider.label;
  const geminiMode = getGeminiModeForBaseUrl(state.baseUrl);
  elements.modelSummaryText.textContent =
    provider.id === "gemini"
      ? geminiMode === "native"
        ? "Gemini 生图使用 Google 原生 generateContent；编辑、流式预览和 image2 专属参数已自动收起。"
        : "Gemini 生图使用当前接口的 /images/generations 兼容层；编辑、流式预览和 image2 专属参数已自动收起。"
      : "Image2 模式支持生成、参考图编辑、遮罩编辑和完整 image2 参数。";
}

function renderParameterButtons() {
  document.querySelectorAll("[data-setting]").forEach((group) => {
    const setting = group.dataset.setting;
    group.querySelectorAll(".choice-chip").forEach((button) => {
      button.classList.toggle("active", button.dataset.value === String(state[setting]));
    });
  });
}

function coerceSettingValue(setting, value) {
  if (setting === "stream") return value === "true";
  if (["n", "output_compression", "partial_images"].includes(setting)) return Number(value);
  return value;
}

function renderRecipeChips() {
  elements.recipeList.innerHTML = "";
  recipeFragments.forEach((fragment) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recipe-chip";
    button.textContent = fragment;
    button.addEventListener("click", () => appendPromptFragment(fragment));
    elements.recipeList.append(button);
  });
}

function appendPromptFragment(fragment) {
  const prefix = state.prompt.trim() ? "\n" : "";
  state.prompt = `${state.prompt}${prefix}${fragment}`;
  elements.promptInput.value = state.prompt;
  elements.promptInput.focus();
  updateApiGuide();
  persistBrowserCache();
}

async function handleFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    const id = crypto.randomUUID();
    state.references.push({
      id,
      file,
      dataUrl,
      name: file.name || `reference-${state.references.length + 1}`,
      size: file.size,
      type: file.type || "image/png",
    });
  }

  state.mode = "edit";
  state.maskDirty = false;
  state.maskHistory = [];
  renderAll();
}

function clearReferences() {
  state.references = [];
  state.maskDirty = false;
  state.maskHistory = [];
  if (activeReferenceObjectUrl) URL.revokeObjectURL(activeReferenceObjectUrl);
  activeReferenceObjectUrl = null;
  renderAll();
}

function renderReferences() {
  elements.referenceList.innerHTML = "";

  if (!state.references.length) {
    const empty = document.createElement("p");
    empty.className = "reference-empty";
    empty.textContent = "编辑模式下至少需要一张参考图。";
    empty.style.color = "var(--ink-muted)";
    empty.style.fontSize = "0.8rem";
    empty.style.margin = "0";
    elements.referenceList.append(empty);
    return;
  }

  state.references.forEach((reference, index) => {
    const row = document.createElement("div");
    row.className = `reference-item${index === 0 ? " primary" : ""}`;

    const image = document.createElement("img");
    image.src = reference.dataUrl;
    image.alt = reference.name;

    const info = document.createElement("div");
    info.className = "reference-info";
    info.innerHTML = `<strong>${escapeHtml(reference.name)}</strong><span>${formatBytes(reference.size)}</span>`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-button compact";
    removeButton.title = "移除参考图";
    removeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg><span class="sr-only">移除参考图</span>';
    removeButton.addEventListener("click", () => {
      state.references = state.references.filter((item) => item.id !== reference.id);
      state.maskDirty = false;
      state.maskHistory = [];
      renderAll();
    });

    row.append(image, info, removeButton);
    elements.referenceList.append(row);
  });
}

function renderResults() {
  elements.resultGrid.innerHTML = "";
  elements.emptyState.hidden = state.results.length > 0 || state.mode === "edit";
  elements.downloadSelectedButton.disabled = !state.selectedResultId;
  elements.useSelectedForEditButton.disabled = !state.selectedResultId || !supportsEditing();
  elements.useSelectedForEditButton.title = supportsEditing()
    ? ""
    : "切换到 image2 模型后可将结果作为编辑参考";

  state.results.forEach((result, index) => {
    const fragment = elements.resultCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".result-card");
    const button = fragment.querySelector(".result-preview");
    const image = fragment.querySelector("img");
    const time = fragment.querySelector(".result-time");
    const downloadButton = fragment.querySelector(".result-download");
    const editButton = fragment.querySelector(".result-edit");

    card.style.animationDelay = `${Math.min(index * 45, 240)}ms`;
    card.classList.toggle("selected", result.id === state.selectedResultId);
    image.src = result.dataUrl;
    image.alt = result.revisedPrompt || result.prompt || "生成结果";
    time.textContent = new Date(result.createdAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    button.addEventListener("click", () => {
      state.selectedResultId = result.id;
      renderResults();
    });
    downloadButton.addEventListener("click", () => downloadResult(result));
    editButton.disabled = !supportsEditing();
    editButton.title = supportsEditing() ? "作为编辑参考" : "切换到 image2 模型后可编辑";
    editButton.addEventListener("click", () => useResultForEdit(result));
    elements.resultGrid.append(fragment);
  });
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  elements.historyCounter.textContent = String(state.results.length);

  state.results.slice(0, 8).forEach((result) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "history-item";
    row.innerHTML = `
      <img src="${result.dataUrl}" alt="">
      <span class="history-info">
        <strong>${escapeHtml(result.mode === "edit" ? "编辑结果" : "生成结果")}</strong>
        <span>${escapeHtml(result.model || DEFAULT_MODEL)} · ${escapeHtml(result.size || "auto")} · ${escapeHtml(result.format)}</span>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    `;
    row.addEventListener("click", () => {
      state.selectedResultId = result.id;
      renderResults();
      elements.resultGrid.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    elements.historyList.append(row);
  });
}

async function runImageRequest() {
  hideNotice();
  const validationError = validateRequest();
  if (validationError) {
    showNotice(validationError, "error");
    return;
  }

  setRunning(true);
  try {
    if (state.mode === "edit") {
      await editImages();
    } else {
      await generateImages();
    }
    showNotice("图片已生成。可以下载，或直接作为下一次编辑参考。", "success");
  } catch (error) {
    showNotice(formatRequestError(error), "error");
    elements.connectionPill.classList.add("error");
  } finally {
    setRunning(false);
  }
}

function validateRequest() {
  state.prompt = elements.promptInput.value.trim();
  state.apiKey = elements.apiKeyInput.value.trim();
  state.baseUrl = normalizeBaseUrl(elements.baseUrlInput.value);
  elements.baseUrlInput.value = state.baseUrl;
  persistBrowserCache();

  if (!state.apiKey) return "请输入 API Key。";
  if (!state.prompt) return "请输入提示词。";
  if (state.size === "custom") {
    const sizeError = validateCustomSize(state.customWidth, state.customHeight);
    if (sizeError) return sizeError;
  }
  if (state.background === "transparent") {
    return "gpt-image-2 当前不支持 transparent 背景，请选择 auto 或 opaque。";
  }
  if (state.mode === "edit" && !supportsEditing()) {
    return "当前模型不支持此编辑工作流，请切换到 image2 模型后再编辑。";
  }
  if (state.mode === "edit" && !state.references.length) {
    return "编辑模式需要至少上传一张参考图。";
  }
  return "";
}

async function generateImages() {
  const endpoint = getGenerationEndpointForModel(state.baseUrl, state.model);
  const body = buildGeneratePayload();

  if (state.stream) {
    const streamedResults = await requestStreamingGenerateImages(endpoint, body, "generate");
    if (streamedResults.length) {
      return;
    }
  }

  const responseJson = await postGenerate(endpoint, body);
  addResults(parseImageResponseOrThrow(responseJson, state.prompt, "generate"));
}

async function editImages() {
  const formData = new FormData();
  formData.append("model", state.model);
  formData.append("prompt", state.prompt);
  appendOptionalFormData(formData, "n", state.n);
  appendOptionalFormData(formData, "size", getResolvedSize());
  appendOptionalFormData(formData, "quality", state.quality);
  appendOptionalFormData(formData, "output_format", state.output_format);
  appendOptionalFormData(formData, "background", state.background);
  appendOptionalFormData(formData, "moderation", state.moderation);
  appendOptionalFormData(formData, "user", state.user);

  if (state.output_format !== "png") {
    formData.append("output_compression", String(state.output_compression));
  }
  if (state.stream) {
    formData.append("stream", "true");
    formData.append("partial_images", String(state.partial_images));
  }

  const imageKey = state.references.length > 1 ? "image[]" : "image";
  state.references.forEach((reference) => {
    formData.append(imageKey, reference.file, reference.name);
  });

  const maskBlob = await getMaskBlobIfNeeded();
  if (maskBlob) {
    formData.append("mask", maskBlob, "mask.png");
  }

  const endpoint = getEditEndpoint(state.baseUrl);
  if (state.stream) {
    const streamedResults = await requestStreamingFormImages(endpoint, formData, "edit");
    if (streamedResults.length) return;
  }

  const responseJson = await postForm(endpoint, formData);
  addResults(parseImageResponseOrThrow(responseJson, state.prompt, "edit"));
}

function buildGeneratePayload() {
  if (state.provider === "gemini") {
    return getGeminiModeForBaseUrl(state.baseUrl) === "native"
      ? buildGeminiGeneratePayload(state.prompt)
      : buildGeminiImagePayload(state.model, state.prompt, getGeminiImageOptions());
  }

  const payload = {
    model: state.model,
    prompt: state.prompt,
    n: state.n,
    size: getResolvedSize(),
    quality: state.quality,
    output_format: state.output_format,
    background: state.background,
    moderation: state.moderation,
  };

  if (state.output_format !== "png") {
    payload.output_compression = state.output_compression;
  }
  if (state.stream) {
    payload.stream = true;
    payload.partial_images = state.partial_images;
  }
  if (state.user) {
    payload.user = state.user;
  }

  return payload;
}

function getGeminiImageOptions() {
  const size = getResolvedSize();
  return {
    n: state.n,
    size,
  };
}

function updateApiGuide() {
  const baseUrl = normalizeBaseUrl(state.baseUrl);
  const generationUrl = getGenerationEndpointForModel(baseUrl, state.model);
  const editUrl = getEditEndpoint(baseUrl);
  const prompt = state.prompt.trim() || "一只白色陶瓷杯，电商主图，干净背景";
  const generatePayload = state.provider === "gemini"
    ? (getGeminiModeForBaseUrl(baseUrl) === "native"
      ? buildGeminiGeneratePayload(prompt)
      : buildGeminiImagePayload(state.model, prompt, getGeminiImageOptions()))
    : {
    ...buildGeneratePayload(),
    prompt,
  };

  elements.apiBaseText.textContent = baseUrl;
  elements.generateEndpointText.textContent = generationUrl;
  elements.editEndpointText.textContent = supportsEditing() ? editUrl : "当前 Gemini 模型不支持编辑工作流";
  elements.generateCurlCode.textContent = buildGenerateCurl(generationUrl, generatePayload);
  elements.editCurlCode.textContent = supportsEditing()
    ? buildEditCurl(editUrl, prompt)
    : "Gemini 模式下请使用生成调用；如需参考图编辑，请在模型下拉中选择 image2 模型。";
}

function buildGenerateCurl(endpoint, payload) {
  const authHeader = isGoogleGeminiEndpoint(endpoint)
    ? '  -H "x-goog-api-key: $API_KEY" \\'
    : '  -H "Authorization: Bearer $API_KEY" \\';
  return [
    'export API_KEY="你的 API Key"',
    `curl "${endpoint}" \\`,
    authHeader,
    '  -H "Content-Type: application/json" \\',
    `  -d '${JSON.stringify(payload, null, 2)}'`,
  ].join("\n");
}

function buildEditCurl(endpoint, prompt) {
  const lines = [
    'export API_KEY="你的 API Key"',
    `curl "${endpoint}" \\`,
    '  -H "Authorization: Bearer $API_KEY" \\',
    `  -F model="${state.model}" \\`,
    `  -F prompt="${escapeCurlFormValue(prompt)}" \\`,
    '  -F image="@/path/to/reference.png" \\',
    `  -F size="${getResolvedSize()}" \\`,
    `  -F quality="${state.quality}" \\`,
    `  -F output_format="${state.output_format}" \\`,
    `  -F background="${state.background}" \\`,
    `  -F moderation="${state.moderation}"`,
  ];

  if (state.output_format !== "png") {
    lines[lines.length - 1] += " \\";
    lines.push(`  -F output_compression="${state.output_compression}"`);
  }

  return lines.join("\n");
}

function escapeCurlFormValue(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function copyGuideText(text, button) {
  const originalText = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "已复制";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    button.textContent = "已复制";
  }

  window.setTimeout(() => {
    button.textContent = originalText;
  }, 1400);
}

async function postGenerate(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isGoogleGeminiEndpoint(endpoint)
        ? { "x-goog-api-key": state.apiKey }
        : { Authorization: `Bearer ${state.apiKey}` }),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  return response.json();
}

async function postForm(endpoint, formData) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  return response.json();
}

async function requestStreamingJsonImages(endpoint, payload, mode) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isGoogleGeminiEndpoint(endpoint)
        ? { "x-goog-api-key": state.apiKey }
        : { Authorization: `Bearer ${state.apiKey}` }),
    },
    body: JSON.stringify(payload),
  });

  return readStreamingImageResponse(response, mode);
}

async function requestStreamingGenerateImages(endpoint, payload, mode) {
  return requestStreamingJsonImages(endpoint, payload, mode);
}

async function requestStreamingFormImages(endpoint, formData, mode) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.apiKey}`,
    },
    body: formData,
  });

  return readStreamingImageResponse(response, mode);
}

async function readStreamingImageResponse(response, mode) {
  if (!response.ok) {
    throw await readApiError(response);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    const items = parseImageResponseOrThrow(await response.json(), state.prompt, mode);
    addResults(items);
    return items;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const completed = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const eventChunk of events) {
      const parsed = parseSseEvent(eventChunk);
      if (!parsed) continue;
      const items = parseImageResponse(parsed, state.prompt, mode, true);
      if (items.length) {
        addResults(items);
        completed.push(...items);
      }
    }
  }

  return completed;
}

function parseSseEvent(eventChunk) {
  const dataLine = eventChunk
    .split("\n")
    .find((line) => line.startsWith("data:"));
  if (!dataLine) return null;

  const raw = dataLine.replace(/^data:\s*/, "").trim();
  if (!raw || raw === "[DONE]") return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseImageResponse(responseJson, prompt, mode, fromStream = false) {
  const geminiItems = extractGeminiImageItems(responseJson);
  if (geminiItems.length) {
    return geminiItems.map((item) => ({
      id: crypto.randomUUID(),
      mode,
      provider: state.provider,
      model: state.model,
      prompt,
      revisedPrompt: item.revisedPrompt || "",
      dataUrl: `data:${item.mimeType || "image/png"};base64,${item.b64}`,
      format: inferImageFormat(item.b64, "") || mimeTypeToFormat(item.mimeType) || state.output_format,
      size: getResolvedSize(),
      createdAt: Date.now(),
      fromStream,
    }));
  }

  const possibleData = [];
  if (Array.isArray(responseJson?.data)) possibleData.push(...responseJson.data);
  if (Array.isArray(responseJson?.error?.data)) possibleData.push(...responseJson.error.data);
  if (responseJson?.b64_json) possibleData.push(responseJson);
  if (responseJson?.error?.b64_json) possibleData.push(responseJson.error);
  if (responseJson?.partial_image_b64) possibleData.push({ b64_json: responseJson.partial_image_b64 });
  if (responseJson?.image?.b64_json) possibleData.push(responseJson.image);
  if (responseJson?.result?.b64_json) possibleData.push(responseJson.result);

  return possibleData
    .map((item) => {
      const b64 = item.b64_json || item.image_base64 || item.base64 || item.partial_image_b64;
      const url = item.url;
      if (!b64 && !url) return null;
      const inferredFormat = inferImageFormat(b64, url) || state.output_format;
      return {
        id: crypto.randomUUID(),
        mode,
        provider: state.provider,
        model: state.model,
        prompt,
        revisedPrompt: item.revised_prompt || responseJson.revised_prompt || "",
        dataUrl: b64 ? `data:image/${inferredFormat};base64,${b64}` : url,
        format: inferredFormat,
        size: getResolvedSize(),
        createdAt: Date.now(),
        fromStream,
      };
    })
    .filter(Boolean);
}

function mimeTypeToFormat(mimeType) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpeg";
  if (normalized.includes("webp")) return "webp";
  return "";
}

function parseImageResponseOrThrow(responseJson, prompt, mode, fromStream = false) {
  const items = parseImageResponse(responseJson, prompt, mode, fromStream);
  if (items.length) return items;

  const message = responseJson?.error?.message || responseJson?.message;
  if (message) throw new Error(message);
  throw new Error("API 没有返回图片数据。");
}

function inferImageFormat(b64, url) {
  if (b64?.startsWith("iVBORw0KGgo")) return "png";
  if (b64?.startsWith("/9j/")) return "jpeg";
  if (b64?.startsWith("UklGR")) return "webp";

  const match = String(url || "").match(/\.(png|jpe?g|webp)(?:[?#]|$)/i);
  if (!match) return "";
  return match[1].toLowerCase().replace("jpg", "jpeg");
}

function addResults(results) {
  if (!results.length) {
    throw new Error("API 没有返回图片数据。");
  }

  state.results = [...results, ...state.results];
  state.selectedResultId = results[0].id;
  renderResults();
  renderHistory();
}

async function readApiError(response) {
  let bodyText = "";
  try {
    bodyText = await response.text();
    const parsed = JSON.parse(bodyText);
    const message = parsed?.error?.message || parsed?.message || response.statusText;
    return new Error(`${response.status} ${message}`);
  } catch {
    return new Error(`${response.status} ${bodyText || response.statusText}`);
  }
}

async function testEndpoint() {
  hideNotice();
  state.apiKey = elements.apiKeyInput.value.trim();
  state.baseUrl = normalizeBaseUrl(elements.baseUrlInput.value);
  elements.baseUrlInput.value = state.baseUrl;
  persistBrowserCache();

  if (!state.apiKey) {
    showNotice("请输入 API Key 后再获取模型。", "error");
    return;
  }

  elements.testEndpointButton.disabled = true;
  elements.testEndpointButton.textContent = "获取中";
  try {
    const response = await fetch(`${state.baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${state.apiKey}`,
      },
    });
    if (!response.ok) throw await readApiError(response);
    const json = await response.json();
    const models = Array.isArray(json?.data)
      ? json.data.map((item) => item.id || item.name).filter(Boolean)
      : [];
    const imageModels = models.filter(supportsImageGenerationModel);
    state.availableModels = imageModels.length ? imageModels : models;
    state.model = pickFetchedModel(state.availableModels);
    applyProviderFromModel();
    syncControlsFromState();
    renderAll();
    showNotice(
      state.availableModels.length
        ? `已获取 ${state.availableModels.length} 个模型，当前使用 ${state.model}。`
        : "连接正常，但模型列表为空。你仍可手动输入接口支持的模型。",
      state.availableModels.length ? "success" : "error",
    );
  } catch (error) {
    showNotice(formatRequestError(error), "error");
    elements.connectionPill.classList.add("error");
  } finally {
    elements.testEndpointButton.disabled = false;
    elements.testEndpointButton.textContent = "获取模型";
  }
}

function formatRequestError(error) {
  const raw = error?.message || String(error);
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) {
    return "浏览器没有完成请求。请确认网络可访问 OpenAI API；如果浏览器阻止跨域请求，纯前端直连 API 可能需要改用一个极薄的代理。";
  }
  return raw;
}

function setRunning(isRunning) {
  state.isRunning = isRunning;
  elements.runButton.disabled = isRunning;
  elements.runButtonText.textContent = isRunning
    ? state.mode === "edit"
      ? "正在编辑"
      : "正在生成"
    : state.mode === "edit"
      ? "编辑图片"
      : "生成图片";
  elements.progressBar.hidden = !isRunning;
}

function showNotice(message, type) {
  elements.noticeBar.hidden = false;
  elements.noticeBar.textContent = message;
  elements.noticeBar.classList.toggle("success", type === "success");
}

function hideNotice() {
  elements.noticeBar.hidden = true;
  elements.noticeBar.textContent = "";
  elements.noticeBar.classList.remove("success");
}

function getResolvedSize() {
  if (state.size === "custom") {
    const width = nearestMultipleOf16(state.customWidth);
    const height = nearestMultipleOf16(state.customHeight);
    return `${width}x${height}`;
  }
  return state.size;
}

function validateCustomSize(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return "自定义尺寸需要输入宽和高。";
  }

  if (width < 256 || height < 256 || width > 3840 || height > 3840) {
    return "自定义尺寸建议在 256 到 3840 像素之间。";
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    return "gpt-image-2 自定义宽高需要是 16 的倍数。";
  }

  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 3) {
    return "自定义宽高比例最长边不能超过最短边 3 倍。";
  }

  const pixels = width * height;
  if (pixels < 655_360 || pixels > 8_294_400) {
    return "自定义尺寸像素需要在 655360 到 8294400 之间。";
  }

  return "";
}

function nearestMultipleOf16(value) {
  return Math.max(16, Math.round(Number(value) / 16) * 16);
}

function appendOptionalFormData(formData, key, value) {
  if (value === undefined || value === null || value === "") return;
  formData.append(key, String(value));
}

function isSupportedSize(size) {
  return (
    ["auto", "1024x1024", "1536x1024", "1024x1536", "custom"].includes(size) ||
    /^\d+x\d+$/.test(String(size || ""))
  );
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function getSelectedResult() {
  return state.results.find((result) => result.id === state.selectedResultId) || null;
}

function downloadSelected() {
  const selected = getSelectedResult();
  if (selected) downloadResult(selected);
}

function downloadResult(result) {
  const anchor = document.createElement("a");
  anchor.href = result.dataUrl;
  const modelSlug = String(result.model || state.model || DEFAULT_MODEL).replace(/[^a-z0-9._-]+/gi, "-");
  anchor.download = `toho-${modelSlug}-${new Date(result.createdAt).toISOString().replace(/[:.]/g, "-")}.${result.format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

async function useSelectedForEdit() {
  if (!supportsEditing()) {
    showNotice("请先切换到 image2 模型，再把结果作为编辑参考。", "error");
    return;
  }
  const selected = getSelectedResult();
  if (selected) await useResultForEdit(selected);
}

async function useResultForEdit(result) {
  if (!supportsEditing()) {
    showNotice("请先切换到 image2 模型，再把结果作为编辑参考。", "error");
    return;
  }
  const blob = await fetch(result.dataUrl).then((response) => response.blob());
  const file = new File([blob], `generated-${result.id}.${result.format}`, {
    type: blob.type || `image/${result.format}`,
  });
  const dataUrl = await fileToDataUrl(file);
  state.references.unshift({
    id: crypto.randomUUID(),
    file,
    dataUrl,
    name: file.name,
    size: file.size,
    type: file.type,
  });
  state.mode = "edit";
  state.maskDirty = false;
  state.maskHistory = [];
  renderAll();
}

async function renderMaskWorkbench() {
  if (state.mode !== "edit" || !state.references.length) {
    elements.maskWorkbench.hidden = true;
    return;
  }

  elements.maskWorkbench.hidden = false;
  const reference = state.references[0];
  if (!activeReferenceObjectUrl || elements.sourceCanvas.dataset.referenceId !== reference.id) {
    if (activeReferenceObjectUrl) URL.revokeObjectURL(activeReferenceObjectUrl);
    activeReferenceObjectUrl = URL.createObjectURL(reference.file);
    elements.sourceCanvas.dataset.referenceId = reference.id;
    await drawSourceImage(activeReferenceObjectUrl);
    clearMask(false);
  }

  elements.maskPaintState.textContent = state.maskDirty
    ? "已创建遮罩，将只编辑白色涂抹区域"
    : "未涂抹时会编辑整张图";
}

async function drawSourceImage(objectUrl) {
  const image = await loadImage(objectUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  elements.sourceCanvas.width = width;
  elements.sourceCanvas.height = height;
  elements.maskCanvas.width = width;
  elements.maskCanvas.height = height;

  sourceCtx.clearRect(0, 0, width, height);
  sourceCtx.drawImage(image, 0, 0, width, height);
}

function startMaskStroke(event) {
  if (state.mode !== "edit" || !state.references.length) return;
  activePointerId = event.pointerId;
  elements.maskCanvas.setPointerCapture(activePointerId);
  saveMaskSnapshot();
  paintMaskPoint(event);
}

function continueMaskStroke(event) {
  if (event.pointerId !== activePointerId) return;
  paintMaskPoint(event);
}

function finishMaskStroke(event) {
  if (event.pointerId !== activePointerId) return;
  activePointerId = null;
  try {
    elements.maskCanvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be gone on some mobile browsers.
  }
}

function paintMaskPoint(event) {
  const rect = elements.maskCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * elements.maskCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * elements.maskCanvas.height;
  const radius = state.brushSize / 2;

  maskCtx.save();
  maskCtx.fillStyle = "rgba(47, 109, 87, 0.62)";
  maskCtx.strokeStyle = "rgba(47, 109, 87, 0.76)";
  maskCtx.lineWidth = 1;
  maskCtx.beginPath();
  maskCtx.arc(x, y, radius, 0, Math.PI * 2);
  maskCtx.fill();
  maskCtx.stroke();
  maskCtx.restore();

  state.maskDirty = true;
  elements.maskPaintState.textContent = "已创建遮罩，将只编辑白色涂抹区域";
}

function saveMaskSnapshot() {
  if (!elements.maskCanvas.width || !elements.maskCanvas.height) return;
  state.maskHistory.push(maskCtx.getImageData(0, 0, elements.maskCanvas.width, elements.maskCanvas.height));
  if (state.maskHistory.length > 12) state.maskHistory.shift();
}

function undoMask() {
  const last = state.maskHistory.pop();
  if (!last) {
    clearMask();
    return;
  }
  maskCtx.putImageData(last, 0, 0);
  state.maskDirty = !isCanvasBlank(elements.maskCanvas);
  elements.maskPaintState.textContent = state.maskDirty
    ? "已创建遮罩，将只编辑白色涂抹区域"
    : "未涂抹时会编辑整张图";
}

function clearMask(shouldRender = true) {
  maskCtx.clearRect(0, 0, elements.maskCanvas.width, elements.maskCanvas.height);
  state.maskDirty = false;
  state.maskHistory = [];
  elements.maskPaintState.textContent = "未涂抹时会编辑整张图";
  if (shouldRender) renderMaskWorkbench();
}

async function getMaskBlobIfNeeded() {
  if (!state.maskDirty || !elements.maskCanvas.width || !elements.maskCanvas.height) return null;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = elements.maskCanvas.width;
  outputCanvas.height = elements.maskCanvas.height;
  const outputCtx = outputCanvas.getContext("2d");
  const imageData = maskCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const painted = data[index + 3] > 0;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = painted ? 0 : 255;
  }

  outputCtx.putImageData(imageData, 0, 0);
  return new Promise((resolve) => outputCanvas.toBlob(resolve, "image/png"));
}

function isCanvasBlank(canvas) {
  const context = canvas.getContext("2d");
  const pixelBuffer = new Uint32Array(
    context.getImageData(0, 0, canvas.width, canvas.height).data.buffer,
  );
  return !pixelBuffer.some((color) => color !== 0);
}

function resetWorkspace() {
  state.prompt = "";
  state.results = [];
  state.references = [];
  state.selectedResultId = null;
  state.mode = "generate";
  state.maskDirty = false;
  state.maskHistory = [];
  elements.promptInput.value = "";
  hideNotice();
  clearMask(false);
  renderAll();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
