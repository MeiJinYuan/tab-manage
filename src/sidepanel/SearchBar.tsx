/**
 * 搜索组件
 */
import { useState, useCallback } from "react"

interface Props {
  onSearch: (query: string) => void
}

export default function SearchBar({ onSearch }: Props) {
  const [value, setValue] = useState("")
  const [focused, setFocused] = useState(false)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setValue(v)
      onSearch(v)
    },
    [onSearch]
  )

  const handleClear = () => {
    setValue("")
    onSearch("")
  }

  return (
    <div className={`search-container ${focused ? "focused" : ""}`}>
      <span className="search-icon">🔍</span>
      <input
        className="search-input"
        placeholder="搜索标签（标题、URL）..."
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value && (
        <span className="clear-btn" onClick={handleClear}>
          ✕
        </span>
      )}

      <style>{`
        .search-container {
          display: flex;
          align-items: center;
          margin: 8px 12px;
          padding: 6px 10px;
          background: #2a2a4a;
          border-radius: 8px;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .search-container.focused {
          border-color: #6a6aff;
          background: #2a2a5a;
        }
        .search-icon { font-size: 14px; margin-right: 6px; }
        .search-input {
          flex: 1;
          border: none;
          background: transparent;
          color: #e0e0e0;
          font-size: 13px;
          outline: none;
        }
        .search-input::placeholder { color: #666; }
        .clear-btn {
          cursor: pointer;
          font-size: 12px;
          color: #888;
          padding: 2px 4px;
        }
        .clear-btn:hover { color: #fff; }
      `}</style>
    </div>
  )
}
