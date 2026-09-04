/**
 * FlowMind — Ziniao Bridge Client
 * HTTP client for the local Ziniao Browser anti-detect browser bridge
 * Docs: D:\RakClaw\skills\ziniao-assistant\SKILL.md
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const DEFAULT_BASE_URL = "http://127.0.0.1:9481";
const CONFIG_PATH = join(homedir(), ".zclaw", "config.json");

interface ZiniaoConfig {
  apiKey: string;
  baseUrl: string;
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface InvokeResponse {
  ret: number;
  data?: unknown;
  msg?: string;
}

// Cache allowed tools per session
let cachedTools: string[] | null = null;

function loadConfig(): ZiniaoConfig {
  // 1. Environment variables
  const envKey = process.env.ZCLAW_API_KEY;
  const envUrl = process.env.ZCLAW_BASE_URL || process.env.ZINIAO_ZCLAW_BASE_URL;

  if (envKey) {
    return { apiKey: envKey, baseUrl: envUrl || DEFAULT_BASE_URL };
  }

  // 2. Config file
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return {
        apiKey: raw.ZCLAW_API_KEY || "",
        baseUrl: raw.ZCLAW_BASE_URL || envUrl || DEFAULT_BASE_URL,
      };
    } catch { /* ignore parse errors */ }
  }

  return { apiKey: "", baseUrl: envUrl || DEFAULT_BASE_URL };
}

export function setApiKey(key: string): void {
  const dir = join(homedir(), ".zclaw");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let existing: Record<string, string> = {};
  if (existsSync(CONFIG_PATH)) {
    try { existing = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")); } catch { /* ignore */ }
  }
  existing.ZCLAW_API_KEY = key;
  writeFileSync(CONFIG_PATH, JSON.stringify(existing, null, 2));
}

/** GET /zclaw/tools — no auth required */
export async function discoverTools(): Promise<ToolDef[]> {
  const config = loadConfig();
  const res = await fetch(`${config.baseUrl}/zclaw/tools`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Ziniao bridge error: ${res.status}`);
  const json = await res.json() as { ret: number; data: ToolDef[] };
  cachedTools = json.data.map((t) => t.name);
  return json.data;
}

/** Get allowed tool names (cached) */
export async function getAllowedTools(): Promise<string[]> {
  if (cachedTools) return cachedTools;
  const tools = await discoverTools();
  return tools.map((t) => t.name);
}

/** POST /zclaw/tools/invoke — auth required */
export async function invoke(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const config = loadConfig();
  if (!config.apiKey) {
    throw new Error("Ziniao API key not configured. Set ZCLAW_API_KEY env or ~/.zclaw/config.json");
  }

  // Validate tool name
  const allowed = await getAllowedTools();
  if (!allowed.includes(tool)) {
    throw new Error(`Invalid tool "${tool}". Allowed: ${allowed.join(", ")}`);
  }

  const res = await fetch(`${config.baseUrl}/zclaw/tools/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ZClaw-Api-Key": config.apiKey,
    },
    body: JSON.stringify({ tool, args }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ziniao invoke error (${res.status}): ${text}`);
  }

  const json = await res.json() as InvokeResponse;
  if (json.ret !== 0 && json.msg) {
    throw new Error(`Ziniao error: ${json.msg}`);
  }
  return json.data;
}

/** Check if bridge is reachable */
export async function isBridgeAvailable(): Promise<boolean> {
  try {
    const config = loadConfig();
    const res = await fetch(`${config.baseUrl}/zclaw/tools`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ========== Convenience wrappers ==========

export interface ZiniaoStore {
  storeId: string;
  storeName: string;
  platformName: string;
  ip: string;
}

export async function listStores(): Promise<ZiniaoStore[]> {
  const data = await invoke("list_stores", { all: true }) as { items: ZiniaoStore[] };
  return data.items ?? [];
}

export async function openStore(storeId: string, launchUrl?: string): Promise<unknown> {
  const args: Record<string, unknown> = { storeId };
  if (launchUrl) args.launchUrl = launchUrl;
  return invoke("open_store", args);
}

export async function closeStore(storeId: string): Promise<unknown> {
  return invoke("close_store", { storeId });
}

export async function visitPage(storeId: string, url: string): Promise<unknown> {
  return invoke("visit_page", { storeId, url, waitUntil: "networkidle" });
}

export async function getPageContent(storeId: string, format: "text" | "html" | "structured" = "structured"): Promise<unknown> {
  return invoke("get_page_content", { storeId, format });
}

export async function queryElements(storeId: string, selector: string): Promise<unknown> {
  return invoke("query_elements", { storeId, selector });
}

export async function clickElement(storeId: string, selector: string): Promise<unknown> {
  return invoke("click_element", { storeId, selector });
}

export async function inputText(storeId: string, selector: string, text: string): Promise<unknown> {
  return invoke("input_text", { storeId, selector, text });
}

export async function takeScreenshot(storeId: string, fullPage = false): Promise<unknown> {
  return invoke("take_screenshot", { storeId, fullPage });
}

export async function executeScript(storeId: string, script: string): Promise<unknown> {
  return invoke("execute_script", { storeId, script });
}

export async function runAutomation(steps: Array<Record<string, unknown>>): Promise<unknown> {
  return invoke("run_automation", { steps });
}

export async function extractData(mode: string, storeId?: string): Promise<unknown> {
  const args: Record<string, unknown> = { mode };
  if (storeId) args.storeId = storeId;
  return invoke("extract_data", args);
}

export async function getLogs(): Promise<unknown> {
  return invoke("get_logs", {});
}
