#!/usr/bin/env node
/**
 * 砚田产品截图脚本
 * ---------------------------------------------------------------------------
 * 用本机已安装的 Edge / Chrome 无头模式 + CDP，把正在运行的应用页面截成 PNG，
 * 输出到 docs/screenshots/（文件名与 docs/screenshots/README.md 的清单一致）。
 *
 * 前置条件：
 *   1. 另开一个终端跑 `pnpm dev`（或 `pnpm start`），应用已在监听；
 *   2. 本机装有 Edge 或 Chrome（脚本会自动探测常见安装路径）。
 *
 * 用法：
 *   node scripts/capture-screenshots.mjs
 *   node scripts/capture-screenshots.mjs --base http://127.0.0.1:3000
 *   node scripts/capture-screenshots.mjs --out docs/screenshots --wait 1500
 *   node scripts/capture-screenshots.mjs --chrome "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
 *   node scripts/capture-screenshots.mjs --novel nov_xxx --chapter chp_yyy   # 跳过自动发现
 *   node scripts/capture-screenshots.mjs --only library,settings             # 只截部分页面
 *   node scripts/capture-screenshots.mjs --dark                              # 追加一张深色编辑器
 *
 * 说明：
 *   - 脚本**不会**启动服务器，也不会启动 dev/build；
 *   - 动态路由通过 REST API 自动发现「第一个作品 + 第一个有正文的章节」；
 *   - `04-ai-diff.png`（AI 建议的逐块 diff 态）需要真实发起一次 AI 任务后才有，
 *     脚本会在编辑器里尝试点「润色」按钮；失败时跳过并给出提示，可在浏览器里手动补截；
 *   - 每张图会打印页面标题、正文长度与前端异常数量，异常数 > 0 时以非 0 退出。
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------------------------- 参数 ---------------------------------- */

function parseArgs(argv) {
  const options = {
    base: process.env.YANTIAN_URL || "http://127.0.0.1:3000",
    out: path.join(ROOT, "docs", "screenshots"),
    chrome: "",
    width: 1440,
    height: 900,
    wait: 1400,
    novel: "",
    chapter: "",
    only: "",
    dark: false,
    timeout: 60_000,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`参数 ${arg} 缺少取值`);
      return argv[i];
    };
    switch (arg) {
      case "--base":
        options.base = next();
        break;
      case "--out":
        options.out = path.resolve(ROOT, next());
        break;
      case "--chrome":
        options.chrome = next();
        break;
      case "--width":
        options.width = Number(next());
        break;
      case "--height":
        options.height = Number(next());
        break;
      case "--wait":
        options.wait = Number(next());
        break;
      case "--novel":
        options.novel = next();
        break;
      case "--chapter":
        options.chapter = next();
        break;
      case "--only":
        options.only = next();
        break;
      case "--dark":
        options.dark = true;
        break;
      case "--timeout":
        options.timeout = Number(next());
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--")) throw new Error(`未知参数：${arg}`);
    }
  }
  options.base = options.base.replace(/\/+$/, "");
  return options;
}

function printHelp() {
  console.log(`
砚田截图脚本

  node scripts/capture-screenshots.mjs [选项]

选项：
  --base <url>       应用地址，默认 http://127.0.0.1:3000
  --out <dir>        输出目录，默认 docs/screenshots
  --chrome <path>    手动指定浏览器可执行文件
  --width/--height   视口尺寸，默认 1440x900
  --wait <ms>        每页截图前等待，默认 1400
  --novel <id>       指定作品 ID（跳过 API 自动发现）
  --chapter <id>     指定章节 ID（跳过 API 自动发现）
  --only <a,b>       只截指定页面（landing/library/editor/outline/bible/archives/settings/provider-settings/context-drawer/dark）
  --dark             追加一张深色模式编辑器 09-dark-editor.png
  --timeout <ms>     单次浏览器超时，默认 60000

前置：先在另一个终端跑 pnpm dev；本脚本不会启动服务器。
`);
}

