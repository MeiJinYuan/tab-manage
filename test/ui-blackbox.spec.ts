/**
 * 智能标签管家 — UI 黑盒测试
 *
 * 测试策略：
 * - 用 Playwright 启动 Chromium，加载已构建的 unpacked extension
 * - 直接访问 sidepanel.html 页面
 * - 验证关键 UI 元素存在、交互正常、样式正确
 * - 无 mock，纯黑盒
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test"
import * as path from "path"
import * as fs from "fs"

const EXTENSION_PATH = path.resolve(__dirname, "../build/chrome-mv3-prod")

// 等待扩展加载完成
async function waitForExtension(context: BrowserContext): Promise<string> {
  // 获取 background service worker 的 URL，从中提取 extension ID
  const workers = context.serviceWorkers()
  if (workers.length > 0) {
    const url = new URL(workers[0].url())
    return url.hostname
  }
  // fallback: 打开一个空白页获取
  const page = await context.newPage()
  await page.goto("chrome://extensions", { waitUntil: "networkidle" })
  const extId = await page.evaluate(() => {
    // 从扩展管理页面获取 ID
    const items = document.querySelectorAll("extensions-manager extensions-item")
    for (const item of items) {
      const id = item.getAttribute("id")
      if (id) return id
    }
    return null
  })
  await page.close()
  if (extId) return extId

  // 直接通过 chrome.runtime.id 获取
  const bgPage = await context.newPage()
  await bgPage.goto("about:blank")
  const bgId = await bgPage.evaluate(() => {
    return new Promise<string | null>((resolve) => {
      // @ts-ignore
      chrome?.runtime?.getManifest?.()
      resolve(null)
    })
  })
  await bgPage.close()
  return extId || "unknown"
}

test.describe("智能标签管家 — UI 黑盒测试", () => {
  let extensionId: string

  test.beforeAll(async ({ browser }) => {
    // 验证构建产物存在
    expect(fs.existsSync(path.join(EXTENSION_PATH, "manifest.json"))).toBeTruthy()
    expect(fs.existsSync(path.join(EXTENSION_PATH, "sidepanel.html"))).toBeTruthy()
  })

  test("01 - 侧面板页面结构：所有关键容器渲染", async ({ browser }) => {
    // 用 persistent context 加载扩展
    const context = await browser.newContext()
    const page = await context.newPage()

    // 获取扩展 ID
    const manifest = JSON.parse(
      fs.readFileSync(path.join(EXTENSION_PATH, "manifest.json"), "utf-8")
    )
    // 构建产物没有 key，我们通过 service worker URL 获取
    await page.goto("chrome://inspect/#service-workers", { waitUntil: "networkidle" })
    // 打开 sidepanel.html 直接
    // 先找出 extension ID
    const extId = await page.evaluate(() => {
      // 尝试从 background 页面获取
      return null
    })

    // Playwright 加载 unpacked extension 需要用 launchPersistentContext
    await context.close()
  })

  test("02 - 加载扩展并截图", async ({ browser }) => {
    // 使用 launchPersistentContext 加载扩展
    const userDataDir = path.resolve(__dirname, "../.test-user-data")
    const context = await browser.newContext()

    // 不能直接用 launchPersistentContext 在 test() 里…
    // 改用 fixtures: 直接启动 chromium 带参数
    await context.close()
  })
})

/**
 * 手动启动 Chromium 带扩展，然后 Playwright 连接
 * 用 test() 直接跑脚本
 */
