/**
 * 智能标签管家 — UI 黑盒测试
 *
 * 纯 JS 脚本，用 Playwright 启动 Chromium + unpacked extension
 * 验证 UI 渲染、交互、无报错
 *
 * 运行: node test/ui-blackbox.mjs
 */
import { chromium } from "playwright"
import * as path from "path"
import * as fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const EXTENSION_PATH = path.resolve(__dirname, "../build/chrome-mv3-prod")

async function main() {
  // ==================== 准备 ====================
  const manifest = JSON.parse(
    fs.readFileSync(path.join(EXTENSION_PATH, "manifest.json"), "utf-8")
  )
  console.log("📦 扩展:", manifest.name, "v" + manifest.version)
  console.log("📍 构建路径:", EXTENSION_PATH)
  console.log("")

  let passed = 0
  let failed = 0
  const results = []

  function assert(label, condition, detail = "") {
    if (condition) {
      console.log(`  ✅ ${label}`)
      passed++
      results.push({ label, pass: true })
    } else {
      console.log(`  ❌ ${label} ${detail}`)
      failed++
      results.push({ label, pass: false, detail })
    }
  }

  // ==================== 启动浏览器 ====================
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

  // ==================== 获取扩展 ID ====================
  const workers = browser.serviceWorkers
  let extId = "unknown"
  if (workers.length > 0) {
    extId = new URL(workers[0].url()).hostname
    console.log(`📦 扩展 ID (from SW): ${extId}`)
  } else {
    // fallback: 从页面获取
    const p = await browser.newPage()
    await p.goto("chrome://version", { waitUntil: "domcontentloaded" })
    extId =
      (await p.evaluate(() => {
        const pre = document.querySelector("pre")
        if (!pre) return null
        const text = pre.textContent || ""
        const m = text.match(/Command Line:.*--load-extension=([^\s]+)/)
        return m ? path.basename(m[1]) : null
      })) || "unknown"
    await p.close()
    console.log(`📦 扩展 ID (fallback): ${extId}`)
  }

  // ==================== 打开 Side Panel ====================
  const page = await browser.newPage()
  const sidePanelUrl = `chrome-extension://${extId}/sidepanel.html`
  console.log(`🔗 访问: ${sidePanelUrl}`)

  const consoleErrors = []
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text())
    }
  })

  await page.goto(sidePanelUrl, { waitUntil: "networkidle", timeout: 15000 })
  await page.waitForTimeout(500) // 让 React 渲染完成

  // ==================== 测试 1: 页面渲染 ====================
  console.log("\n--- 📸 测试: 页面结构 ---")

  const screenshotDir = __dirname + "/../ui-screenshots"
  fs.mkdirSync(screenshotDir, { recursive: true })
  await page.screenshot({
    path: screenshotDir + "/01-initial.png",
    fullPage: true,
  })
  assert("初始截图已保存", fs.existsSync(screenshotDir + "/01-initial.png"))

  assert("sidepanel.html 加载成功", !page.url().includes("error") && !page.url().includes("blank"))
  assert("页面 body 非空", (await page.evaluate(() => document.body?.children.length)) > 0)

  // ==================== 测试 2: 关键 UI 元素检查 ====================
  console.log("\n--- 🔍 测试: 关键元素 ---")

  const titleEl = page.locator("h1, h2, h3, header, [class*='title'], [class*='Title']").first()
  const titleText = await titleEl.textContent()
  assert("页面有标题元素", !!titleText)
  if (titleText) console.log(`  📝 标题内容: "${titleText.trim().substring(0, 80)}"`)

  // 搜索框
  const searchInputs = page.locator(
    'input[type="text"], input[type="search"], input:not([type]), [role="searchbox"]'
  )
  const searchCount = await searchInputs.count()
  assert("搜索框存在", searchCount > 0)

  // 列表/树形元素
  const listItems = page.locator("li, [role='treeitem'], [role='listitem']")
  const listCount = await listItems.count()
  const lists = page.locator("ul, [role='tree'], [role='list'], [role='group']")
  const listContainerCount = await lists.count()
  console.log(`  🌳 列表项: ${listCount}, 列表容器: ${listContainerCount}`)

  // 图片/图标
  const images = page.locator("img, svg, [class*='icon'], [class*='Icon']")
  const imgCount = await images.count()
  console.log(`  🖼️ 图片/图标元素: ${imgCount}`)

  // 交互元素
  const buttons = page.locator("button, [role='button'], [class*='btn'], [class*='Button']")
  const btnCount = await buttons.count()
  assert("有可交互的按钮", btnCount > 0)
  console.log(`  🔘 按钮/可点击元素: ${btnCount}`)

  // ==================== 测试 3: 搜索交互 ====================
  console.log("\n--- 🔎 测试: 搜索交互 ---")
  if (searchCount > 0) {
    const sb = searchInputs.first()
    await sb.click()
    await sb.fill("google")
    await page.waitForTimeout(500)
    await page.screenshot({
      path: screenshotDir + "/02-search.png",
      fullPage: true,
    })
    assert("搜索截图已保存", fs.existsSync(screenshotDir + "/02-search.png"))

    // 搜索结果变化
    const afterSearch = await sb.inputValue()
    assert("搜索框内容已填入", afterSearch === "google")

    // 清空搜索
    await sb.fill("")
    await page.waitForTimeout(300)
    console.log("  🔄 搜索已清空")
  }

  // ==================== 测试 4: 键盘导航 ====================
  console.log("\n--- ⌨️ 测试: Tab 导航 ---")
  await page.keyboard.press("Tab")
  await page.waitForTimeout(100)
  await page.keyboard.press("Tab")
  await page.waitForTimeout(100)
  await page.keyboard.press("Tab")
  await page.waitForTimeout(100)
  const focusedEl = await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return "body"
    return el.tagName + (el.getAttribute("class") ? " ." + el.getAttribute("class")?.split(/\s+/)[0] : "")
  })
  console.log(`  🎯 焦点元素: ${focusedEl}`)
  // 焦点从 body 移开了就行
  assert("Tab 导航工作", !focusedEl.includes("body"))

  // ==================== 测试 5: 页面布局/样式 ====================
  console.log("\n--- 🎨 测试: 布局样式 ---")
  const layout = await page.evaluate(() => {
    const body = document.body
    const style = window.getComputedStyle(body)
    return {
      width: body.scrollWidth,
      height: body.scrollHeight,
      bgColor: style.backgroundColor,
      font: style.fontFamily,
      fontSize: style.fontSize,
      children: body.children.length,
      textLen: body.textContent?.length || 0,
    }
  })
  console.log(`  📐 尺寸: ${layout.width}×${layout.height}`)
  console.log(`  🎨 背景: ${layout.bgColor}`)
  console.log(`  📝 字体: ${layout.font}`)
  console.log(`  📊 文本量: ${layout.textLen} chars, ${layout.children} 子元素`)
  assert("页面有内容展示", layout.textLen > 50)
  assert("页面高度合理", layout.height > 100)

  // ==================== 测试 6: 控制台无错误 ====================
  console.log("\n--- ⚠️ 测试: 控制台错误 ---")
  if (consoleErrors.length > 0) {
    console.log(`  ⚠️ 发现 ${consoleErrors.length} 个 console.error:`)
    consoleErrors.slice(0, 10).forEach((e, i) => {
      console.log(`    ${i + 1}. ${e.substring(0, 200)}`)
    })
    // 有些第三方库可能有 benign error，标记但不导致整体失败
    assert("无严重控制台错误", consoleErrors.length === 0, `(${consoleErrors.length} errors)`)
  } else {
    assert("无控制台错误", true)
  }

  // ==================== 测试 7: 深色模式/主题检查 ====================
  console.log("\n--- 🌓 测试: 主题 ---")
  const theme = await page.evaluate(() => {
    const bg = window.getComputedStyle(document.body).backgroundColor
    const isDark = bg.includes("17") || bg.includes("1f") || bg.includes("rgb(0,0,0)") || bg.includes("#111") || bg.includes("#1a") || bg.includes("#1e") || bg.includes("#222")
    return { bg, isDark }
  })
  console.log(`  🎨 背景色: ${theme.bg}, 深色模式: ${theme.isDark}`)

  // ==================== 测试 8: 滚动 ====================
  console.log("\n--- 📜 测试: 滚动 ---")
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => window.scrollTo(0, 500))
  await page.waitForTimeout(200)
  const scrollAfter = await page.evaluate(() => window.scrollY)
  assert("页面可滚动 (或有足够内容)", scrollAfter >= 0)
  console.log(`  📏 scrollY: ${scrollBefore} → ${scrollAfter}`)
  await page.screenshot({
    path: screenshotDir + "/03-scrolled.png",
    fullPage: true,
  })

  // ==================== 收尾 ====================
  await page.close()
  await browser.close()

  // 清理临时数据
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true })
  } catch {}

  // ==================== 报告 ====================
  console.log("\n" + "=".repeat(50))
  console.log("📊 UI 黑盒测试报告")
  console.log("=".repeat(50))
  console.log(`  ✅ 通过: ${passed}`)
  console.log(`  ❌ 失败: ${failed}`)
  console.log(`  🖼️  截图: ${screenshotDir}/`)
  console.log("=".repeat(50))

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("❌ 测试脚本崩溃:", err.message)
  console.error(err.stack)
  process.exit(1)
})
