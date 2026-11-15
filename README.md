# DSH Codex Bridge

为 DeepSeek Harness 内置的 `openai-codex` 模型路由提供 ChatGPT 设备码登录。OAuth 实现来自 DSH 使用的 `@earendil-works/pi-ai`；凭据写入 DSH 内置 `llm-pi-ai/openai-codex` 本地凭据记录，访问令牌不会经过设置页。

本项目按 [gooosie/dsh-openai-codex-auth](https://github.com/gooosie/dsh-openai-codex-auth) 的设备码登录和凭据生命周期设计重做，并按其 MIT 许可证保留来源说明。只包含登录、状态和退出；模型适配器继续使用 DSH 内置实现，不包含用量、重置卡或代理功能。

## 前置条件

保持 DSH 内置 `llm-pi-ai.providers.openai-codex` 路由启用。本插件不注册第二个模型 adapter，因此不会与该内置路由重复注册。请卸载其他会自行注册 `openai-codex` adapter 的第三方插件。

## 兼容范围

- 针对 DSH Windows Desktop `0.2.2-rc.3`、宿主 pi-ai `1.3.0` 构建。
- 声明兼容 DSH `>=0.2.2-rc.1 <0.2.3`；范围声明不代表每个版本都已实测。
- ChatGPT 账号需要有 Codex 使用资格并允许设备码登录。

## 安装

在 DSH「插件 → 添加插件」输入 GitHub 仓库地址：

`https://github.com/jierry-D/dsh-codex-bridge`

卸载旧版 `dsh-codex-bridge` 后再安装新版。若 DSH 提示重启，请完全退出（包括托盘进程）并重新打开。

## 登录

1. 打开「设置 → Codex 登录」，点击「使用 ChatGPT 账号登录」。
2. 点击授权页面链接，在 OpenAI 页面输入设置页显示的设备码。
3. 授权完成后回到 DSH；状态应显示「已登录」。
4. 在模型选择器的 `openai-codex` 下选择模型。

设备码流程不会创建 `localhost` OAuth 回调页。设置页只返回登录状态、验证网址、设备码和有效期，不返回 token 或账号 ID。

## 开发

```sh
npm install
npm run build
npm pack --dry-run
```

## 安全边界

- OAuth 设备码和令牌流程由 `@earendil-works/pi-ai` 处理。
- 凭据由 DSH `credentials` 服务写入本地 `llm-pi-ai/openai-codex` 记录；插件卸载不会自动删除凭据，请先在设置页退出登录。
- 只有验证网址的 `https` 协议及 `auth.openai.com` 主机名会显示给用户。
- 不采集或上传 token、完整账号标识、用量、重置卡或代理凭据。

## 来源与许可

本插件的设备码 OAuth 和本地凭据生命周期设计参考 [gooosie/dsh-openai-codex-auth](https://github.com/gooosie/dsh-openai-codex-auth)，其项目采用 MIT 许可证；详见 [NOTICE.md](./NOTICE.md) 和 [LICENSE](./LICENSE)。
