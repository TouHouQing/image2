# Toho Image Studio

纯前端 GPT Image 2 生图和编辑工作台，默认部署域名为 `img.tohoqing.com`。

## 使用

1. 打开页面。
2. 输入自己的 API Key。
3. 输入提示词，按需切换 `quality`、`size`、`n`、`output_format`、`output_compression`、`background`、`moderation`、`stream`、`partial_images` 等参数。
4. 点击生成。生成结果可以下载，也可以一键进入编辑模式。
5. 编辑模式支持上传参考图、使用生成图作为参考图、涂抹局部遮罩后再次提交编辑。

默认会把 API Key、接口地址、提示词和参数缓存到当前浏览器的 `localStorage`，方便下次继续使用。取消“缓存到此浏览器”会清掉本地缓存。

## 推荐入口

页面顶部和右侧栏放了低打扰的推荐入口，不遮挡生图流程：

- `sub.tohoqing.com`：生图中转站，也支持 Claude、GPT 等最新对话模型。
- `faka.tohoqing.com`：AI 会员和相关服务发卡网。
- QQ 群 `242080189`：页面内支持一键复制群号。

## 接口地址

页面默认接口为 `https://sub.tohoqing.com/v1`，也可以手动改成任意 OpenAI 兼容接口。用户只输入域名时，页面会自动补全 `https://` 和 `/v1`。

## API 调用教学

右侧“直连接口”区域会根据当前页面的接口地址、提示词和参数自动生成两段可复制的 cURL 示例：

- `POST /images/generations`：用 JSON 请求生成图片。
- `POST /images/edits`：用 multipart form-data 上传参考图并编辑图片。

示例中的 API Key 使用 `$API_KEY` 占位，不会把页面里输入的真实 Key 显示在代码块里。

## 本地预览

```bash
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 部署

这是静态站点，直接部署 `index.html`、`styles.css`、`app.js` 即可。后续可以通过 GitHub Pages 配置自定义域名。

纯前端会从浏览器直连 OpenAI 兼容 API。如果浏览器或网络环境阻止跨域请求，需要改用一个非常薄的自有代理；当前项目没有包含后端代码。
