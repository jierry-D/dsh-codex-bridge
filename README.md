# DSH Codex Bridge

为 DeepSeek Harness 桌面端提供 Codex 登录入口。插件只调用 Harness 已有的 `llm-pi-ai/openai-codex` OAuth 流；不注册 LLM adapter，不实现 OAuth，不传输或复制 token。凭据仍由 DSH/pi-ai 管理。

## 目标环境

- DeepSeek Harness Desktop `0.2.2-rc.3`
- 该版本的插件管理器与 `llm-pi-ai` 授权服务

## 安装到桌面端

1. 在 DSH「插件」页禁用/卸载此前启用后报 `adapter for provider "openai-codex" is already registered` 的 Codex OAuth 适配器插件，避免旧插件继续和 Harness 内置路由冲突。
2. 在「设置 → 模型」使用 `llm-pi-ai` 提供的 `openai-codex` 路由；API 地址和 API Key 留空。不要把它当作自定义 OpenAI 兼容服务，也不要再添加另一个会注册同名模型适配器的插件。
3. 在应用内插件管理器选择“从本地目录安装”，选择本目录 `dsh-codex-bridge`。
4. 完全退出并重新打开 DSH。
5. 打开「设置 → Codex 登录」，点“使用 ChatGPT 账号登录”，按浏览器或设备码提示授权。
6. 回到模型选择器选择 `openai-codex` 下的模型。

项目已附带构建产物。修改源码后，在本目录运行 `npm install` 和 `npm run build` 重新生成。

## 安全边界

- 浏览器界面仅收到登录状态和授权页面/设备码提示；不读取完整账号标识或 token。
- 退出登录调用 DSH credential store 删除 `llm-pi-ai/openai-codex` 记录。
- OAuth URL 和设备码由上游授权流程给出；插件不自行连接 OpenAI 或实现 token refresh。

## 当前状态

源码和构建产物已生成，并针对 DSH `0.2.2-rc.3` 完成本地构建。尚未在你的 DSH 安装中安装，也未做真实账号登录或模型请求验证；没有对你的账号或凭据进行访问。

