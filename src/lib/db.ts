/**
 * IndexedDB 数据层 — 标签历史 + 用户规则
 */
import Dexie, { type Table } from "dexie"

export interface TabHistory {
  id?: number
  fullName: string
  url: string
  title: string
  groupId: string
  closedAt: number // timestamp
}

export interface UserRule {
  domain: string
  groupId: string
  createdAt: number
}

export class TabManagerDB extends Dexie {
  history!: Table<TabHistory>
  userRules!: Table<UserRule>

  constructor() {
    super("TabManagerDB")
    this.version(1).stores({
      history: "++id, url, closedAt",
      userRules: "domain",
    })
  }
}

export const db = new TabManagerDB()

// 历史记录
export async function addToHistory(tab: {
  url: string
  title: string
  groupId: string
}) {
  const fullName = tab.title
    ? `${tab.title} — ${tab.url}`
    : tab.url
  await db.history.add({
    fullName,
    url: tab.url,
    title: tab.title || "",
    groupId: tab.groupId,
    closedAt: Date.now(),
  })
}

export async function getRecentHistory(limit = 50): Promise<TabHistory[]> {
  return db.history
    .orderBy("closedAt")
    .reverse()
    .limit(limit)
    .toArray()
}

export async function clearOldHistory(days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  await db.history.where("closedAt").below(cutoff).delete()
}

// 用户规则
export async function setUserRule(domain: string, groupId: string) {
  await db.userRules.put({ domain, groupId, createdAt: Date.now() })
}

export async function removeUserRule(domain: string) {
  await db.userRules.delete(domain)
}

export async function getUserRules(): Promise<Record<string, string>> {
  const rules = await db.userRules.toArray()
  const map: Record<string, string> = {}
  for (const r of rules) {
    map[r.domain] = r.groupId
  }
  return map
}
