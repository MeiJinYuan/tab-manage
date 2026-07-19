/**
 * 分组树组件
 */
import { useState } from "react"
import type { GroupDef } from "~lib/rule-engine"

interface Props {
  groups: Record<string, chrome.tabs.Tab[]>
  groupDefs: GroupDef[]
  highlightGroup: string | null
}

export default function GroupTree({
  groups,
  groupDefs,
  highlightGroup,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sortedGroups = groupDefs
    .filter((g) => groups[g.id] && groups[g.id].length > 0)
    .sort((a, b) => (groups[b.id]?.length || 0) - (groups[a.id]?.length || 0))

  if (sortedGroups.length === 0) {
    return <div style={emptyStyle}>暂无标签</div>
  }

  return (
    <div>
      {sortedGroups.map((group) => {
        const tabs = groups[group.id]
        const isCollapsed = collapsed.has(group.id)
        const isHighlighted = highlightGroup === group.id

        return (
          <div
            key={group.id}
            className={`group-section ${isHighlighted ? "highlighted" : ""}`}
          >
            <div
              className="group-header"
              onClick={() => toggleCollapse(group.id)}
            >
              <span className="group-toggle">{isCollapsed ? "▶" : "▼"}</span>
              <span className="group-icon">{group.icon}</span>
              <span className="group-name">{group.name}</span>
              <span className="group-count">{tabs.length}</span>
            </div>

            {!isCollapsed && (
              <div className="tab-list">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className="tab-item"
                    onClick={() => chrome.tabs.update(tab.id!, { active: true })}
                    title={tab.url}
                  >
                    {tab.favIconUrl && (
                      <img
                        src={tab.favIconUrl}
                        className="favicon"
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                    )}
                    <span className="tab-title">
                      {tab.title || "新标签页"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <style>{`
        .group-section {
          transition: background 0.3s;
        }
        .group-section.highlighted {
          background: #2a2a5a;
          border-left: 3px solid #6a6aff;
        }
        .group-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          cursor: pointer;
          user-select: none;
          gap: 6px;
          transition: background 0.15s;
        }
        .group-header:hover { background: #2a2a4a; }
        .group-toggle { font-size: 10px; color: #666; width: 12px; }
        .group-icon { font-size: 16px; }
        .group-name { flex: 1; font-size: 14px; font-weight: 500; }
        .group-count {
          font-size: 12px;
          color: #888;
          background: #2a2a4a;
          padding: 1px 6px;
          border-radius: 10px;
          min-width: 20px;
          text-align: center;
        }
        .tab-list { border-left: 1px solid #2a2a4a; margin-left: 20px; }
        .tab-item {
          display: flex;
          align-items: center;
          padding: 6px 12px;
          gap: 6px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .tab-item:hover { background: #2a2a4a; }
        .favicon { width: 16px; height: 16px; flex-shrink: 0; }
        .tab-title {
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #ccc;
        }
      `}</style>
    </div>
  )
}

const emptyStyle: React.CSSProperties = {
  padding: "20px",
  textAlign: "center",
  color: "#666",
  fontSize: "13px",
}
