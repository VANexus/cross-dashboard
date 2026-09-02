/**
 * FlowMind RAK — AI Provider interface
 * Abstract interface for AI capabilities
 */

export interface GenerateParams {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface GenerateResult {
  content: string;
  usage: { input: number; output: number };
  model: string;
  latency: number;
}

export interface AnalyzeParams {
  prompt: string;
  data: unknown;
  schema?: string; // Zod schema description for structured output
}

/** 工具调用循环中的对话消息（编排器协议，role: system/user/assistant）。 */
export interface ConversationMessage {
  role: string;
  content: string;
}

/** 编排器传给模型的工具定义（Claude tools / OpenAI function 双协议的公共子集）。 */
export interface ToolDefinitionSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface GenerateWithToolsParams {
  messages: ConversationMessage[];
  tools: ToolDefinitionSpec[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface GenerateWithToolsResult {
  text: string;
  toolCalls: { name: string; arguments: Record<string, unknown> }[];
}

export interface AIProvider {
  readonly name: string;

  generate(params: GenerateParams): Promise<GenerateResult>;
  analyze<T>(params: AnalyzeParams): Promise<T>;

  /**
   * Optional: 原生工具调用一轮（orchestrator 工具循环用）。
   * Provider 不支持时可缺省，调用方需判空降级。
   */
  generateWithTools?(params: GenerateWithToolsParams): Promise<GenerateWithToolsResult>;
}

export type AIProviderName = "claude" | "openai";
