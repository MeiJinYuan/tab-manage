/**
 * Background Service Worker — 标签监听、分组、历史记录
 */
import { matchGroup, batchMatch } from "~lib/rule-engine"
import { addToHistory, clearOldHistory, getUserRules, db } from "~lib/db"

// 社区规则 URL（GitHub）
const COMMUNITY_RULES_URL =
  "https://raw.githubusercontent.com/MeiJinYuan/tab-manager-rules/main/rules.json"

export {}

// ─── 初始化 ────────────────────────────────────────────

console.log("[Tab Manager] Service Worker 启动")

// 安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  // 创建侧栏
  await chrome.sidePanel.setOptions({
    enabled: true,
    path: "sidepanel/index.html",
  })
  // 允许所有站点打开侧栏
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

  // 设置规则更新定时器（每 24h）
  chrome.alarms.create("update-rules", { periodInMinutes: 1440 })
  // 清理旧历史（每天一次）
  chrome.alarms.create("clean-history", { periodInMinutes: 1440 })
  // 首次拉取规则
  fetchCommunityRules()
  // 清理旧历史
  clearOldHistory(7)
})

// ─── 标签事件 ──────────────────────────────────────────

// 标签创建 → 自动分组
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.id || !tab.url) return
  // 等待标签加载完成（等 onUpdated 处理）
})

// 标签更新（URL 变化/加载完成）→ 分组
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url || changeInfo.status !== "complete") return

  const domain = extractDomain(tab.url)
  const userRules = await getUserRules()
  const groupId = matchGroup(domain, tab.url, tab.title || "", userRules)

  // 用 tabGroups API 设置分组
  try {
    // 检查是否已有分组
    const currentTab = await chrome.tabs.get(tabId)
    if (currentTab.groupId && currentTab.groupId > 0) {
      // 已有分组，检查是否需要移动
      const currentGroup = await chrome.tabGroups.get(currentTab.groupId)
      if (currentGroup.title !== groupId) {
        // 移到正确分组或创建新分组
        await moveTabToGroup(tabId, groupId)
      }
    } else {
      // 未分组 → 归入对应组
      await moveTabToGroup(tabId, groupId)
    }
  } catch (e) {
    // tabGroups API 可能暂时不可用
    console.debug("[Tab Manager] 分组失败:", e)
  }

  // 通知侧栏更新
  notifySidePanel()
})

// 标签关闭 → 记录历史
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // 从存储中获取关闭前保存的 tab 信息
  const result = await chrome.storage.session.get([`tab_${tabId}`])
  const tabInfo = result[`tab_${tabId}`]
  if (tabInfo) {
    await addToHistory(tabInfo)
    chrome.storage.session.remove(`tab_${tabId}`)
  }
})

// 标签激活 → 通知侧栏高亮
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  if (!tab.url) return
  const domain = extractDomain(tab.url)
  const userRules = await getUserRules()
  const groupId = matchGroup(domain, tab.url, tab.title || "", userRules)
  await notifySidePanelHighlight(groupId)
})

// ─── 侧栏通信 ─────────────────────────────────────────

async function notifySidePanel() {
  // 发送通用更新信号
  try {
    await chrome.runtime.sendMessage({ type: "TABS_UPDATED" }).catch(() => {})
  } catch {
    // side panel 可能没打开
  }
}

async function notifySidePanelHighlight(groupId: string) {
  try {
    await chrome.runtime.sendMessage({ type: "HIGHLIGHT_GROUP", groupId }).catch(() => {})
  } catch {
    // side panel 可能没打开
  }
}

// ─── 分组管理 ──────────────────────────────────────────

async function moveTabToGroup(tabId: number, groupId: string) {
  // 查找是否已有该分组存在的组
  const groups = await chrome.tabGroups.query({})
  let targetGroup = groups.find((g) => g.title === groupId)

  if (targetGroup) {
    // 加入已有组
    await chrome.tabs.group({ tabIds: [tabId], groupId: targetGroup.id })
  } else {
    // 创建新组
    const newGroupId = await chrome.tabs.group({ tabIds: [tabId] })
    await chrome.tabGroups.update(newGroupId, {
      title: groupId,
      color: getGroupColor(groupId),
    })
  }
}

function getGroupColor(groupId: string): chrome.tabGroups.ColorEnum {
  const colorMap: Record<string, chrome.tabGroups.ColorEnum> = {
    dev: "blue",
    work: "yellow",
    email: "purple",
    read: "green",
    video: "red",
    shop: "orange",
    social: "pink",
    ai: "cyan",
    finance: "grey",
    news: "yellow",
    entertain: "red",
    tools: "grey",
    docs: "green",
  }
  return colorMap[groupId] || "grey"
}

// ─── 建议关闭 ─────────────────────────────────────────