/* -------------------------------- 浏览器探测 -------------------------------- */

function findBrowser(executablePath) {
  if (executablePath) {
    if (!existsSync(executablePath)) throw new Error(`指定的浏览器不存在：${executablePath}`);
    return executablePath;
  }
  const platform = process.platform;
  const candidates = [];
  if (platform === "win32") {
    const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const localAppData = process.env["LOCALAPPDATA"] || path.join(os.homedir(), "AppData", "Local");
    candidates.push(
      path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    );
  } else if (platform === "darwin") {
    candidates.push(
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    candidates.push(
      "/usr/bin/microsoft-edge",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    );
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "未找到 Edge/Chrome。请安装其中之一，或用 --chrome 指定可执行文件路径。\n" +
      "常见路径：\n" +
      "  Windows: C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe\n" +
      "  macOS:   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n" +
      "  Linux:   /usr/bin/google-chrome",
  );
}

/* -------------------------------- 服务探测 -------------------------------- */

async function waitForServer(base, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base, { redirect: "manual" });
      if (response.status < 500) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(
    `无法访问 ${base}（${lastError}）。请先在另一个终端执行 \`pnpm dev\`，确认地址后再跑本脚本。`,
  );
}

/* -------------------------------- 示例数据发现 -------------------------------- */

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.json();
}

/** 通过 REST API 找到示例作品的 id 与「第一个有正文的章节」id，用于动态路由。 */
async function discoverIds(base) {
  try {
    const novels = await fetchJson(`${base}/api/novels`);
    const list = Array.isArray(novels?.items) ? novels.items : Array.isArray(novels) ? novels : [];
    if (list.length === 0) return { novelId: "", chapterId: "" };
    const preferred = list.find((novel) => novel?.author === "砚田示例") || list[0];
    if (!preferred?.id) return { novelId: "", chapterId: "" };

    const tree = await fetchJson(`${base}/api/novels/${preferred.id}/tree`);
    const volumes = Array.isArray(tree?.volumes) ? tree.volumes : [];
    const chapters = volumes.flatMap((volume) => (Array.isArray(volume?.chapters) ? volume.chapters : []));
    const loose = Array.isArray(tree?.looseChapters) ? tree.looseChapters : [];
    const all = [...chapters, ...loose];
    const withContent = all.find((chapter) => (chapter?.wordCount || 0) > 0) || all[0] || null;
    return { novelId: preferred.id, chapterId: withContent?.id || "" };
  } catch (error) {
    console.warn(`[截图] 自动发现示例作品失败：${error instanceof Error ? error.message : String(error)}`);
    return { novelId: "", chapterId: "" };
  }
}

/* ---------------------------------- CDP ---------------------------------- */

async function launchBrowser(browserPath, timeoutMs) {
  const profile = mkdtempSync(path.join(os.tmpdir(), "yantian-shot-"));
  const child = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let port = 0;
  let buffer = "";
  const onData = (chunk) => {
    buffer += String(chunk);
    const match = buffer.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (match && !port) port = Number(match[1]);
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  const deadline = Date.now() + Math.min(timeoutMs, 30_000);
  while (!port && Date.now() < deadline) await sleep(100);
  if (!port) {
    child.kill();
    throw new Error("浏览器未能在 30 秒内开启 DevTools 调试端口。\n" + buffer.slice(0, 2000));
  }
  return { child, port };
}

async function openPage(port, timeoutMs) {
  const deadline = Date.now() + Math.min(timeoutMs, 20_000);
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return connect(page.webSocketDebuggerUrl);
    } catch {
      /* 继续重试 */
    }
    await sleep(150);
  }
  throw new Error("找不到可用的浏览器页面目标。");
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    const events = [];
    let messageId = 0;
    socket.onopen = () =>
      resolve({
        send(method, params = {}) {
          messageId += 1;
          const current = messageId;
          return new Promise((resolveCall, rejectCall) => {
            pending.set(current, { resolve: resolveCall, reject: rejectCall });
            socket.send(JSON.stringify({ id: current, method, params }));
          });
        },
        events,
        close: () => socket.close(),
      });
    socket.onerror = () => reject(new Error("连接浏览器调试端口失败"));
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { resolve: resolveCall, reject: rejectCall } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) rejectCall(new Error(JSON.stringify(message.error)));
        else resolveCall(message.result);
      } else if (message.method) {
        events.push(message);
      }
    };
  });
}

