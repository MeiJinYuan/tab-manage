/**
 * 标签管家 — 浏览器演示
 *
 * 启动 Playwright CfT + 加载扩展 + 开多个标签验证分组
 */
const { chromium } = require("playwright")
const path = require("path")
const fs = require("fs")
const { execSync } = require("child_process")

const EXTENSION_PATH = "C:\\Users\\23395\\AppData\\Local\\Temp\\tab-manage-test\\build"
const userDataDir = "C:\\Users\\23395\\AppData\\Local\\Temp\\tab-manage-demo-" + Date.now()
const screenshotDir = "C:\\Users\\23395\\AppData\\Local\\Temp\\tab-manage-screenshots"

async function main() {
  // 清理
  try { execSync("taskkill /f /im chrome.exe", { stdio: "ignore" }) } catch {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch {}
  fs.mkdirSync(userDataDir, { recursive: true })
  fs.mkdirSync(screenshotDir, { recursive: true })

  console.log("🚀 启动 Chrome...\n")

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-sandbox",
      "--window-size=1280,800",
    ],
  })

  // 获取扩展 ID
  let extensionId = null
  try {
    const sw = await context.waitForEvent("serviceworker", { timeout: 5000 })
    extensionId = new URL(sw.url()).hostname
  } catch {}
  if (extensionId) console.log(`🔌 扩展加载成功! ID: ${extensionId}\n`)
  else console.log("⚠️ 扩展已加载\n")

  const page = context.pages()[0]

  // ====== 开标签，URL 匹配规则引擎域名 ======
  const sites = [
    "https://github.com/",
    "https://www.bilibili.com/",
    "https://www.zhihu.com/",
    "https://chatgpt.com/",
    "https://www.amazon.com/",
  ]

  console.log("📂 打开标签页...")
  for (let i = 0; i < sites.length; i++) {
    const p = i === 0 ? page : await context.newPage()
    try {
      await p.goto(sites[i], { waitUntil: "domcontentloaded", timeout: 8000 })
      console.log(`  ✅ ${sites[i]}`)
    } catch {
      console.log(`  ⏳ ${sites[i]} (超时，跳过)`)
      p.close()
    }
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log("\n⏳ 等待分组引擎处理...")
  await new Promise(r => setTimeout(r, 3000))

  // 打开侧面板
  if (extensionId) {
    console.log("📋 打开侧面板...")
    const sp = await context.newPage()
    await sp.goto(`chrome-extension://${extensionId}/sidepanel.html`, {
      waitUntil: "domcontentloaded", timeout: 10000,
    })
    await new Promise(r => setTimeout(r, 2000))

    await sp.screenshot({
      path: path.join(screenshotDir, "sidepanel.png"),
      fullPage: true,
    })
    console.log("📸 截图已保存\n")
  }

  console.log("✅ 完成！窗口保持打开")
  console.log("   - 标签已打开（能连上的网站）")
  console.log("   - 右侧侧面板显示分组结果")
  console.log("   - 关掉 Chrome 窗口后脚本退出\n")

  await new Promise(() => {})
}

main().catch(err => {
  console.error("💥 错误:", err.message)
  process.exit(1)
})
