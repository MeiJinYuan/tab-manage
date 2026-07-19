/**
 * 规则集完整性校验 — 批量验证 300+ 条规则
 * 遍历所有规则，确保格式正确、分组存在、无重复
 */
import { describe, it, expect } from "vitest"
import rules from "../../rules/rules.json"

describe("规则集完整性校验", () => {
  // 14 个分组 ID
  const groupIds = rules.groups.map((g) => g.id)

  it("domain 规则中所有 groupId 在 groups 中有定义", () => {
    for (const [domain, groupId] of Object.entries(rules.domain)) {
      expect(groupIds, `domain ${domain} 指向不存在的分组 ${groupId}`).toContain(groupId)
    }
  })

  it("pattern 规则中所有 group 在 groups 中有定义", () => {
    for (const p of rules.pattern) {
      expect(groupIds, `pattern ${p.match} 指向不存在的分组 ${p.group}`).toContain(p.group)
    }
  })

  it("keyword 规则中所有 group 在 groups 中有定义", () => {
    for (const kw of rules.keyword) {
      expect(groupIds, `keyword ${kw.words[0]} 指向不存在的分组 ${kw.group}`).toContain(kw.group)
    }
  })

  it("没有重复的 domain 映射", () => {
    const domains = Object.keys(rules.domain)
    expect(new Set(domains).size).toBe(domains.length)
  })

  it("domain 中所有值非空", () => {
    for (const [domain, groupId] of Object.entries(rules.domain)) {
      expect(groupId, `domain ${domain} 的值为空`).toBeTruthy()
    }
  })

  it("所有 URL pattern 以字母或通配符开头", () => {
    for (const p of rules.pattern) {
      expect(p.match).toMatch(/^(\*\.)?[a-z]/)
    }
  })

  it("keyword 规则至少有一个词", () => {
    for (const kw of rules.keyword) {
      expect(kw.words.length).toBeGreaterThan(0)
    }
  })
})

describe("规则集统计", () => {
  it("domain 规则数量", () => {
    const count = Object.keys(rules.domain).length
    expect(count).toBeGreaterThan(150)
    console.log(`  域名规则: ${count} 条`)
  })

  it("pattern 规则数量", () => {
    expect(rules.pattern.length).toBeGreaterThan(20)
    console.log(`  URL 模式: ${rules.pattern.length} 条`)
  })

  it("keyword 规则数量", () => {
    expect(rules.keyword.length).toBeGreaterThan(5)
    console.log(`  关键词: ${rules.keyword.length} 条`)
  })

  it("总规则数", () => {
    const total =
      Object.keys(rules.domain).length +
      rules.pattern.length +
      rules.keyword.length
    expect(total).toBeGreaterThan(200)
    console.log(`  规则总数: ${total} 条`)
    console.log(`  分组数: ${rules.groups.length}`)
  })
})