/* ---------------------------------- 截图 ---------------------------------- */

async function capture(client, page, options) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: page.width || options.width,
    height: page.height || options.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send("Page.navigate", { url: page.url });
  await sleep(page.wait || options.wait);

  if (page.theme) {
    await client.send("Runtime.evaluate", {
      expression: `document.documentElement.dataset.theme = ${JSON.stringify(page.theme)};`,
    });
    await sleep(400);
  }

  if (page.prepare) {
    const prepared = await client.send("Runtime.evaluate", {
      expression: page.prepare,
      awaitPromise: true,
      returnByValue: true,
    });
    if (prepared.exceptionDetails) {
      throw new Error(`页面准备脚本失败：${JSON.stringify(prepared.exceptionDetails)}`);
    }
    await sleep(900);
  }

  const result = await client.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      title: document.title,
      textLength: (document.body ? document.body.innerText : "").length,
      text: (document.body ? document.body.innerText : "").slice(0, 240)
    })`,
    returnByValue: true,
  });
  const payload = JSON.parse(result.result.value);
  const clientErrors = (client.events || []).filter(
    (event) =>
      event.method === "Runtime.exceptionThrown" ||
      (event.method === "Log.entryAdded" && event.params.entry.level === "error"),
  ).length;

  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const file = path.join(options.out, `${page.name}.png`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(file, Buffer.from(screenshot.data, "base64"));

  const sizeKb = (statSync(file).size / 1024).toFixed(0);
  const flag = clientErrors > 0 ? `  ⚠ ${clientErrors} 个前端错误` : "";
  console.log(`  ✓ ${page.name}.png  ${page.url}  (${sizeKb} KB)${flag}`);
  return { name: page.name, title: payload.title, textLength: payload.textLength, errors: clientErrors };
}

/* ---------------------------------- 主流程 ---------------------------------- */

function assertPositiveInt(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`参数 ${name} 必须是正数`);
  return Math.round(value);
}

async function main() {
  const options = parseArgs(process.argv);
  options.width = assertPositiveInt(options.width, "--width");
  options.height = assertPositiveInt(options.height, "--height");
  options.wait = Math.max(0, Math.round(options.wait));
  options.timeout = assertPositiveInt(options.timeout, "--timeout");

  const browserPath = findBrowser(options.chrome);
  mkdirSync(options.out, { recursive: true });

  console.log(`[截图] 浏览器：${browserPath}`);
  console.log(`[截图] 目标：${options.base}`);
  console.log(`[截图] 输出：${options.out}`);
  await waitForServer(options.base, options.timeout);

  let novelId = options.novel;
  let chapterId = options.chapter;
  if (!novelId || !chapterId) {
    const discovered = await discoverIds(options.base);
    novelId = novelId || discovered.novelId;
    chapterId = chapterId || discovered.chapterId;
  }
  if (!novelId) {
    console.warn(
      "[截图] 找不到作品 ID，将跳过作品内页面（大纲/资料卡/档案/编辑器）。" +
        "可先打开 /library 新建作品，或用 --novel/--chapter 指定。",
    );
  }
  const novelUrl = (suffix) => (novelId ? `${options.base}/novel/${novelId}/${suffix}` : "");
  const editorUrl =
    novelId && chapterId
      ? `${options.base}/editor/${novelId}?chapterId=${chapterId}`
      : novelId
        ? `${options.base}/editor/${novelId}`
        : "";

  const pages = [
    { name: "01-home", url: `${options.base}/` },
    { name: "02-library", url: `${options.base}/library` },
    { name: "05-outline-blue", url: novelUrl("outline") },
    { name: "06-bible", url: novelUrl("bible") },
    { name: "07-archives", url: novelUrl("archives") },
    { name: "03-editor-blue", url: editorUrl },
    { name: "08-settings", url: `${options.base}/settings` },
    {
      name: "10-provider-settings",
      url: `${options.base}/settings`,
      width: options.width,
      height: 1000,
      prepare: `(async () => {
        const find = () => [...document.querySelectorAll("h2, h3, h4, div, p")].find((el) => (el.textContent || "").includes("快速添加主流服务商"));
        let el = find();
        for (let i = 0; i < 40 && !el; i += 1) { await new Promise((r) => setTimeout(r, 250)); el = find(); }
        if (el) el.scrollIntoView({ block: "center" });
        await new Promise((r) => setTimeout(r, 500));
        return el ? "scrolled" : "missing-section";
      })()`,
    },
    {
      name: "11-context-drawer",
      url: editorUrl,
      prepare: `(async () => {
        const find = () => [...document.querySelectorAll("button")].find((b) => /上下文/.test(b.textContent || ""));
        let btn = find();
        for (let i = 0; i < 40 && !btn; i += 1) { await new Promise((r) => setTimeout(r, 300)); btn = find(); }
        if (!btn) return "missing-context-button";
        btn.click();
        for (let i = 0; i < 30; i += 1) {
          await new Promise((r) => setTimeout(r, 150));
          if (document.body.innerText.includes("上下文预览")) return "opened";
        }
        return "drawer-not-found";
      })()`,
    },
    {
      name: "12-settings",
      url: `${options.base}/library`,
      prepare: `(async () => {
        for (let i = 0; i < 40 && !document.body.innerText.includes("潮信"); i += 1) {
          await new Promise((r) => setTimeout(r, 250));
        }
        const find = () => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "设置");
        const btn = find();
        if (!btn) return "missing-settings-button";
        btn.click();
        for (let i = 0; i < 40; i += 1) {
          await new Promise((r) => setTimeout(r, 200));
          if (document.querySelector('[role="dialog"]') && document.body.innerText.includes("快速添加主流服务商")) return "opened";
        }
        return "dialog-not-found";
      })()`,
    },
  ].filter((page) => page.url);
  if (options.dark) pages.push({ name: "09-editor-dark", url: editorUrl, theme: "dark" });

  let targets = pages;
  if (options.only) {
    const wanted = new Set(
      options.only
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    );
    targets = pages.filter((page) => wanted.has(page.name.replace(/^\d+-/, "")));
  }
  if (targets.length === 0) {
    console.log("[截图] 没有可截取的页面，退出。");
    return;
  }

  const { child, port } = await launchBrowser(browserPath, options.timeout);
  const client = await openPage(port, options.timeout);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");

  const results = [];
  let failed = 0;
  for (const page of targets) {
    try {
      client.events.length = 0;
      results.push(await capture(client, page, options));
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${page.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  client.close();
  child.kill();

  console.log("");
  const errorPages = results.filter((item) => item.errors > 0);
  if (failed > 0 || errorPages.length > 0) {
    console.log(
      `[截图] 完成，${failed} 张失败${errorPages.length ? `，${errorPages.length} 张页面有前端错误` : ""}。`,
    );
    process.exitCode = 1;
  } else {
    console.log(`[截图] 完成，共 ${results.length} 张，已写入 ${options.out}`);
  }
  console.log(
    "[截图] 提示：04-ai-diff.png 需要先真实发起一次 AI 任务 → diff 审阅态后人工补截（脚本不伪造 AI 状态）。",
  );
}

main().catch((error) => {
  console.error(`\n[截图] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