export interface SuggestCloseItem {
  tabId: number
  url: string
  title: string
  groupId: string
  lastAccessed: number
  daysSinceAccess: number
}

export async function getSuggestCloseTabs(): Promise<SuggestCloseItem[]> {
  const tabs = await chrome.tabs.query({})
  const now = Date.now()
  const results: SuggestCloseItem[] = []

  for (const tab of tabs) {
    if (!tab.id || !tab.url || tab.pinned) continue

    // 排除播放音频的标签
    if (tab.audible) continue

    // 用 session 存储获取 lastAccessed
    const result = await chrome.storage.session.get([`access_${tab.id}`])
    const lastAccessed = result[`access_${tab.id}`] || tab.lastAccessed || now
    const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24)

    if (daysSinceAccess > 7) {
      const domain = extractDomain(tab.url)
      const userRules = await getUserRules()
      const groupId = matchGroup(domain, tab.url, tab.title || "", userRules)
      results.push({
        tabId: tab.id,
        url: tab.url,
        title: tab.title || "",
        groupId,
        lastAccessed,
        daysSinceAccess: Math.round(daysSinceAccess * 10) / 10,
      })
    }
  }

  return results.sort((a, b) => b.daysSinceAccess - a.daysSinceAccess)
}

// ─── 休眠 ─────────────────────────────────────────────

export async function discardTabs(tabIds: number[]) {
  for (const id of tabIds) {
    try {
      await chrome.tabs.discard(id)
    } catch {
      // 可能已经休眠了
    }
  }
}

// ─── 规则更新 ──────────────────────────────────────────

async function fetchCommunityRules() {
  try {
    const resp = await fetch(COMMUNITY_RULES_URL)
    if (!resp.ok) return
    const rules = await resp.json()
    await chrome.storage.local.set({ communityRules: rules })
    console.log("[Tab Manager] 社区规则已更新")
  } catch {
    console.debug("[Tab Manager] 社区规则拉取失败（网络问题，下次重试）")
  }
}

// alarms 回调
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "update-rules") {
    fetchCommunityRules()
  } else if (alarm.name === "clean-history") {
    clearOldHistory(7)
  }
})

// ─── 右键菜单 ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "lock-to-group",
    title: "锁定到当前分组",
    contexts: ["tab"],
  })
  chrome.contextMenus.create({
    id: "unlock-from-group",
    title: "从分组解锁",
    contexts: ["tab"],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.url) return

  const domain = extractDomain(tab.url)
  const userRules = await getUserRules()
  const groupId = matchGroup(domain, tab.url, tab.title || "", userRules)

  if (info.menuItemId === "lock-to-group") {
    const { setUserRule } = await import("~lib/db")
    await setUserRule(domain, groupId)
    notifySidePanel()
  } else if (info.menuItemId === "unlock-from-group") {
    const { removeUserRule } = await import("~lib/db")
    await removeUserRule(domain)
    notifySidePanel()
  }
})

// ─── 工具函数 ─────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

// ─── 标签创建时保存信息（用于关闭时写历史）───────────

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id && tab.url) {
    const domain = extractDomain(tab.url)
    chrome.storage.session.set({
      [`tab_${tab.id}`]: {
        url: tab.url,
        title: tab.title || "",
        groupId: "",
      },
    })
  }
})

// 更新标签信息
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && changeInfo.status === "complete") {
    const domain = extractDomain(tab.url)
    chrome.storage.session.set({
      [`tab_${tab.id}`]: {
        url: tab.url,
        title: tab.title || "",
        groupId: "",
      },
    })
    // 记录访问时间
    chrome.storage.session.set({ [`access_${tab.id}`]: Date.now() })
  }
})

// ─── 消息处理（来自侧栏）──────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TABS") {
    getAllGroupedTabs().then(sendResponse)
    return true // 异步响应
  }
  if (message.type === "GET_SUGGEST_CLOSE") {
    getSuggestCloseTabs().then(sendResponse)
    return true
  }
  if (message.type === "DISCARD_TABS") {
    discardTabs(message.tabIds).then(() => sendResponse({ ok: true }))
    return true
  }
  if (message.type === "GET_HISTORY") {
    import("~lib/db").then(({ getRecentHistory }) =>
      getRecentHistory(message.limit || 50).then(sendResponse)
    )
    return true
  }
})

async function getAllGroupedTabs() {
  const tabs = await chrome.tabs.query({})
  const userRules = await getUserRules()
  const groups: Record<string, chrome.tabs.Tab[]> = {}

  for (const tab of tabs) {
    if (!tab.url) continue
    const domain = extractDomain(tab.url)
    const groupId = matchGroup(domain, tab.url, tab.title || "", userRules)

    if (!groups[groupId]) groups[groupId] = []
    groups[groupId].push(tab)
  }

  return groups
}
