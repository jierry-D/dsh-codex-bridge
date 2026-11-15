# DSH Codex Bridge

为 DeepSeek Harness 桌面端提供 Codex 登录入口。插件调用 DSH 已有的 `llm-pi-ai/openai-codex` OAuth 流，不注册模型适配器，也不实现 OAuth。登录凭据由 DSH 管理。

## 目标环境

- DeepSeek Harness Desktop `0.2.2-rc.3`
- 已启用提供 `openai-codex` OAuth 流程的 `llm-pi-ai`

## 安装

在 DSH「插件 → 添加插件」中输入 GitHub 仓库地址：

`https://github.com/jierry-D/dsh-codex-bridge`

如果 DSH 提示无法访问 GitHub，请使用 DSH 的「本地目录」安装方式，选择已下载并解压的 `dsh-codex-bridge` 插件目录（目录中应有 `package.json`、`lib` 和 `client`）。不要把 ZIP 文件路径填入“本地目录”输入框。

升级前先禁用/卸载旧版 `dsh-codex-bridge`，然后安装新版并重启 DSH。不要同时启用其他会注册 `openai-codex` 模型适配器的插件，否则会冲突。

## 登录

1. 打开「设置 → Codex 登录」。
2. 点击“使用 ChatGPT 账号登录”，按浏览器页面或设备码提示完成授权。
3. 在模型选择器中选择 `openai-codex` 下的模型。

## 安全边界

- 浏览器界面只接收登录状态和授权页面/设备码提示，不读取完整账号标识或 token。
- 授权请求通过 DSH Connection RPC 通道，并由 `connection.admit` 校验来源。
- OAuth 流程和 token 存储由 DSH 的授权与凭据服务处理。
- 退出登录调用 DSH credential store 删除 `llm-pi-ai/openai-codex` 记录。

## 开发与验证状态

目标运行环境为 DSH `0.2.2-rc.3`。在本目录执行 `npm install`、`npm run build` 可生成发布文件。当前代码已在本地完成 TypeScript 与打包构建；尚未在真实 DSH 桌面端验证 OAuth 登录和模型请求。

