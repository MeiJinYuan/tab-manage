/**
 * 规则引擎单元测试 — 20 条关键测试覆盖 8 个核心分类
 */
import { describe, it, expect } from "vitest"
import { matchGroup, batchMatch, getGroups } from "../rule-engine"
import rules from "../../rules/rules.json"

describe("规则引擎 - 域名精准匹配", () => {
  const testCases = [
    ["github.com", "https://github.com/", "", "dev"],
    ["stackoverflow.com", "https://stackoverflow.com/q/1", "", "dev"],
    ["gitlab.com", "https://gitlab.com/project", "", "dev"],
    ["amazon.com", "https://amazon.com/dp/xxx", "", "shop"],
    ["taobao.com", "https://taobao.com/item/1", "", "shop"],
    ["youtube.com", "https://youtube.com/watch?v=xxx", "", "video"],
    ["bilibili.com", "https://bilibili.com/video/xxx", "", "video"],
    ["netflix.com", "https://netflix.com/title/xxx", "", "entertain"],
    ["chatgpt.com", "https://chatgpt.com/", "", "ai"],
    ["claude.ai", "https://claude.ai/", "", "ai"],
    ["notion.so", "https://notion.so/workspace", "", "docs"],
    ["reddit.com", "https://reddit.com/r/programming", "", "social"],
    ["twitter.com", "https://twitter.com/user", "", "social"],
    ["wikipedia.org", "https://wikipedia.org/wiki/Chrome", "", "read"],
    ["zhihu.com", "https://zhihu.com/question/1", "", "read"],
    ["gmail.com", "https://gmail.com/", "", "email"],
  ]

  it.each(testCases)("域名 %s → 分组 %s", (domain, url, _title, expected) => {
    expect(matchGroup(domain as string, url as string, _title as string)).toBe(
      expected
    )
  })
})

describe("规则引擎 - URL 模式匹配", () => {
  const testCases = [
    ["github.com", "https://github.com/user/repo/pull/42", "", "dev"],
    ["github.com", "https://github.com/user/repo/issues/1", "", "dev"],
    ["google.com", "https://mail.google.com/mail/inbox", "", "email"],
    ["google.com", "https://calendar.google.com/event", "", "tools"],
    ["google.com", "https://drive.google.com/file", "", "docs"],
    ["google.com", "https://docs.google.com/document/d/1", "", "docs"],
    ["google.com", "https://docs.google.com/spreadsheets/d/1", "", "docs"],
    ["google.com", "https://meet.google.com/abc-defg-hij", "", "tools"],
    ["atlassian.net", "https://company.atlassian.net/browse/PROJ-123", "", "work"],
    ["figma.com", "https://figma.com/file/abc123/design", "", "work"],
    ["slack.com", "https://app.slack.com/archives/C12345", "", "work"],
    ["linkedin.com", "https://linkedin.com/in/username", "", "social"],
    ["linkedin.com", "https://linkedin.com/jobs/view/123", "", "work"],
  ]

  it.each(testCases)("URL %s → 分组 %s", (domain, url, _title, expected) => {
    expect(matchGroup(domain as string, url as string, _title as string)).toBe(
      expected
    )
  })
})

describe("规则引擎 - Title 关键词兜底", () => {
  const testCases = [
    ["unknown.dev", "https://unknown.dev/pulls/1", "PR #42 fix bug", "dev"],
    ["mystery.net", "https://mystery.net/ticket/5", "Bug ticket: login fails", "work"],
    ["recipe.site", "https://recipe.site/pasta", "Baking homemade pasta recipe", "entertain"],
    ["deals.com", "https://deals.com/item", "Summer sale 50% discount", "shop"],
    ["tutorial.io", "https://tutorial.io/react", "Getting started with React tutorial", "read"],
    ["docs.example.com", "https://docs.example.com/api", "API documentation v2", "dev"],
  ]

  it.each(testCases)(
    "标题关键词 %s → 分组 %s",
    (domain, url, title, expected) => {
      expect(
        matchGroup(domain as string, url as string, title as string)
      ).toBe(expected)
    }
  )
})

describe("规则引擎 - 未匹配兜底", () => {
  const testCases = [
    ["brand-new.xyz", "https://brand-new.xyz/", "Hello World", "other"],
    ["random123.net", "https://random123.net/page", "", "other"],
  ]

  it.each(testCases)("未匹配 %s → other", (domain, url, title, expected) => {
    expect(matchGroup(domain as string, url as string, title as string)).toBe(
      expected
    )
  })
})

describe("规则引擎 - 边界情况", () => {
  it("URL 带查询参数", () => {
    expect(
      matchGroup(
        "github.com",
        "https://github.com/?ref=abc&utm_source=xxx",
        ""
      )
    ).toBe("dev")
  })

  it("子域名", () => {
    expect(
      matchGroup("sub.github.com", "https://sub.github.com/", "")
    ).toBe("dev")
  })

  it("大写域名不敏感", () => {
    expect(matchGroup("GITHUB.COM", "https://github.com/", "")).toBe("dev")
  })

  it("HTTPS vs HTTP", () => {
    expect(matchGroup("github.com", "http://github.com/", "")).toBe("dev")
  })

  it("www 前缀被忽略", () => {
    expect(
      matchGroup("www.github.com", "https://www.github.com/", "")
    ).toBe("dev")
  })

  it("无效 URL 不抛异常", () => {
    expect(() =>
      matchGroup("", "not-a-valid-url", "")
    ).not.toThrow()
  })
})

describe("规则引擎 - 用户自定义覆盖", () => {
  it("用户规则优先级高于内置规则", () => {
    const userRules = { "github.com": "entertain" }
    expect(
      matchGroup("github.com", "https://github.com/", "", userRules)
    ).toBe("entertain")
  })

  it("用户规则不影响其他域名", () => {
    const userRules = { "github.com": "entertain" }
    expect(
      matchGroup("youtube.com", "https://youtube.com/", "", userRules)
    ).toBe("video")
  })

  it("清除用户规则后恢复内置规则", () => {
    const userRules = {}
    expect(
      matchGroup("github.com", "https://github.com/", "", userRules)
    ).toBe("dev")
  })
})

describe("规则引擎 - 批量匹配", () => {
  it("batchMatch 返回正确的分组 Map", () => {
    const tabs = [
      { id: 1, url: "https://github.com/", title: "GitHub" },
      { id: 2, url: "https://youtube.com/", title: "YouTube" },
      { id: 3, url: "https://unknown.xyz/", title: "Test" },
    ]
    const result = batchMatch(tabs)
    expect(result.get(1)).toBe("dev")
    expect(result.get(2)).toBe("video")
    expect(result.get(3)).toBe("other")
  })

  it("无 URL 的标签跳过", () => {
    const tabs = [{ id: 1, url: undefined, title: "New Tab" }]
    const result = batchMatch(tabs)
    expect(result.size).toBe(0)
  })
})

describe("getGroups - 分组定义", () => {
  it("返回所有 14 个分组", () => {
    const groups = getGroups()
    expect(groups.length).toBe(14)
  })

  it("每个分组都有 id、name、icon", () => {
    const groups = getGroups()
    for (const g of groups) {
      expect(g.id).toBeTruthy()
      expect(g.name).toBeTruthy()
      expect(g.icon).toBeTruthy()
    }
  })
})
