/**
 * Side Panel — 主入口
 */
import { useState, useEffect, useCallback } from "react"
import { getGroups, type GroupDef } from "~lib/rule-engine"
import GroupTree from "~sidepanel/GroupTree"
import SearchBar from "~sidepanel/SearchBar"

function SidePanel() {
  const [groups, setGroups] = useState<Record<string, chrome.tabs.Tab[]>>({})
  const [filteredGroups, setFilteredGroups] = useState<
    Record<string, chrome.tabs.Tab[]>
  >({})
  const [groupDefs] = useState<GroupDef[]>(getGroups())
  const [searchQuery, setSearchQuery] = useState("")
  const [highlightGroup, setHighlightGroup] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"tabs" | "history" | "suggest">(
    "tabs"
  )

  const loadTabs = useCallback(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GET_TABS" })
    if (response) {
      setGroups(response)
      applyFilter(response, searchQuery)
    }
  }, [searchQuery])

  useEffect(() => {
    loadTabs()
    // 监听来自 background 的更新
    const listener = (message: any) => {
      if (message.type === "TABS_UPDATED") loadTabs()
      if (message.type === "HIGHLIGHT_GROUP")
        setHighlightGroup(message.groupId)
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [loadTabs])

  // 定时刷新（标签状态变化时）
  useEffect(() => {
    const interval = setInterval(loadTabs, 5000)
    return () => clearInterval(interval)
  }, [loadTabs])

  const applyFilter = (
    data: Record<string, chrome.tabs.Tab[]>,
    query: string
  ) => {
    if (!query.trim()) {
      setFilteredGroups(data)
      return
    }
    const q = query.toLowerCase()
    const filtered: Record<string, chrome.tabs.Tab[]> = {}
    for (const [groupId, tabs] of Object.entries(data)) {
      const matched = tabs.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.url?.toLowerCase().includes(q)
      )
      if (matched.length > 0) filtered[groupId] = matched
    }
    setFilteredGroups(filtered)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFilter(groups, query)
  }

  // 计算总标签数
  const totalTabs = Object.values(groups).reduce(
    (sum, tabs) => sum + tabs.length,
    0
  )

  return (
    <div className="sidepanel">
      <header className="header">
        <h1 className="title">📂 标签管家</h1>
        <span className="tab-count">{totalTabs} 个标签</span>
      </header>

      <SearchBar onSearch={handleSearch} />

      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === "tabs" ? "active" : ""}`}
          onClick={() => setActiveTab("tabs")}
        >
          分组
        </button>
        <button
          className={`tab-btn ${activeTab === "suggest" ? "active" : ""}`}
          onClick={() => setActiveTab("suggest")}
        >
          建议关闭
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          历史
        </button>
      </nav>

      <div className="content">
        {activeTab === "tabs" && (
          <GroupTree
            groups={filteredGroups}
            groupDefs={groupDefs}
            highlightGroup={highlightGroup}
          />
        )}
        {activeTab === "suggest" && <SuggestClose />}
        {activeTab === "history" && <TabHistory />}
      </div>

      <footer className="footer">
        <button className="sleep-btn" onClick={handleSleepInactive}>
          😴 休眠不活跃标签
        </button>
      </footer>

      <style>{`
        :root {
          --bg: #1a1a2e;
          --text: #e0e0e0;
          --border: #2a2a4a;
          --hover: #2a2a4a;
          --active-bg: #4a4a8a;
          --active-text: #fff;
          --muted: #888;
          --btn-border: #4a4a8a;
          --btn-text: #aaa;
          --scrollbar-thumb: #4a4a8a;
          --suggest-close-border: #8a4a4a;
          --suggest-close-text: #c88;
          --suggest-close-hover: #aa5a5a;
          --highlight-bg: #2a2a5a;
          --highlight-border: #6a6aff;
          --empty: #666;
          --history-hover: #2a2a4a;
          --tab-title: #ccc;
        }
        @media (prefers-color-scheme: light) {
          :root {
            --bg: #ffffff;
            --text: #1a1a1a;
            --border: #e0e0e0;
            --hover: #f0f0f0;
            --active-bg: #e8e8ff;
            --active-text: #4a4a8a;
            --muted: #888;
            --btn-border: #d0d0d0;
            --btn-text: #666;
            --scrollbar-thumb: #d0d0d0;
            --suggest-close-border: #ffcccc;
            --suggest-close-text: #cc4444;
            --suggest-close-hover: #ee6666;
            --highlight-bg: #e8e8ff;
            --highlight-border: #6a6aff;
            --empty: #999;
            --history-hover: #f5f5f5;
            --tab-title: #444;
          }
        }
        .sidepanel {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: var(--bg);
          color: var(--text);
        }
        .header {
          padding: 12px 16px 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
        }
        .title { font-size: 16px; font-weight: 700; margin: 0; }
        .tab-count { font-size: 12px; color: var(--muted); }
        .tabs-nav {
          display: flex;
          padding: 4px 12px;
          gap: 4px;
          border-bottom: 1px solid var(--border);
        }
        .tab-btn {
          flex: 1;
          padding: 6px;
          border: none;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          font-size: 13px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .tab-btn:hover { background: var(--hover); color: var(--text); }
        .tab-btn.active {
          background: var(--active-bg);
          color: var(--active-text);
          font-weight: 600;
        }
        .content {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .footer {
          padding: 8px 12px;
          border-top: 1px solid var(--border);
        }
        .sleep-btn {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--btn-border);
          background: transparent;
          color: var(--btn-text);
          cursor: pointer;
          font-size: 12px;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .sleep-btn:hover {
          background: var(--hover);
          color: var(--text);
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
      `}</style>
    </div>
  )
}

function SuggestClose() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_SUGGEST_CLOSE" })
      .then((data) => {
        setItems(data || [])
        setLoading(false)
      })
  }, [])

  const handleDiscard = async (tabIds: number[]) => {
    await chrome.runtime.sendMessage({
      type: "DISCARD_TABS",
      tabIds,
    })
    setItems((prev) => prev.filter((i) => !tabIds.includes(i.tabId)))
  }

  if (loading) return <div className="empty">加载中...</div>
  if (items.length === 0)
    return <div className="empty">✅ 没有需要关闭的标签</div>

  return (
    <div>
      <div className="section-title">
        建议关闭 ({items.length})
        <button
          className="close-all-btn"
          onClick={() => handleDiscard(items.map((i) => i.tabId))}
        >
          全部关闭
        </button>
      </div>
      {items.map((item) => (
        <div key={item.tabId} className="suggest-item">
          <div className="suggest-title">{item.title || item.url}</div>
          <div className="suggest-meta">
            {item.daysSinceAccess}天未访问 · {item.groupId}
          </div>
          <button
            className="close-btn"
            onClick={() => handleDiscard([item.tabId])}
          >
            关闭
          </button>
        </div>
      ))}
      <style>{`
        .section-title {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted, #888);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .close-all-btn {
          padding: 2px 8px;
          border: 1px solid var(--suggest-close-border, #8a4a4a);
          background: transparent;
          color: var(--suggest-close-text, #c88);
          cursor: pointer;
          font-size: 11px;
          border-radius: 4px;
        }
        .close-all-btn:hover { background: var(--suggest-close-border, #8a4a4a); color: #fff; }
        .suggest-item {
          padding: 8px 16px;
          border-bottom: 1px solid var(--border, #2a2a4a);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .suggest-title {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .suggest-meta { font-size: 11px; color: var(--muted, #666); }
        .close-btn {
          align-self: flex-end;
          padding: 2px 8px;
          border: none;
          background: var(--suggest-close-border, #8a4a4a);
          color: #fff;
          cursor: pointer;
          font-size: 11px;
          border-radius: 4px;
        }
        .close-btn:hover { background: var(--suggest-close-hover, #aa5a5a); }
      `}</style>
    </div>
  )
}

function TabHistory() {
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_HISTORY", limit: 30 })
      .then(setItems)
  }, [])

  if (items.length === 0)
    return <div className="empty">暂无关闭记录</div>

  return (
    <div>
      <div className="section-title">最近关闭 ({items.length})</div>
      {items.map((item) => (
        <div key={item.id} className="history-item">
          <div className="history-title">{item.title || item.url}</div>
          <div className="history-meta">
            {new Date(item.closedAt).toLocaleString()} · {item.groupId}
          </div>
        </div>
      ))}
      <style>{`
        .history-item {
          padding: 8px 16px;
          border-bottom: 1px solid var(--border, #2a2a4a);
          cursor: pointer;
        }
        .history-item:hover { background: var(--history-hover, #2a2a4a); }
        .history-title {
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .history-meta { font-size: 11px; color: var(--muted, #666); }
      `}</style>
    </div>
  )
}

async function handleSleepInactive() {
  const tabs = await chrome.tabs.query({})
  const now = Date.now()
  const toDiscard: number[] = []

  for (const tab of tabs) {
    if (!tab.id || tab.pinned || tab.active || tab.audible) continue
    const result = await chrome.storage.session.get([`access_${tab.id}`])
    const lastAccess = result[`access_${tab.id}`] || now
    const daysSince = (now - lastAccess) / (1000 * 60 * 60 * 24)
    if (daysSince > 1) toDiscard.push(tab.id)
  }

  if (toDiscard.length > 0) {
    await chrome.runtime.sendMessage({
      type: "DISCARD_TABS",
      tabIds: toDiscard,
    })
  }
}

const empty = {
  padding: "20px",
  textAlign: "center" as const,
  color: "#666",
  fontSize: "13px",
}

export default SidePanel
