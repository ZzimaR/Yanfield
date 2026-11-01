#!/usr/bin/env node
/**
 * 生成 04-ai-diff.png（AI 改稿的逐块 diff 审阅态）
 * ---------------------------------------------------------------------------
 * 与 capture-screenshots.mjs 的区别：这张图不能靠「打开页面」得到，必须先真实
 * 发起一次 AI 任务，让 AI 返回一条正文操作（追加/替换），再点「逐块审阅」打开
 * diff 审阅面板。本脚本用 CDP 直接驱动页面完成这条真实交互，不伪造 AI 状态。
 *
 * 前置条件：
 *   1. 另开终端跑 `pnpm dev` 或 `pnpm start`（默认 http://127.0.0.1:3000）；
 *   2. 本机装有 Edge 或 Chrome；
 *   3. 设置页里至少有一个可用的模型 Provider（没配 API Key 时也可用「离线演示模式」）。
 *
 * 用法：
 *   node scripts/capture-diff-screenshot.mjs
 *   node scripts/capture-diff-screenshot.mjs --base http://127.0.0.1:3000
 *   node scripts/capture-diff-screenshot.mjs --novel nov_xxx --chapter chp_yyy
 *   node scripts/capture-diff-screenshot.mjs --task 润色        # 需要先在正文里选中文本
 *
 * 注意：脚本会点击「续写」并在弹层里点「逐块审阅」，整个过程不会把 AI 结果写进正文
 * （diff 面板只是预览），因此可以安全地对示例作品运行。
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------- 参数 ---------------------------------- */

function parseArgs(argv) {
  const options = {
    base: process.env.YANFIELD_URL || "http://127.0.0.1:3000",
    out: path.join(ROOT, "docs", "screenshots", "04-ai-diff.png"),
    browser: "",
    novel: "",
    chapter: "",
    task: "续写",
    width: 1440,
    height: 900,
    wait: 3200,
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
        options.base = next().replace(/\/$/, "");
        break;
      case "--out":
        options.out = path.resolve(ROOT, next());
        break;
      case "--browser":
        options.browser = next();
        break;
      case "--novel":
        options.novel = next();
        break;
      case "--chapter":
        options.chapter = next();
        break;
      case "--task":
        options.task = next();
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
      default:
        throw new Error(`未知参数：${arg}`);
    }
  }
  return options;
}

/* -------------------------------- 浏览器探测 ------------------------------- */

function detectBrowser(explicit) {
  const candidates = [
    explicit,
    process.env.YANFIELD_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((item) => existsSync(item)) || "";
}

/* -------------------------------- CDP 客户端 ------------------------------- */

async function launchBrowser(executable) {
  const profile = mkdtempSync(path.join(os.tmpdir(), "yantian-diff-"));
  const child = spawn(
    executable,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let port = null;
  let buffer = "";
  const onData = (chunk) => {
    buffer += String(chunk);
    const match = buffer.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
    if (match && !port) port = Number(match[1]);
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  const deadline = Date.now() + 20_000;
  while (!port && Date.now() < deadline) await sleep(120);
  if (!port) {
    child.kill();
    throw new Error(`启动浏览器失败（未找到 DevTools 端口）\n${buffer.slice(0, 2000)}`);
  }
  return { child, port };
}

async function openPage(port) {
  let wsUrl = "";
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((target) => target.type === "page");
      if (page) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await sleep(150);
  }
  if (!wsUrl) throw new Error("找不到可连接的页面 target");
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    socket.onopen = () =>
      resolve({
        send(method, params = {}) {
          id += 1;
          const current = id;
          return new Promise((ok, bad) => {
            pending.set(current, { ok, bad });
            socket.send(JSON.stringify({ id: current, method, params }));
          });
        },
        async evaluate(expression) {
          const res = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
          if (res.exceptionDetails) throw new Error(res.exceptionDetails.text || "页面脚本执行失败");
          return res.result?.value;
        },
        close() {
          socket.close();
        },
      });
    socket.onerror = () => reject(new Error("CDP 连接失败"));
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { ok, bad } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) bad(new Error(JSON.stringify(msg.error)));
        else ok(msg.result);
      }
    };
  });
}

/* ------------------------------ 作品/章节发现 ------------------------------ */

async function discoverTargets(options) {
  if (options.novel && options.chapter) return { novelId: options.novel, chapterId: options.chapter };
  try {
    const listRes = await fetch(`${options.base}/api/novels`);
    const list = await listRes.json();
    const items = Array.isArray(list?.items) ? list.items : [];
    const novel = items.find((item) => item.author === "砚田示例") || items[0];
    if (!novel) throw new Error("没有作品，请先打开 /library 新建作品或运行示例数据");
    let chapterId = options.chapter;
    if (!chapterId) {
      const tree = await (await fetch(`${options.base}/api/novels/${novel.id}/tree`)).json();
      const chapters = [
        ...(Array.isArray(tree?.looseChapters) ? tree.looseChapters : []),
        ...(Array.isArray(tree?.volumes) ? tree.volumes.flatMap((volume) => volume.chapters ?? []) : []),
      ];
      chapterId = (chapters.find((chapter) => (chapter.wordCount ?? 0) > 0) || chapters[0])?.id ?? "";
    }
    if (!chapterId) throw new Error("作品里还没有章节，请先新建一章");
    return { novelId: novel.id, chapterId };
  } catch (error) {
    throw new Error(`自动发现作品/章节失败：${error instanceof Error ? error.message : String(error)}。可用 --novel/--chapter 指定。`);
  }
}

/* ---------------------------------- 主流程 --------------------------------- */

async function main() {
  const options = parseArgs(process.argv);
  const browser = detectBrowser(options.browser);
  if (!browser) throw new Error("找不到 Edge/Chrome，请用 --browser 指定浏览器可执行文件路径。");

  const { novelId, chapterId } = await discoverTargets(options);
  const url = `${options.base}/editor/${novelId}?chapterId=${chapterId}`;
  console.log("[diff 截图] 浏览器：", browser);
  console.log("[diff 截图] 页面：", url);

  const { child, port } = await launchBrowser(browser);
  const client = await openPage(port);
  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: options.width,
      height: options.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send("Page.navigate", { url });
    await sleep(options.wait);

    // 1. 点 AI 快捷任务（默认「续写」；润色/扩写等需要先选中正文）
    const clicked = await client.evaluate(`(() => {
      const label = ${JSON.stringify(options.task)};
      const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label);
      if (!btn) return 'not-found';
      btn.click();
      return 'clicked';
    })()`);
    if (clicked !== "clicked") throw new Error(`页面上找不到「${options.task}」按钮（确认应用已启动、当前章节可编辑）`);
    console.log("[diff 截图] 已发起 AI 任务：", options.task);

    // 2. 等 AI 返回正文操作，点「逐块审阅」
    let review = "not-found";
    for (let i = 0; i < 20; i += 1) {
      await sleep(700);
      review = await client.evaluate(`(() => {
        const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '逐块审阅');
        if (!btn) return 'not-found';
        btn.click();
        return 'clicked';
      })()`);
      if (review === "clicked") break;
    }
    if (review !== "clicked") throw new Error("AI 没有返回可审阅的正文操作（检查 Provider/模型配置，或先在正文里选中一段文字）");
    await sleep(1600);

    const shot = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(options.out, Buffer.from(shot.data, "base64"));
    console.log(`[diff 截图] ✓ 已写入 ${options.out}`);
  } finally {
    client.close();
    child.kill();
  }
}

main().catch((error) => {
  console.error("[diff 截图] ✗", error instanceof Error ? error.message : error);
  process.exit(1);
});
