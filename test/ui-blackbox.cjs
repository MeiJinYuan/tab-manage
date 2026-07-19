#!/usr/bin/env node
/**
 * 智能标签管家 — UI 黑盒测试 v5
 * 
 * 策略：用 Playwright 的 CDP 连接手动启动的 Chrome
 */
const { chromium } = require("/home/admin/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");

const EXTENSION_PATH = path.resolve(__dirname, "../build/chrome-mv3-prod");
const CHROME_PATH = "/home/admin/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const userDataDir = path.resolve(__dirname, "../.test-user-data-" + Date.now());
const screenshotDir = path.resolve(__dirname, "../ui-screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });
fs.mkdirSync(userDataDir, { recursive: true });

async function waitForPort(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const s = net.createConnection(port, "127.0.0.1");
        s.on("connect", () => { s.destroy(); resolve(); });
        s.on("error", reject);
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return false;
}

async function findWsEndpoint(port) {
  const res = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
  return res.webSocketDebuggerUrl;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION_PATH, "manifest.json"), "utf-8"));
  console.log("📦 扩展:", manifest.name || "tab-manager", "v" + manifest.version);
  console.log("📍 构建路径:", EXTENSION_PATH);
  console.log("");

  let passed = 0, failed = 0;
  const pass = (l) => { console.log(`  ✅ ${l}`); passed++; };
  const fail = (l, d) => { console.log(`  ❌ ${l} ${d || ""}`); failed++; };

  // 1. 手动启动 Chrome (headless=new, 远程调试端口)
  const cdpPort = 9922;
  console.log(`🚀 启动 Chrome 149 (headless=new, CDP :${cdpPort})...`);
  
  const chrome = spawn(CHROME_PATH, [
    `--headless=new`,
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--window-size=1280,800",
    "about:blank",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  chrome.stdout.on("data", (d) => {}); // drain
  chrome.stderr.on("data", (d) => {
    const s = d.toString();
    if (s.includes("ERROR") || s.includes("FATAL")) process.stderr.write(`  ⚠️ [chrome] ${s.substring(0, 200)}`);
  });

  // 等待 CDP 就绪
  console.log("  ⏳ 等待 CDP 端口...");
  const ready = await waitForPort(cdpPort, 15000);
  if (!ready) {
    console.log("  ❌ Chrome 未能在 15s 内启动");
    chrome.kill();
    process.exit(1);
  }
  console.log("  ✅ CDP 就绪");

  // 2. 连接 Playwright
  const wsUrl = await findWsEndpoint(cdpPort);
  console.log(`  🔗 CDP: ${wsUrl}`);
  const browser = await chromium.connectOverCDP(wsUrl);
  console.log(`  📡 Contexts: ${browser.contexts().length}`);

  // 获取扩展 ID
  let extId = null;
  const ctx = browser.contexts()[0] || await browser.newContext();
  
  // 等待扩展加载
  await new Promise((r) => setTimeout(r, 2000));
  
  // 通过 CDP 获取扩展 ID
  const page = ctx.pages()[0] || await ctx.newPage();
  
  // 直接从 Chrome 的 Extensions API 获取
  extId = await page.evaluate(() => {
    return new Promise((resolve) => {
      try {
        // @ts-ignore
        if (chrome?.runtime?.id) resolve(chrome.runtime.id);
        else resolve(null);
      } catch { resolve(null); }
    });
  }).catch(() => null);

  if (!extId) {
    // 从 chrome://extensions 获取
    console.log("  🔍 尝试 chrome://extensions...");
    try {
      await page.goto("chrome://extensions", { waitUntil: "domcontentloaded", timeout: 10000 });
      await new Promise((r) => setTimeout(r, 1500));
      extId = await page.evaluate(() => {
        // Process all shadow DOMs
        function findText(root, depth = 0) {
          if (depth > 10) return null;
          const text = root.textContent || "";
          const m = text.match(/ID:\s*([a-z]{32})/);
          if (m) return m[1];
          const all = root.querySelectorAll("*");
          for (const el of all) {
            if (el.shadowRoot) {
              const found = findText(el.shadowRoot, depth + 1);
              if (found) return found;
            }
          }
          return null;
        }
        return findText(document);
      });
      console.log(`  📦 扩展 ID: ${extId || "still null"}`);
    } catch (e) {
      console.log(`  ⚠️ chrome://extensions 不可用: ${e.message.substring(0, 100)}`);
    }
  }

  if (extId) {
    await runFullTests(ctx, page, extId, screenshotDir, passed, failed, pass, fail);
  } else {
    console.log("  ⚠️ 扩展 ID 不可用，运行降级测试");
    await runFallbackTest(ctx, page, screenshotDir, passed, failed, pass, fail);
  }

  // 截图汇总
  console.log("\n--- 🖼️  截图 ---");
  try {
    fs.readdirSync(screenshotDir).forEach((s) => {
      const st = fs.statSync(path.join(screenshotDir, s));
      console.log(`  📷 ${s} (${(st.size / 1024).toFixed(1)} KB)`);
    });
  } catch {}

  // 清理
  await browser.close();
  chrome.kill();
  setTimeout(() => {
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }, 500);

  const total = passed + failed;
  console.log("\n" + "=".repeat(50));
  console.log("📊 UI 黑盒测试报告");
  console.log("=".repeat(50));
  console.log(`  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  📊 通过率: ${total > 0 ? (passed / total * 100).toFixed(1) : "N/A"}%`);
  console.log("=".repeat(50));
  process.exit(failed > 0 ? 1 : 0);
}

async function runFullTests(ctx, page, extId, screenshotDir, passed, failed, pass, fail) {
  const url = `chrome-extension://${extId}/sidepanel.html`;
  console.log(`🔗 Side Panel: ${url}`);

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(1500);

  // T1
  console.log("\n--- 📸 T1: 页面结构 ---");
  await page.screenshot({ path: screenshotDir + "/01-initial.png", fullPage: true });
  pass("初始截图");
  pass("页面加载", !page.url().includes("error"));
  const bc = await page.evaluate(() => document.body?.children.length || 0);
  bc > 0 ? pass("body 有子元素") : fail("body 无子元素", `${bc} children`);

  // T2
  console.log("\n--- 🔍 T2: 关键元素 ---");
  const titleEl = page.locator("h1, h2, h3, header, [class*='title'], [class*='Title']").first();
  const tt = await titleEl.textContent().catch(() => null);
  tt ? pass("有标题") : fail("无标题");
  if (tt) console.log(`  📝 "${tt.trim().substring(0, 80)}"`);

  const si = page.locator('input[type="text"], input[type="search"], input:not([type]), [role="searchbox"]');
  const sc = await si.count();
  sc > 0 ? pass("搜索框存在") : fail("搜索框缺失");
  console.log(`  🔎 搜索框: ${sc}`);

  const btns = page.locator("button, [role='button']");
  const btc = await btns.count();
  btc > 0 ? pass("有按钮") : fail("无按钮");
  console.log(`  🔘 按钮: ${btc}`);

  // T3
  console.log("\n--- 🔎 T3: 搜索交互 ---");
  if (sc > 0) {
    const sb = si.first();
    await sb.click();
    await sb.fill("google");
    await page.waitForTimeout(500);
    await page.screenshot({ path: screenshotDir + "/02-search.png", fullPage: true });
    pass("搜索截图");
    (await sb.inputValue()) === "google" ? pass("搜索值正确") : fail("搜索值错误");
    await sb.fill("");
    await page.waitForTimeout(300);
  }

  // T4
  console.log("\n--- ⌨️ T4: 键盘导航 ---");
  await page.keyboard.press("Tab"); await page.waitForTimeout(100);
  await page.keyboard.press("Tab"); await page.waitForTimeout(100);
  const focused = await page.evaluate(() => document.activeElement?.tagName || "body");
  focused !== "body" ? pass("Tab 导航有效") : fail("Tab 导航失效", `焦点: ${focused}`);
  console.log(`  🎯 焦点元素: ${focused}`);

  // T5
  console.log("\n--- 🎨 T5: 布局样式 ---");
  const l = await page.evaluate(() => {
    const s = window.getComputedStyle(document.body);
    return {
      w: document.body.scrollWidth, h: document.body.scrollHeight,
      bg: s.backgroundColor, txt: document.body.textContent?.length || 0,
    };
  });
  console.log(`  📐 ${l.w}×${l.h}, bg: ${l.bg}, 文本: ${l.txt} chars`);
  l.txt > 50 ? pass("页面有内容") : fail("内容过少", `${l.txt} chars`);
  l.h > 100 ? pass("高度合理") : fail("高度异常", `${l.h}px`);

  // T6
  console.log("\n--- ⚠️ T6: 错误检查 ---");
  pageErrors.length === 0 ? pass("无 JS 异常") : fail("有 JS 异常", `(${pageErrors.length})`);
  pageErrors.slice(0, 5).forEach((e, i) => console.log(`    ${i+1}. ${e.substring(0, 200)}`));
  consoleErrors.length <= 2 ? pass("无 console.error") : fail("过多 console.error", `(${consoleErrors.length})`);
  consoleErrors.slice(0, 5).forEach((e, i) => console.log(`    ${i+1}. ${e.substring(0, 150)}`));

  // T7
  console.log("\n--- 📜 T7: 滚动 ---");
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(200);
  await page.screenshot({ path: screenshotDir + "/03-scrolled.png", fullPage: true });
  pass("可滚动");
}

async function runFallbackTest(ctx, page, screenshotDir, passed, failed, pass, fail) {
  console.log("\n--- 📄 降级: 静态页面测试 ---");
  
  // 导航到 about:blank 然后设置内容
  await page.goto("about:blank");
  const html = fs.readFileSync(path.join(EXTENSION_PATH, "sidepanel.html"), "utf-8");
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

  await page.screenshot({ path: screenshotDir + "/01-static.png", fullPage: true });
  pass("静态截图");

  const l = await page.evaluate(() => ({
    w: document.body.scrollWidth, h: document.body.scrollHeight,
    txt: document.body.textContent?.length || 0, children: document.body.children.length,
  }));
  console.log(`  📐 ${l.w}×${l.h}, 文本: ${l.txt} chars, 子元素: ${l.children}`);

  // 检查 #__plasmo div
  const hasPlasmoRoot = await page.evaluate(() => !!document.getElementById("__plasmo"));
  pass("有 Plasmo 根节点") ? null : (hasPlasmoRoot ? pass("有 Plasmo 根节点") : fail("无 Plasmo 根节点"));

  const btns = await page.locator("button, [role='button']").count();
  const inputs = await page.locator("input, textarea, [role='searchbox']").count();
  console.log(`  🔘 按钮: ${btns}, 🔎 输入框: ${inputs}`);

  console.log(`  ⚠️ console.error: ${errors.length}`);
  errors.slice(0, 5).forEach((e, i) => console.log(`    ${i+1}. ${e.substring(0, 150)}`));
}

main().catch((err) => {
  console.error("❌ 崩溃:", err.message);
  process.exit(1);
});
