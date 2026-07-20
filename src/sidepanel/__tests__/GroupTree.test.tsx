/**
 * GroupTree 组件测试
 */
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import GroupTree from "../GroupTree"
import type { GroupDef } from "~lib/rule-engine"
import { setupChromeMock } from "./chrome-mock"

const groupDefs: GroupDef[] = [
  { id: "dev", name: "开发", icon: "🖥️" },
  { id: "video", name: "视频", icon: "🎬" },
  { id: "shop", name: "购物", icon: "🛒" },
  { id: "read", name: "阅读", icon: "📖" },
]

const mockTabs: Record<string, chrome.tabs.Tab[]> = {
  dev: [
    { id: 1, url: "https://github.com/", title: "GitHub", pinned: false, favIconUrl: "" } as chrome.tabs.Tab,
    { id: 2, url: "https://stackoverflow.com/", title: "StackOverflow", pinned: false, favIconUrl: "" } as chrome.tabs.Tab,
  ],
  video: [
    { id: 3, url: "https://youtube.com/watch?v=xxx", title: "YouTube", pinned: false, favIconUrl: "" } as chrome.tabs.Tab,
  ],
  shop: [],
  read: [
    { id: 4, url: "https://zhihu.com/question/1", title: "知乎精选", pinned: false, favIconUrl: "" } as chrome.tabs.Tab,
  ],
}

describe("GroupTree", () => {
  beforeEach(() => {
    setupChromeMock()
  })

  it("渲染有标签的分组，按数量降序排列", () => {
    render(
      <GroupTree groups={mockTabs} groupDefs={groupDefs} highlightGroup={null} />
    )

    // dev (2 tabs) 应该排第一，read (1) 第二，video (1) 第三
    const groupNames = screen.getAllByText(/开发|视频|阅读/)
    expect(groupNames[0].textContent).toBe("开发")
  })

  it("显示分组图标和标签数量", () => {
    render(
      <GroupTree groups={mockTabs} groupDefs={groupDefs} highlightGroup={null} />
    )

    expect(screen.getByText("🖥️")).toBeDefined()
    expect(screen.getByText("🎬")).toBeDefined()
    expect(screen.getByText("2")).toBeDefined() // dev count
    const countOnes = screen.getAllByText("1")
    expect(countOnes.length).toBe(2) // video + read
  })

  it("展开分组时显示标签列表", () => {
    render(
      <GroupTree groups={mockTabs} groupDefs={groupDefs} highlightGroup={null} />
    )

    // 默认展开，应显示标签标题
    expect(screen.getByText("GitHub")).toBeDefined()
    expect(screen.getByText("StackOverflow")).toBeDefined()
    expect(screen.getByText("YouTube")).toBeDefined()
  })

  it("点击分组头部可折叠/展开", () => {
    render(
      <GroupTree groups={mockTabs} groupDefs={groupDefs} highlightGroup={null} />
    )

    // 默认展开 → 点击折叠
    expect(screen.getByText("GitHub")).toBeDefined()
    fireEvent.click(screen.getByText("开发"))
    // 折叠后标签应隐藏
    expect(screen.queryByText("GitHub")).toBeNull()

    // 再次点击展开
    fireEvent.click(screen.getByText("开发"))
    expect(screen.getByText("GitHub")).toBeDefined()
  })

  it("高亮当前激活的分组", () => {
    const { container } = render(
      <GroupTree
        groups={mockTabs}
        groupDefs={groupDefs}
        highlightGroup="dev"
      />
    )

    const highlighted = container.querySelector(".highlighted")
    expect(highlighted).not.toBeNull()
  })

  it("空标签时显示暂无标签提示", () => {
    render(
      <GroupTree groups={{}} groupDefs={groupDefs} highlightGroup={null} />
    )

    expect(screen.getByText("暂无标签")).toBeDefined()
  })

  it("空分组（无标签）不渲染", () => {
    render(
      <GroupTree groups={mockTabs} groupDefs={groupDefs} highlightGroup={null} />
    )

    // shop 分组无标签，不应显示
    expect(screen.queryByText("购物")).toBeNull()
  })

  it("点击标签触发 chrome.tabs.update", () => {
    render(
      <GroupTree groups={mockTabs} groupDefs={groupDefs} highlightGroup={null} />
    )

    fireEvent.click(screen.getByText("GitHub"))
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true })
  })
})
