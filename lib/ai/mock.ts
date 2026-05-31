/**
 * FlowMind RAK — Mock AI Provider
 * Simulates AI responses for development and demos
 */
import type { AIProvider, GenerateParams, GenerateResult, AnalyzeParams, ImageParams, ImageResult } from "./provider";

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generate(params: GenerateParams): Promise<GenerateResult> {
    await this.simulateLatency();

    const content = this.generateMockContent(params.prompt);
    return {
      content,
      usage: { input: params.prompt.length, output: content.length },
      model: "mock-v1",
      latency: 1200 + Math.random() * 800,
    };
  }

  async analyze<T>(params: AnalyzeParams): Promise<T> {
    await this.simulateLatency();
    return this.generateMockAnalysis<T>(params.prompt, params.data);
  }

  async generateImage(params: ImageParams): Promise<ImageResult> {
    await this.simulateLatency();
    return {
      url: `https://placehold.co/1024x1024/1a1a2e/d4a017?text=${encodeURIComponent(params.prompt.slice(0, 30))}`,
      model: params.model ?? "SDXL-1.0",
      seed: Math.floor(Math.random() * 99999),
    };
  }

  private async simulateLatency(): Promise<void> {
    const ms = 500 + Math.random() * 1500;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateMockContent(prompt: string): string {
    if (prompt.includes("listing") || prompt.includes("Listing")) {
      return JSON.stringify({
        title: "Smart Pet Fountain Pro — UV Sterilization, Ultra-Quiet, 3L Large Capacity",
        bullets: [
          "Advanced UV-C Sterilization — Eliminates 99.9% of bacteria for cleaner, safer water",
          "Ultra-Quiet Operation — DC brushless motor at under 30dB, won't disturb your home",
          "Large 3L Capacity — Perfect for multi-pet households, fewer refills needed",
          "Smart Temperature Display — Real-time LED screen shows water temperature",
          "Easy-Clean Design — Tool-free disassembly in seconds for deep cleaning",
        ],
        description: "Keep your pets hydrated with the Smart Pet Fountain Pro...",
      });
    }
    if (prompt.includes("广告") || prompt.includes("keyword")) {
      return JSON.stringify({
        keywords: ["pet water fountain", "cat fountain", "automatic pet water"],
        bidSuggestions: { low: 0.3, medium: 0.6, high: 1.2 },
        estimatedACOS: 18.5,
      });
    }
    if (prompt.includes("选品") || prompt.includes("product")) {
      return JSON.stringify({
        recommendations: [
          { name: "Interactive Cat Toy", score: 88, reason: "High demand, low competition" },
          { name: "Smart Pet Camera", score: 76, reason: "Growing trend, moderate competition" },
        ],
        marketTrend: "upward",
        confidence: 0.85,
      });
    }
    return `Mock AI response for: ${prompt.slice(0, 100)}...`;
  }

  private generateMockAnalysis<T>(prompt: string, data: unknown): T {
    if (prompt.includes("risk") || prompt.includes("风险")) {
      return { level: "medium", score: 65, factors: ["ODR升高", "侵权投诉"] } as T;
    }
    if (prompt.includes("sentiment") || prompt.includes("情感")) {
      return { positive: 72, negative: 15, neutral: 13, summary: "总体正面" } as T;
    }
    return { result: "mock_analysis", confidence: 0.8, data } as T;
  }
}
