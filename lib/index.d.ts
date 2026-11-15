import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
type PromptView = {
    kind: 'text' | 'secret' | 'select';
    message: string;
    placeholder?: string;
    options?: Array<{
        id: string;
        label: string;
    }>;
};
/** Starts Harness's existing Codex OAuth flow; this package never implements OAuth or handles token values. */
export declare class CodexBridge extends TypertRemoteService {
    private readonly deps;
    private readonly state;
    constructor(ctx: Context);
    status(): Promise<{
        ready: boolean;
        flowAvailable: boolean;
        signedIn: boolean;
        phase: "idle" | "running" | "authorized" | "cancelled" | "failed";
        message: string;
        url: string;
        code: string;
        prompt: PromptView | undefined;
        error: string | undefined;
    }>;
    signIn(): Promise<{
        ready: boolean;
        flowAvailable: boolean;
        signedIn: boolean;
        phase: "idle" | "running" | "authorized" | "cancelled" | "failed";
        message: string;
        url: string;
        code: string;
        prompt: PromptView | undefined;
        error: string | undefined;
    }>;
    answer(value: string): Promise<{
        ok: boolean;
    }>;
    cancel(): Promise<{
        ok: boolean;
    }>;
    signOut(): Promise<{
        ready: boolean;
        flowAvailable: boolean;
        signedIn: boolean;
        phase: "idle" | "running" | "authorized" | "cancelled" | "failed";
        message: string;
        url: string;
        code: string;
        prompt: PromptView | undefined;
        error: string | undefined;
    }>;
}
export default CodexBridge;
export declare const name = "dsh-codex-bridge";

