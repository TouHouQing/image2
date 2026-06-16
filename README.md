# Toho Image Studio

纯前端 Image2 / Gemini 生图和 Image2 编辑工作台，默认部署域名为 `img.tohoqing.com`。

## 使用

1. 打开页面。
2. 输入自己的 API Key。
3. 点击“获取模型”，页面会从当前接口的 `/models` 拉取可用模型，并根据模型名自动识别 Image2 或 Gemini。
4. 选择模型后输入提示词，按需切换 `size`、`n`、`output_format` 等参数；Image2 模型还支持 `quality`、`output_compression`、`background`、`moderation`、`stream`、`partial_images` 等高级参数。
5. 点击生成。生成结果可以下载；Image2 模式下也可以一键进入编辑模式。
6. 编辑模式支持上传参考图、使用生成图作为参考图、涂抹局部遮罩后再次提交编辑。

默认会把 API Key、接口地址、提示词和参数缓存到当前浏览器的 `localStorage`，方便下次继续使用。取消“缓存到此浏览器”会清掉本地缓存。

## 推荐入口

页面顶部和右侧栏放了低打扰的推荐入口，不遮挡生图流程：

- `sub.tohoqing.com`：生图中转站，也支持 Claude、GPT 等最新对话模型。
- `faka.tohoqing.com`：AI 会员和相关服务发卡网。
- QQ 群 `242080189`：页面内支持一键复制群号。

## 接口地址

页面默认接口为 `https://sub.tohoqing.com/v1`，Image2 和 Gemini 都默认从这个接口获取模型。也可以手动改成任意 OpenAI 兼容接口；用户只输入域名时，页面会自动补全 `https://` 和 `/v1`。

Gemini 模型默认也走 `https://sub.tohoqing.com/v1` 的 OpenAI 兼容图片接口：页面会调用 `POST /images/generations`，而不是拼接 `POST /models/{model}:generateContent`。只有当接口地址是 Google Gemini 原生域名（例如 `https://generativelanguage.googleapis.com/v1beta/openai`）时，页面才会自动切到 Google 原生 `models/{model}:generateContent` 调用。

## API 调用教学

右侧“直连接口”区域会根据当前页面的接口地址、模型、提示词和参数自动生成可复制的 cURL 示例：

- Image2：`POST /images/generations`，用 JSON 请求生成图片。
- Gemini（默认 `sub.tohoqing.com`）：`POST /images/generations`，使用 OpenAI 兼容图片格式请求生成图片。
- Gemini（Google 原生域名）：`POST /models/{model}:generateContent`，使用 Gemini 原生 `contents` / `generationConfig.responseModalities` 请求生成图片。
- `POST /images/edits`：用 multipart form-data 上传参考图并编辑图片。

Gemini 模式下，页面会根据接口域名选择兼容图片 payload 或原生 payload，并同时解析 OpenAI 图片响应和 Gemini `inlineData` 图片；编辑调用会提示切回 Image2 模型。

示例中的 API Key 使用 `$API_KEY` 占位，不会把页面里输入的真实 Key 显示在代码块里。

## 本地预览

```bash
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 部署

这是静态站点，直接部署 `index.html`、`styles.css`、`app.js` 即可。后续可以通过 GitHub Pages 配置自定义域名。

纯前端会从浏览器直连 OpenAI 兼容 API。如果浏览器或网络环境阻止跨域请求，需要改用一个非常薄的自有代理；当前项目没有包含后端代码。