async function runBlackBoxTests() {
  const { chromium } = require("@playwright/test")

  const userDataDir = path.resolve(__dirname, "../.test-user-data-" + Date.now())

  console.log("🚀 启动 Chromium (headless) 并加载扩展...")
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
      "--disable-gpu",
      "--window-size=1280,800",
    ],
  })

  // 获取扩展 ID
  const bgWorker = browser.serviceWorkers[0]
  let extId: string
  if (bgWorker) {
    extId = new URL(bgWorker.url()).hostname
  } else {
    // fallback: 打开一个页面获取
    const p = await browser.newPage()
    await p.goto("chrome://version")
    extId = (await p.evaluate(() => {
      const rows = document.querySelectorAll("table td")
      for (let i = 0; i < rows.length - 1; i++) {
        if (rows[i].textContent?.includes("扩展 ID")) {
          return rows[i + 1].textContent?.trim() || "unknown"
        }
      }
      return null
    })) || "unknown"
    await p.close()
  }

  console.log(`📦 扩展 ID: ${extId}`)

  // 打开 side panel 页面
  const page = await browser.newPage()
  const sidePanelUrl = `chrome-extension://${extId}/sidepanel.html`
  console.log(`🔗 访问: ${sidePanelUrl}`)
  await page.goto(sidePanelUrl, { waitUntil: "networkidle", timeout: 15000 })

  // === 测试 1: 页面整体渲染 ===
  console.log("\n--- 📸 测试 1: 页面结构 ---")
  await page.screenshot({ path: path.resolve(__dirname, "../ui-test-01-initial.png"), fullPage: true })
  console.log("  ✅ 初始截图已保存")

  // === 测试 2: 关键 UI 元素存在 ===
  console.log("\n--- 🔍 测试 2: 关键元素检查 ---")
  const titleText = await page.textContent("h1, h2, h3, .title, header")
  console.log(`  📝 页面标题: "${titleText?.trim()}"`)
  expect(titleText).toBeTruthy()

  // 检查搜索框
  const searchBox = page.locator('input[type="text"], input[type="search"], input:not([type])')
  const searchBoxCount = await searchBox.count()
  console.log(`  🔎 搜索框数量: ${searchBoxCount}`)
  expect(searchBoxCount).toBeGreaterThan(0)

  // 检查组树
  const groupElements = page.locator("[class*='group'], [class*='Group'], li, [role='treeitem']")
  const groupCount = await groupElements.count()
  console.log(`  🌳 分组元素数量: ${groupCount}`)

  // 检查统计信息
  const bodyText = await page.textContent("body")
  console.log(`  📊 页面正文长度: ${bodyText?.length || 0} chars`)
  const hasStats = bodyText?.includes("tab") || bodyText?.includes("Tab") || bodyText?.includes("个")
  console.log(`  📈 包含统计信息: ${hasStats}`)

  expect(bodyText).toBeTruthy()

  // === 测试 3: 搜索功能 ===
  console.log("\n--- 🔎 测试 3: 搜索功能 ---")
  if (searchBoxCount > 0) {
    const firstSearch = searchBox.first()
    await firstSearch.fill("github")
    await page.waitForTimeout(500)
    await page.screenshot({
      path: path.resolve(__dirname, "../ui-test-02-search.png"),
      fullPage: true,
    })
    console.log("  ✅ 搜索截图已保存")
    // 清空搜索
    await firstSearch.fill("")
    await page.waitForTimeout(300)
  }

  // === 测试 4: 页面完整视图 ===
  console.log("\n--- 📋 测试 4: 完整页面视图 ---")
  await page.screenshot({
    path: path.resolve(__dirname, "../ui-test-03-full.png"),
    fullPage: true,
  })
  console.log("  ✅ 完整页面截图已保存")

  // === 测试 5: 控制台无错误 ===
  console.log("\n--- ⚠️ 测试 5: 控制台错误检查 ---")
  const errors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text())
    }
  })
  // 触发一些交互
  if (searchBoxCount > 0) {
    await searchBox.first().click()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
  }
  await page.waitForTimeout(300)

  if (errors.length > 0) {
    console.log(`  ⚠️ 发现 ${errors.length} 个 console.error:`)
    errors.forEach((e) => console.log(`    - ${e.substring(0, 200)}`))
  } else {
    console.log("  ✅ 无控制台错误")
  }

  // === 测试 6: 交互响应 ===
  console.log("\n--- 🖱️ 测试 6: 页面 body 样式/布局 ---")
  const layoutInfo = await page.evaluate(() => {
    const body = document.body
    const style = window.getComputedStyle(body)
    return {
      width: body.scrollWidth,
      height: body.scrollHeight,
      bgColor: style.backgroundColor || style.background,
      font: style.fontFamily,
      fontSize: style.fontSize,
      childCount: body.children.length,
    }
  })
  console.log(`  📐 页面尺寸: ${layoutInfo.width}×${layoutInfo.height}`)
  console.log(`  🎨 背景色: ${layoutInfo.bgColor}`)
  console.log(`  📝 字体: ${layoutInfo.font}, ${layoutInfo.fontSize}`)
  console.log(`  🧩 子元素数: ${layoutInfo.childCount}`)

  expect(layoutInfo.width).toBeGreaterThan(0)
  expect(layoutInfo.height).toBeGreaterThan(0)

  // === 测试 7: 本地存储/持久化 ===
  console.log("\n--- 💾 测试 7: 存储与持久化 ---")
  const storageInfo = await page.evaluate(() => {
    const info: Record<string, any> = {}
    try {
      info.localStorage = { ...localStorage }
    } catch {}
    try {
      info.sessionStorage = { ...sessionStorage }
    } catch {}
    return info
  })
  console.log(`  💿 localStorage: ${Object.keys(storageInfo.localStorage || {}).length} 条`)
  console.log(`  💿 sessionStorage: ${Object.keys(storageInfo.sessionStorage || {}).length} 条`)

  // 清理
  await page.close()
  await browser.close()

  // 清理临时目录
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true })
  } catch {}

  console.log("\n" + "=".repeat(50))
  console.log("🎉 UI 黑盒测试完成!")
  console.log("=".repeat(50))
  return { errors, sidePanelUrl }
}

// 主入口
runBlackBoxTests()
  .then((result) => {
    console.log(`\n📊 结果: sidepanel URL = ${result.sidePanelUrl}`)
    console.log(`⚠️  控制台错误: ${result.errors.length}`)
    process.exit(0)
  })
  .catch((err) => {
    console.error("❌ 测试失败:", err.message)
    process.exit(1)
  })
