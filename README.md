# DSH Codex Bridge

为 DeepSeek Harness 桌面端提供 Codex 登录入口。插件只调用 Harness 已有的 `llm-pi-ai/openai-codex` OAuth 流；不注册 LLM adapter，不实现 OAuth，不传输或复制 token。凭据仍由 DSH/pi-ai 管理。

## 目标环境

- DeepSeek Harness Desktop `0.2.2-rc.3`
- 该版本的插件管理器与 `llm-pi-ai` 授权服务

## 安装到桌面端

1. 在 DSH「插件」页禁用/卸载此前启用后报 `adapter for provider "openai-codex" is already registered` 的 Codex OAuth 适配器插件，避免旧插件继续和 Harness 内置路由冲突。
2. 在「设置 → 模型」使用 `llm-pi-ai` 提供的 `openai-codex` 路由；API 地址和 API Key 留空。不要把它当作自定义 OpenAI 兼容服务，也不要再添加另一个会注册同名模型适配器的插件。
3. 在桌面端「添加插件」中粘贴 `github:jierry-D/dsh-codex-bridge` 并安装；如果界面要求完整地址，也可粘贴 `https://github.com/jierry-D/dsh-codex-bridge`。GitHub 不可达时，安装本地 `.tgz` 压缩包，不要用源码目录路径。
4. 完全退出并重新打开 DSH。
5. 打开「设置 → Codex 登录」，点“使用 ChatGPT 账号登录”，按浏览器或设备码提示授权。
6. 回到模型选择器选择 `openai-codex` 下的模型。

项目已附带构建产物。修改源码后，在本目录运行 `npm install` 和 `npm run build` 重新生成。

## 安全边界

- 浏览器界面仅收到登录状态和授权页面/设备码提示；不读取完整账号标识或 token。
- 退出登录调用 DSH credential store 删除 `llm-pi-ai/openai-codex` 记录。
- OAuth URL 和设备码由上游授权流程给出；插件不自行连接 OpenAI 或实现 token refresh。

## 当前状态

`0.1.1` 为 DSH 运行时导入的授权、凭据和 Typert 协议包声明了 peer dependencies。源码和构建产物针对 DSH `0.2.2-rc.3` 完成本地构建。尚未验证真实账号登录或模型请求；没有访问你的账号或凭据。

