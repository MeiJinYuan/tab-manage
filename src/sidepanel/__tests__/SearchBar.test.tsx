/**
 * SearchBar 组件测试
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import SearchBar from "../SearchBar"

describe("SearchBar", () => {
  it("渲染搜索输入框和默认占位符", () => {
    render(<SearchBar onSearch={() => {}} />)
    const input = screen.getByPlaceholderText("搜索标签（标题、URL）...")
    expect(input).toBeDefined()
  })

  it("输入内容时调用 onSearch", () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("搜索标签（标题、URL）...")

    fireEvent.change(input, { target: { value: "github" } })
    expect(onSearch).toHaveBeenCalledWith("github")
  })

  it("输入后显示清除按钮", () => {
    render(<SearchBar onSearch={() => {}} />)
    const input = screen.getByPlaceholderText("搜索标签（标题、URL）...")

    expect(screen.queryByText("✕")).toBeNull()
    fireEvent.change(input, { target: { value: "test" } })
    expect(screen.getByText("✕")).toBeDefined()
  })

  it("点击清除按钮清空输入并调用 onSearch('')", () => {
    const onSearch = vi.fn()
    render(<SearchBar onSearch={onSearch} />)
    const input = screen.getByPlaceholderText("搜索标签（标题、URL）...")

    fireEvent.change(input, { target: { value: "test" } })
    expect(screen.getByText("✕")).toBeDefined()

    fireEvent.click(screen.getByText("✕"))
    expect(onSearch).toHaveBeenCalledWith("")
  })

  it("聚焦时添加 focused 样式类", () => {
    const { container } = render(<SearchBar onSearch={() => {}} />)
    const input = screen.getByPlaceholderText("搜索标签（标题、URL）...")

    const searchContainer = container.querySelector(".search-container")
    expect(searchContainer?.className).not.toContain("focused")

    fireEvent.focus(input)
    expect(searchContainer?.className).toContain("focused")

    fireEvent.blur(input)
    expect(searchContainer?.className).not.toContain("focused")
  })
})
