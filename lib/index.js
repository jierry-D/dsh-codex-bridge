var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { AuthorizationDeclinedError } from '@deepseek-ai/dsh-authorization';
import { credentialKey } from '@deepseek-ai/dsh-credentials';
const KEY = credentialKey('llm-pi-ai', 'openai-codex');
/** Starts Harness's existing Codex OAuth flow; this package never implements OAuth or handles token values. */
let CodexBridge = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _status_decorators;
    let _signIn_decorators;
    let _answer_decorators;
    let _cancel_decorators;
    let _signOut_decorators;
    return class CodexBridge extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _status_decorators = [Remote];
            _signIn_decorators = [Remote];
            _answer_decorators = [Remote];
            _cancel_decorators = [Remote];
            _signOut_decorators = [Remote];
            __esDecorate(this, null, _status_decorators, { kind: "method", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _signIn_decorators, { kind: "method", name: "signIn", static: false, private: false, access: { has: obj => "signIn" in obj, get: obj => obj.signIn }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _answer_decorators, { kind: "method", name: "answer", static: false, private: false, access: { has: obj => "answer" in obj, get: obj => obj.answer }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _cancel_decorators, { kind: "method", name: "cancel", static: false, private: false, access: { has: obj => "cancel" in obj, get: obj => obj.cancel }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _signOut_decorators, { kind: "method", name: "signOut", static: false, private: false, access: { has: obj => "signOut" in obj, get: obj => obj.signOut }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        deps = (__runInitializers(this, _instanceExtraInitializers), {});
        state = { phase: 'idle', message: '', url: '', code: '' };
        constructor(ctx) {
            super(ctx, 'codexBridge');
            ctx.inject(['authorization'], (scope) => { this.deps.auth = scope.authorization; });
            ctx.inject(['credentials'], (scope) => { this.deps.credentials = scope.credentials; });
            ctx.effect(() => () => {
                this.state.prompt?.cancel();
                this.state.prompt = undefined;
                void this.deps.auth?.cancel(KEY);
            }, 'codex-bridge: stop pending authorization');
        }
        async status() {
            const record = await this.deps.credentials?.readRecord(KEY);
            const payload = record?.kind === 'grant' && typeof record.payload === 'object' && record.payload !== null
                ? record.payload : {};
            return {
                ready: !!this.deps.auth && !!this.deps.credentials,
                flowAvailable: this.deps.auth?.describe(KEY) !== undefined,
                signedIn: typeof payload.access === 'string' && payload.access.length > 0,
                phase: this.state.phase,
                message: this.state.message,
                url: this.state.url,
                code: this.state.code,
                prompt: this.state.prompt?.view,
                error: this.state.error,
            };
        }
        async signIn() {
            const auth = this.deps.auth;
            if (!auth)
                throw new Error('DSH 授权服务尚未就绪');
            if (auth.describe(KEY) === undefined)
                throw new Error('当前 DSH 没有注册 openai-codex 授权流程');
            if (this.state.phase === 'running')
                return this.status();
            Object.assign(this.state, { phase: 'running', message: '', url: '', code: '', error: undefined, prompt: undefined });
            const interaction = {
                notify: (notice) => {
                    this.state.message = typeof notice.message === 'string' ? notice.message : '';
                    this.state.url = typeof notice.url === 'string' ? notice.url : '';
                    this.state.code = typeof notice.code === 'string' ? notice.code : '';
                },
                prompt: (question) => new Promise((resolve, reject) => {
                    const view = {
                        kind: question.kind,
                        message: question.message,
                        placeholder: question.placeholder,
                        options: question.kind === 'select' ? question.options.map((option) => ({ id: option.id, label: option.label })) : undefined,
                    };
                    const prompt = {
                        view,
                        answer: (value) => { this.state.prompt = undefined; resolve(value); },
                        cancel: () => { this.state.prompt = undefined; reject(new AuthorizationDeclinedError('用户取消授权')); },
                    };
                    this.state.prompt?.cancel();
                    this.state.prompt = prompt;
                }),
            };
            void auth.begin({ key: KEY, method: 'oauth', interaction }).then((result) => { this.state.phase = result.status === 'authorized' ? 'authorized' : 'cancelled'; }, (error) => {
                if (this.state.phase !== 'cancelled') {
                    this.state.phase = 'failed';
                    this.state.error = error instanceof Error ? error.message : String(error);
                }
            });
            return this.status();
        }
        async answer(value) {
            if (typeof value !== 'string' || value.length > 2048)
                throw new Error('输入内容无效');
            const prompt = this.state.prompt;
            if (!prompt)
                throw new Error('当前没有等待输入的授权问题');
            prompt.answer(value);
            return { ok: true };
        }
        async cancel() {
            this.state.prompt?.cancel();
            await this.deps.auth?.cancel(KEY);
            this.state.phase = 'cancelled';
            return { ok: true };
        }
        async signOut() {
            if (!this.deps.credentials)
                throw new Error('DSH 凭据服务尚未就绪');
            await this.deps.credentials.deleteRecord(KEY);
            this.state.phase = 'idle';
            return this.status();
        }
    };
})();
export { CodexBridge };
export default CodexBridge;
export const name = 'dsh-codex-bridge';

