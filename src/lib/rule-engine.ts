/** 预编译的 URL 模式正则（一次性编译，避免每次 match 都 new RegExp） */
let compiledPatterns: { regex: RegExp; group: string }[] | null = null

function getCompiledPatterns(patterns: { match: string; group: string }[]) {
  if (!compiledPatterns) {
    compiledPatterns = patterns.map((p) => ({
      regex: new RegExp(
        "^" +
          p.match
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*") +
          "$",
        "i"
      ),
      group: p.group,
    }))
  }
  return compiledPatterns
}

/**
 * 规则引擎 — 根据 domain/URL/title 自动匹配标签分组
 *
 * 匹配优先级:
 *   1. 用户自定义规则（覆盖内置）
 *   2. 域名精准匹配
 *   3. URL 模式匹配
 *   4. Title 关键词匹配
 *   5. 兜底 → 'other'
 */

import defaultRules from "~/rules/rules.json"

export interface GroupDef {
  id: string
  name: string
  icon: string
}

export interface Rules {
  version: number
  groups: GroupDef[]
  domain: Record<string, string>
  pattern: { match: string; group: string }[]
  keyword: { words: string[]; group: string }[]
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, "").toLowerCase() + u.pathname.replace(/\/$/, "")
  } catch {
    return url.toLowerCase()
  }
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/**
 * 核心匹配函数
 * @param domain - 域名（小写，不含 www）
 * @param url - 完整 URL
 * @param title - 页面标题
 * @param userRules - 用户自定义规则（可选，覆盖内置规则）
 * @param customRules - 自定义规则集（可选，覆盖默认内置规则）
 */
function findDomainMatch(
  rawDomain: string,
  domainRules: Record<string, string>
): string | null {
  const d = rawDomain.toLowerCase().replace(/^www\./, "")

  // 1. 精确匹配
  if (domainRules[d]) return domainRules[d]

  // 2. 逐级剥离子域名: sub.github.com → github.com
  const parts = d.split(".")
  while (parts.length > 2) {
    parts.shift()
    const parent = parts.join(".")
    if (domainRules[parent]) return domainRules[parent]
  }

  return null
}

export function matchGroup(
  domain: string,
  url: string,
  title: string,
  userRules?: Record<string, string>,
  customRules?: Rules
): string {
  const rules = customRules || (defaultRules as Rules)
  const normalizedUrl = normalizeUrl(url)

  // ── 预编译模式匹配（比逐条 new RegExp 更快）──
  const patterns = getCompiledPatterns(rules.pattern)
  for (const p of patterns) {
    if (p.regex.test(normalizedUrl)) {
      return p.group
    }
  }

  // 1. 用户自定义规则（最高优先级，覆盖内置）
  if (userRules) {
    const userMatch = findDomainMatch(domain, userRules)
    if (userMatch) return userMatch
  }

  // 2. 域名匹配（支持子域名降级）
  const domainMatch = findDomainMatch(domain, rules.domain)
  if (domainMatch) return domainMatch

  // 3. Title 关键词匹配
  const lowerTitle = title.toLowerCase()
  for (const kw of rules.keyword) {
    for (const word of kw.words) {
      if (lowerTitle.includes(word.toLowerCase())) {
        return kw.group
      }
    }
  }

  // 4. 兜底
  return "other"
}

/**
 * 批量匹配多个标签
 */
export function batchMatch(
  tabs: { id?: number; url?: string; title?: string }[],
  userRules?: Record<string, string>
): Map<number, string> {
  const result = new Map<number, string>()
  for (const tab of tabs) {
    if (!tab.url || !tab.id) continue
    const domain = extractDomain(tab.url)
    const group = matchGroup(domain, tab.url, tab.title || "", userRules)
    result.set(tab.id, group)
  }
  return result
}

/**
 * 获取所有分组定义
 */
export function getGroups(): GroupDef[] {
  return (defaultRules as Rules).groups
}

/**
 * 根据分组 ID 获取分组信息
 */
export function getGroupInfo(groupId: string): GroupDef | undefined {
  return (defaultRules as Rules).groups.find((g) => g.id === groupId)
}
