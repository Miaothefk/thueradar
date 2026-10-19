export declare class AiProviderError extends Error {
  code: string;
  status?: number;
}
export type AiProvider = {
  kind: string;
  generateAnswer(input: { question: string; sources: Array<{ id: string; title: string; content: string }> }): Promise<string>;
};
export declare function getProviderConfig(env?: NodeJS.ProcessEnv): { kind: string; apiKey: string; endpoint: string; deployment?: string; apiVersion?: string; model?: string } | null;
export declare function createAiProvider(env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch): AiProvider | null;
