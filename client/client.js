window.__ModuleLoader__.load({
	id: "dsh-codex-bridge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		// \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		// client/index.tsx
		const namespace = "codexBridge";
		const bundle = "dsh-codex-bridge";
		const textSchema = Object.freeze({ "~standard": Object.freeze({
			version: 1,
			vendor: bundle,
			validate: (value) => typeof value === "string" ? { value } : { issues: [{ message: "expected string" }] }
		}) });
		const descriptor = (method, fields = []) => ({
			id: `${bundle}#${namespace}/${method}`,
			service: namespace,
			namespace,
			method,
			invocation: { kind: "direct" },
			parameters: fields.map((name) => ({
				name,
				wire: name,
				source: "json",
				codec: {
					mode: "strict",
					typeSymbol: `${bundle}#${namespace}/${method}:${name}`,
					create: () => textSchema
				}
			})),
			result: { mode: "src-json" }
		});
		const contribution = {
			package: bundle,
			descriptors: [
				descriptor("status"),
				descriptor("signIn"),
				descriptor("answer", ["value"]),
				descriptor("cancel"),
				descriptor("signOut")
			]
		};
		const unwrap = (reply) => {
			if (reply.ok && reply.value !== void 0) return reply.value;
			throw new Error(reply.error?.message || "无法连接 DSH 授权服务");
		};
		function LoginPanel({ getApi }) {
			const [status, setStatus] = react.default.useState();
			const [input, setInput] = react.default.useState("");
			const [error, setError] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const refresh = react.default.useCallback(async () => {
				const api = getApi();
				if (!api) return;
				try {
					setStatus(unwrap(await api.status()));
				} catch (e) {
					setError(String(e));
				}
			}, [getApi]);
			react.default.useEffect(() => {
				refresh();
			}, [refresh]);
			react.default.useEffect(() => {
				if (status?.phase !== "running") return;
				const timer = window.setInterval(() => {
					refresh();
				}, 1e3);
				return () => window.clearInterval(timer);
			}, [status?.phase, refresh]);
			react.default.useEffect(() => {
				if (status?.url && !status.code) window.open(status.url, "_blank", "noopener,noreferrer");
			}, [status?.url, status?.code]);
			const run = async (action) => {
				const api = getApi();
				if (!api) {
					setError("授权服务未连接，请重启 DSH 后重试。");
					return;
				}
				setBusy(true);
				setError("");
				try {
					unwrap(await action(api));
					await refresh();
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: {
					display: "grid",
					gap: 12,
					maxWidth: 640
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: "Codex 登录" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "使用 DSH 内置的 ChatGPT OAuth。插件不会注册模型适配器，也不会保存 token。" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: ["状态：", status?.signedIn ? "已登录" : status?.phase === "running" ? "等待授权" : "未登录"] }),
					!status?.ready && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: "DSH 授权/凭据服务尚未就绪。" }),
					!status?.flowAvailable && status?.ready && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: "当前 DSH 没有注册 openai-codex 登录流程；请检查 llm-pi-ai 插件是否启用。" }),
					status?.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						children: status.error
					}),
					status?.message && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: status.message }),
					status?.url && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						href: status.url,
						target: "_blank",
						rel: "noreferrer",
						children: "打开 ChatGPT 授权页面"
					}),
					status?.code && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: ["设备码：", status.code] }) }),
					status?.prompt && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "grid",
							gap: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", { children: status.prompt.message }), status.prompt.options?.length ? status.prompt.options.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							disabled: busy,
							onClick: () => void run((api) => api.answer(option.id)),
							children: option.label
						}, option.id)) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: status.prompt?.kind === "secret" ? "password" : "text",
								value: input,
								placeholder: status.prompt.placeholder,
								onChange: (e) => setInput(e.target.value)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy || !input,
								onClick: () => void run(async (api) => {
									await api.answer(input);
									setInput("");
								}),
								children: "提交"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: 8
						},
						children: [
							!status?.signedIn && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy || status?.phase === "running" || !status?.flowAvailable,
								onClick: () => void run((api) => api.signIn()),
								children: "使用 ChatGPT 账号登录"
							}),
							status?.phase === "running" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => void run((api) => api.cancel()),
								children: "取消"
							}),
							status?.signedIn && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								disabled: busy,
								onClick: () => {
									if (window.confirm("退出后需要重新登录才能使用 Codex 模型。确定退出？")) run((api) => api.signOut());
								},
								children: "退出登录"
							})
						]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						role: "alert",
						style: { color: "var(--dsw-alias-state-error-primary, #b42318)" },
						children: error
					})
				]
			});
		}
		const inject = ["slots", "remote"];
		function apply(ctx) {
			ctx.effect(() => {
				let dispose;
				let unloaded = false;
				ctx.remote.$mount(contribution).then((off) => {
					if (unloaded) off();
					else dispose = off;
				}).catch((err) => console.warn("[dsh-codex-bridge] remote unavailable", err));
				return () => {
					unloaded = true;
					dispose?.();
				};
			}, "codex-bridge: remote service");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-codex-bridge",
				order: 14,
				label: () => "Codex 登录"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LoginPanel, { getApi: () => ctx.get(`remote.${namespace}`) })));
		}
		const name = "dsh-codex-bridge";
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

