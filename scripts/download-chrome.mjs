#!/usr/bin/env node
/**
 * 下载 Chrome for Testing 并配置给 Playwright 使用
 *
 * Playwright 1.61.1 → Chromium 1228 → Chrome 149.0.7827.55
 */
import { execSync } from "child_process"
import { createWriteStream } from "fs"
import { mkdir, rm } from "fs/promises"
import path from "path"
import https from "https"

const CFT_VERSION = "149.0.7827.55"
const URL = `https://storage.googleapis.com/chrome-for-testing-public/${CFT_VERSION}/linux64/chrome-linux64.zip`
const TMP_ZIP = "/tmp/chrome-cft.zip"
const TMP_DIR = "/tmp/chrome-cft-extract"
const TARGET_DIR = "/home/hermes/.cache/ms-playwright/chromium-1228"
const CHROME_BIN = path.join(TARGET_DIR, "chrome-linux64", "chrome")

async function download(url, dest) {
  console.log(`📥 下载 Chrome for Testing ${CFT_VERSION}...`)
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest)
    let lastSize = 0
    let lastLog = Date.now()

    https.get(url, (res) => {
      const total = parseInt(res.headers["content-length"] || "0", 10)
      let downloaded = 0

      res.on("data", (chunk) => {
        downloaded += chunk.length
        file.write(chunk)
        const now = Date.now()
        if (now - lastLog > 15000) {
          const speed = ((downloaded - lastSize) / (now - lastLog) * 1000 / 1024).toFixed(1)
          const pct = total ? `(${(downloaded / total * 100).toFixed(1)}%)` : ""
          console.log(`  ${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB ${pct} - ${speed} KB/s`)
          lastSize = downloaded
          lastLog = now
        }
      })

      res.on("end", () => {
        file.end()
        console.log(`  ✅ 下载完成: ${(downloaded / 1024 / 1024).toFixed(1)}MB`)
        resolve()
      })

      res.on("error", reject)
    }).on("error", reject)
  })
}

async function main() {
  const fs = await import("fs")
  if (fs.existsSync(CHROME_BIN)) {
    console.log(`✅ Chrome 已存在: ${CHROME_BIN}`)
    console.log(`  版本: ${execSync(`"${CHROME_BIN}" --version`).toString().trim()}`)
    process.exit(0)
  }

  // 下载
  await download(URL, TMP_ZIP)

  // 解压（用 Python zipfile）
  console.log("📦 解压中...")
  await rm(TMP_DIR, { recursive: true, force: true })
  await mkdir(TMP_DIR, { recursive: true })

  execSync(`python3 -c "
import zipfile, os
with zipfile.ZipFile('${TMP_ZIP}', 'r') as z:
    z.extractall('${TMP_DIR}')
print('解压完成')
"`, { stdio: "inherit" })

  // 复制到目标
  await mkdir(TARGET_DIR, { recursive: true })
  execSync(`cp -r "${TMP_DIR}/chrome-linux64" "${TARGET_DIR}/"`, { stdio: "pipe" })
  execSync(`chmod +x "${CHROME_BIN}"`, { stdio: "pipe" })

  // 验证
  const ver = execSync(`"${CHROME_BIN}" --version`).toString().trim()
  console.log(`\n✅ 安装完成: ${CHROME_BIN}`)
  console.log(`   ${ver}`)

  // 清理
  await rm(TMP_ZIP, { force: true })
  await rm(TMP_DIR, { recursive: true, force: true })
}

main().catch((err) => {
  console.error("❌ 安装失败:", err.message)
  process.exit(1)
})
