/**
 * FlowMind 性能 Benchmark 脚本
 *
 * 对关键页面跑 Lighthouse（仅 performance 类目），输出 JSON 报告 + 终端摘要表。
 *
 * 用法：
 *   bun scripts/benchmark.mjs --base=http://localhost:3000 --tag=baseline
 *   bun scripts/benchmark.mjs --base=http://localhost:3000 --tag=after
 *
 * 报告输出目录：.trae/specs/optimize-performance-benchmark/lighthouse/<tag>/
 * Chrome 检测顺序：环境变量 CHROME_PATH → Chrome → Edge → Playwright chromium。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

// ── 参数解析 ─────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
  }),
);

const BASE = (args.base || "http://localhost:3000").replace(/\/$/, "");
const TAG = args.tag || "run";
const PAGES = ["/dashboard", "/tasks", "/content-studio", "/workflows/ai-advertising"];
const OUT_DIR = join(
  process.cwd(),
  ".trae",
  "specs",
  "optimize-performance-benchmark",
  "lighthouse",
  TAG,
);

// ── Chrome 可执行文件检测 ────────────────────────────────
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const c of candidates) if (existsSync(c)) return c;

  // Playwright 托管 chromium
  const pwDir = join(homedir(), "AppData", "Local", "ms-playwright");
  try {
    for (const dir of readdirSync(pwDir)) {
      if (!dir.startsWith("chromium-")) continue;
      const exe = join(pwDir, dir, "chrome-win", "chrome.exe");
      if (existsSync(exe)) return exe;
    }
  } catch {}
  return null;
}

// ── 主流程 ───────────────────────────────────────────────
const chrome = findChrome();
if (!chrome) {
  console.error("❌ 未找到 Chrome/Edge，请设置 CHROME_PATH 环境变量");
  process.exit(1);
}
console.log(`使用浏览器: ${chrome}`);
mkdirSync(OUT_DIR, { recursive: true });

const results = [];

for (const page of PAGES) {
  const url = `${BASE}${page}`;
  const jsonPath = join(OUT_DIR, `${page.replace(/\//g, "_")}.json`);
  console.log(`\n▶ Lighthouse: ${url}`);

  const res = spawnSync(
    "bunx",
    [
      "lighthouse",
      url,
      "--output=json",
      `--output-path=${jsonPath}`,
      "--only-categories=performance",
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
      "--quiet",
    ],
    {
      stdio: "inherit",
      shell: true,
      timeout: 180_000,
      // chrome-launcher 只认 CHROME_PATH 环境变量
      env: { ...process.env, CHROME_PATH: chrome },
    },
  );

  if (res.status !== 0 || !existsSync(jsonPath)) {
    console.error(`✗ ${page} 采集失败`);
    results.push({ page, error: "failed" });
    continue;
  }

  const report = JSON.parse(readFileSync(jsonPath, "utf8"));
  const a = report.audits;
  results.push({
    page,
    perfScore: Math.round((report.categories.performance.score ?? 0) * 100),
    fcp: a["first-contentful-paint"]?.displayValue ?? "n/a",
    lcp: a["largest-contentful-paint"]?.displayValue ?? "n/a",
    tbt: a["total-blocking-time"]?.displayValue ?? "n/a",
    cls: a["cumulative-layout-shift"]?.displayValue ?? "n/a",
    tti: a["interactive"]?.displayValue ?? "n/a",
  });
}

// ── 摘要表 ───────────────────────────────────────────────
console.log(`\n========== Benchmark 摘要（tag=${TAG}, base=${BASE}）==========`);
console.log(
  "page".padEnd(28) + "perf".padEnd(6) + "FCP".padEnd(12) + "LCP".padEnd(12) + "TBT".padEnd(12) + "TTI",
);
for (const r of results) {
  if (r.error) {
    console.log(`${r.page.padEnd(28)}FAILED`);
    continue;
  }
  console.log(
    r.page.padEnd(28) +
      String(r.perfScore).padEnd(6) +
      r.fcp.padEnd(12) +
      r.lcp.padEnd(12) +
      r.tbt.padEnd(12) +
      r.tti,
  );
}

writeFileSync(
  join(OUT_DIR, "summary.json"),
  JSON.stringify({ base: BASE, tag: TAG, date: new Date().toISOString(), results }, null, 2),
);
console.log(`\n✅ 摘要已写入 ${join(OUT_DIR, "summary.json")}`);
