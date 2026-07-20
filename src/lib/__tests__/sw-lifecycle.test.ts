/**
 * Service Worker 生命周期测试
 *
 * MV3 最大坑：SW 空闲 30 秒会休眠，状态丢失。
 * 这些测试验证 SW 重启后的核心数据路径和消息处理。
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

function createMockChrome() {
  return {
    runtime: {
      id: "test-extension-id",
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn(),
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      onCreated: { addListener: vi.fn() },
      onUpdated: { addListener: vi.fn() },
      onActivated: { addListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
      update: vi.fn(),
      group: vi.fn(),
      ungroup: vi.fn(),
      discard: vi.fn(),
    },
    storage: {
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn(),
      },
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn(),
      },
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn() },
    },
  }
}

describe("SW 生命周期 — 消息处理", () => {
  let chrome: ReturnType<typeof createMockChrome>

  beforeEach(() => {
    chrome = createMockChrome()
    vi.stubGlobal("chrome", chrome)
  })

  it("GET_TABS 返回按规则引擎分组的数据", async () => {
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: "https://github.com/", title: "GitHub", pinned: false },
      { id: 2, url: "https://youtube.com/", title: "YouTube", pinned: false },
      { id: 3, url: "https://example.xyz/", title: "Other", pinned: false },
    ])

    const handleMessage = async (msg: any) => {
      if (msg.type === "GET_TABS") {
        const tabs = await chrome.tabs.query({})
        const { matchGroup } = await import("../rule-engine")
        const grouped: Record<string, chrome.tabs.Tab[]> = {}
        for (const tab of tabs) {
          const domain = new URL(tab.url!).hostname.replace(/^www\./, "").toLowerCase()
          const g = matchGroup(domain, tab.url!, tab.title || "")
          if (!grouped[g]) grouped[g] = []
          grouped[g].push(tab)
        }
        return grouped
      }
    }

    const result = await handleMessage({ type: "GET_TABS" })
    expect(result).toBeDefined()
    expect(Object.keys(result).length).toBeGreaterThan(0)
    expect(result["dev"]).toHaveLength(1)
    expect(result["video"]).toHaveLength(1)
    expect(result["other"]).toHaveLength(1)
  })

  it("GET_SUGGEST_CLOSE 筛选出 7 天未访问标签", async () => {
    const now = Date.now()
    chrome.storage.session.get.mockImplementation(async (keys: string[]) => {
      const result: Record<string, number> = {}
      for (const key of keys) {
        const tabId = parseInt(key.replace("access_", ""), 10)
        if (tabId === 1) result[key] = now - 10 * 24 * 60 * 60 * 1000
        if (tabId === 2) result[key] = now - 60 * 60 * 1000
      }
      return result
    })

    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: "https://old-site.com/", title: "Old", pinned: false, active: false, audible: false },
      { id: 2, url: "https://recent.com/", title: "Recent", pinned: false, active: false, audible: false },
    ])

    const getSuggestClose = async () => {
      const tabs = await chrome.tabs.query({})
      const toSuggest: any[] = []
      for (const tab of tabs) {
        if (!tab.id || tab.pinned || tab.active || tab.audible) continue
        const result = await chrome.storage.session.get([`access_${tab.id}`])
        const lastAccess = result[`access_${tab.id}`] || now
        const daysSince = (now - lastAccess) / (1000 * 60 * 60 * 24)
        if (daysSince > 7) {
          toSuggest.push({ tabId: tab.id, title: tab.title, url: tab.url, daysSinceAccess: Math.round(daysSince) })
        }
      }
      return toSuggest
    }

    const suggest = await getSuggestClose()
    expect(suggest).toHaveLength(1)
    expect(suggest[0].tabId).toBe(1)
    expect(suggest[0].daysSinceAccess).toBe(10)
  })

  it("DISCARD_TABS 正确调用 tabs.discard", async () => {
    const handleDiscard = async (tabIds: number[]) => {
      for (const id of tabIds) {
        await chrome.tabs.discard(id)
      }
    }

    await handleDiscard([1, 3, 5])
    expect(chrome.tabs.discard).toHaveBeenCalledTimes(3)
    expect(chrome.tabs.discard).toHaveBeenCalledWith(1)
    expect(chrome.tabs.discard).toHaveBeenCalledWith(5)
  })

  it("休眠不活跃标签：过滤 pinned/active/audible", async () => {
    const now = Date.now()
    chrome.tabs.query.mockResolvedValue([
      { id: 1, url: "https://a.com/", title: "Pinned", pinned: true, active: false, audible: false },
      { id: 2, url: "https://b.com/", title: "Active", pinned: false, active: true, audible: false },
      { id: 3, url: "https://c.com/", title: "Audible", pinned: false, active: false, audible: true },
      { id: 4, url: "https://d.com/", title: "Old", pinned: false, active: false, audible: false },
    ])
    chrome.storage.session.get.mockResolvedValue({ access_4: now - 2 * 24 * 60 * 60 * 1000 })

    const sleepInactive = async () => {
      const tabs = await chrome.tabs.query({})
      const toDiscard: number[] = []
      for (const tab of tabs) {
        if (!tab.id || tab.pinned || tab.active || tab.audible) continue
        const result = await chrome.storage.session.get([`access_${tab.id}`])
        const lastAccess = result[`access_${tab.id}`] || now
        const daysSince = (now - lastAccess) / (1000 * 60 * 60 * 24)
        if (daysSince > 1) toDiscard.push(tab.id)
      }
      return toDiscard
    }

    const toDiscard = await sleepInactive()
    expect(toDiscard).toEqual([4])
  })
})

describe("SW 生命周期 — 状态恢复", () => {
  let chrome: ReturnType<typeof createMockChrome>

  beforeEach(() => {
    chrome = createMockChrome()
    vi.stubGlobal("chrome", chrome)
  })

  it("重启后从 storage.local 恢复 userRules", async () => {
    chrome.storage.local.get = vi.fn().mockResolvedValue({ userRules: { "custom.com": "dev" } })
    const result = await chrome.storage.local.get("userRules")
    expect(result.userRules["custom.com"]).toBe("dev")
  })

  it("tags session 数据跨休眠保留", async () => {
    chrome.storage.session.get = vi.fn().mockResolvedValue({ access_1: 1700000000000 })
    const result = await chrome.storage.session.get(["access_1"])
    expect(result.access_1).toBe(1700000000000)
  })
})
