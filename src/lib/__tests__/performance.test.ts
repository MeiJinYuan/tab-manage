/**
 * 性能基准测试 — 规则引擎 & 搜索 & DB
 *
 * 预期指标：
 *   100 标签分组 < 50ms
 *   Fuse.js 搜索 100 条 < 20ms
 *   batchMatch 批量 < 10ms
 */
import { describe, it, expect } from "vitest"
import { matchGroup, batchMatch } from "../rule-engine"

// ── 辅助：生成 N 个模拟标签 ──
function generateMockTabs(
  n: number
): { id: number; url: string; title: string }[] {
  const domains = [
    "github.com",
    "youtube.com",
    "amazon.com",
    "stackoverflow.com",
    "chatgpt.com",
    "google.com",
    "reddit.com",
    "notion.so",
    "wikipedia.org",
    "bilibili.com",
    "twitter.com",
    "netflix.com",
    "gitlab.com",
    "zhihu.com",
    "claude.ai",
    "new-site.xyz",
    "brand-new.io",
    "random-test.net",
    "example.org",
    "unknown.dev",
  ]
  const tabs: { id: number; url: string; title: string }[] = []
  for (let i = 0; i < n; i++) {
    const domain = domains[i % domains.length]
    tabs.push({
      id: i + 1,
      url: `https://${domain}/${i % 3 === 0 ? "pulls/" + i : i % 3 === 1 ? "issues/" + i : ""}`,
      title: `Tab ${i} — ${domain} — ${i % 5 === 0 ? "PR #" + i : "page"}`,
    })
  }
  return tabs
}

describe("性能基准 — 规则引擎", () => {
  it("单次 matchGroup 调用 < 1ms", () => {
    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      matchGroup("github.com", "https://github.com/", "Hello")
    }
    const elapsed = performance.now() - start
    console.log(`  单次 matchGroup x100: ${elapsed.toFixed(2)}ms (avg ${(elapsed / 100).toFixed(3)}ms)`)
    expect(elapsed).toBeLessThan(50) // 100 次 < 50ms
  })

  it("100 个标签 batchMatch < 50ms", () => {
    const tabs = generateMockTabs(100)
    const start = performance.now()
    const result = batchMatch(tabs)
    const elapsed = performance.now() - start
    console.log(`  100 标签 batchMatch: ${elapsed.toFixed(2)}ms`)
    expect(result.size).toBe(100)
    expect(elapsed).toBeLessThan(50)
  })

  it("500 个标签 batchMatch < 100ms", () => {
    const tabs = generateMockTabs(500)
    const start = performance.now()
    const result = batchMatch(tabs)
    const elapsed = performance.now() - start
    console.log(`  500 标签 batchMatch: ${elapsed.toFixed(2)}ms`)
    expect(result.size).toBe(500)
    expect(elapsed).toBeLessThan(100)
  })

  it("1000 个标签 batchMatch < 120ms", () => {
    const tabs = generateMockTabs(1000)
    const start = performance.now()
    const result = batchMatch(tabs)
    const elapsed = performance.now() - start
    console.log(`  1000 标签 batchMatch: ${elapsed.toFixed(2)}ms`)
    expect(result.size).toBe(1000)
    expect(elapsed).toBeLessThan(120)
  })
})

describe("性能基准 — 混合场景", () => {
  it("混合域名+URL模式+关键词 200 标签 < 30ms", () => {
    const tabs = generateMockTabs(200)
    // 混入一些需要 URL 模式和关键词匹配的用例
    const mixed = [
      ...tabs,
      { id: 1001, url: "https://mail.google.com/mail/inbox", title: "Gmail" },
      { id: 1002, url: "https://calendar.google.com/event", title: "Meeting" },
      { id: 1003, url: "https://drive.google.com/file/d/1/edit", title: "Doc" },
      { id: 1004, url: "https://company.atlassian.net/browse/PROJ-1", title: "Ticket" },
      { id: 1005, url: "https://figma.com/file/abc123", title: "Design" },
    ]
    const start = performance.now()
    const result = batchMatch(mixed)
    const elapsed = performance.now() - start
    console.log(`  混合 205 标签 batchMatch: ${elapsed.toFixed(2)}ms`)
    expect(result.get(1001)).toBe("email")
    expect(result.get(1002)).toBe("tools")
    expect(result.get(1004)).toBe("work")
    expect(elapsed).toBeLessThan(30)
  })

  it("用户自定义规则覆盖 100 标签 < 20ms", () => {
    const tabs = generateMockTabs(100)
    const userRules = { "github.com": "entertain", "youtube.com": "dev" }
    const start = performance.now()
    const result = batchMatch(tabs, userRules)
    const elapsed = performance.now() - start
    console.log(`  用户规则覆盖 100 标签: ${elapsed.toFixed(2)}ms`)
    expect(result.get(1)).toBe("entertain") // github → 娱乐
    expect(result.get(2)).toBe("dev") // youtube → 开发
    expect(elapsed).toBeLessThan(20)
  })
})
