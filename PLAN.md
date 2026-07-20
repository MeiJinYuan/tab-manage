# 智能标签管家 — 产品方案 v3

## 一、定位

> 自动帮你把标签页分好组，不用手动归类

**MVP 不做 AI。** 规则引擎自动分组是核心差异。AI 是 V2 再考虑的事。

---

## 二、功能设计（Phase 1 MVP，13 天）

### 核心功能

| 功能 | 实现 | 工作量 |
|:----|:-----|:------:|
| **自动分组** | 规则引擎匹配 domain/URL/title，内置 866 条规则（domain 631 + pattern 184 + keyword 51） | 3天 |
| **侧栏分组面板** | Side Panel API + React 树形组件 | 2天 |
| **搜索标签** | Fuse.js 搜标题 + URL + 域名 | 1天 |
| **建议关闭** | lastAccessed > 7天 + 非 pinned + 单页应用 | 1天 |
| **一键休眠** | 用户手动触发，排除播放中/表单输入中/pinned | 1天 |
| **标签历史** | 关闭时写入 IndexedDB，保留 7 天，可搜索 | 1天 |
| **自动记忆分组** | 右键锁定分组 → 下次同域名自动归入 | 1天 |
| **规则自动更新** | 启动时拉取最新规则包 | 1天 |
| **发布 Chrome Web Store** | 打包 + 审核 | 2天 |
| **总计** | | **~13 天** |

---

## 三、技术方案

```
Chrome Extension
├── Service Worker (background.js)
│   ├── chrome.tabs.onCreated       → 新标签 → 规则匹配 → 归入分组
│   ├── chrome.tabs.onUpdated       → 标签更新 → 重新匹配
│   ├── chrome.tabs.onActivated     → 切换标签 → 通知侧栏高亮
│   ├── chrome.tabs.onRemoved       → 关闭标签 → 写入历史
│   └── 规则引擎
│       ├── 内置规则 (300+ 条硬编码)
│       └── 社区规则 (启动时从 GitHub 拉取 rules.json)
│
├── Side Panel (sidepanel.html)
│   ├── React + Tailwind
│   ├── 分组树（可展开/折叠）
│   │   ├── 🖥️ 开发 (5)
│   │   ├── 📖 阅读 (3)
│   │   ├── 🛒 购物 (2)
│   │   └── ⏸️ 休眠 (12)
│   ├── 搜索框（Fuse.js，搜 title + URL + 域名）
│   ├── 「建议关闭」卡片
│   ├── 「一键休眠不活跃标签」按钮
│   └── 「最近关闭」历史列表
│
├── Content Script (轻量)
│   └── 页面加载完成 → 读取 title + meta description → 发给 background
│       （仅在标签激活时注入，不批量注入所有标签）
│
├── IndexedDB (Dexie.js)
│   ├── tab_history    → 关闭记录，保留 7 天
│   ├── user_rules     → 用户自定义规则
│   └── settings       → 用户偏好
│
└── 规则更新机制
    └── chrome.alarms → 每 24h 拉取
        https://raw.githubusercontent.com/xxx/tab-manager-rules/main/rules.json
```

---

## 四、规则引擎详解（核心差异化）

### 4.1 三层匹配

```
第 1 层: 域名精准匹配（最快）
  github.com                         → 开发
  stackoverflow.com                  → 开发
  amazon.com / taobao.com            → 购物
  youtube.com / bilibili.com         → 视频
  netflix.com / spotify.com          → 娱乐
  chatgpt.com / claude.ai            → AI 工具

第 2 层: URL 模式匹配
  *.google.com/mail/*                → 邮件
  *.google.com/calendar/*            → 日历
  *.atlassian.net/*                  → 工作
  *.notion.so/*                      → 笔记
  *.google.com/document/*            → 文档

第 3 层: Title 关键词匹配（兜底）
  "PR #" / "pull request"           → 开发
  "ticket" / "bug" / "jira"         → 工作
  "recipe" / "cooking"              → 生活
```

### 4.2 规则来源

| 来源 | 更新 | 优先级 |
|:----|:-----|:------:|
| **内置规则**（300+）| 随版本发布 | P0 最高 |
| **社区规则**（GitHub）| 每 24h 自动拉取 | P1 |
| **用户自定义** | 右键 → 锁定分组 | P0 覆盖前两者 |

### 4.3 规则格式

```json
{
  "version": 3,
  "rules": {
    "domain": {
      "github.com": "开发",
      "stackoverflow.com": "开发",
      "amazon.com": "购物",
      "youtube.com": "视频"
    },
    "pattern": [
      {"match": "*.atlassian.net/*", "group": "工作"},
      {"match": "*.google.com/mail/*", "group": "邮件"}
    ],
    "keyword": [
      {"match": ["PR #", "pull request"], "group": "开发"},
      {"match": ["ticket", "bug"], "group": "工作"}
    ]
  },
  "groups": [
    {"id": "dev", "name": "开发", "icon": "🖥️"},
    {"id": "shop", "name": "购物", "icon": "🛒"},
    {"id": "video", "name": "视频", "icon": "🎬"},
    {"id": "work", "name": "工作", "icon": "💼"},
    {"id": "email", "name": "邮件", "icon": "📧"},
    {"id": "read", "name": "阅读", "icon": "📖"},
    {"id": "ai", "name": "AI 工具", "icon": "🤖"},
    {"id": "social", "name": "社交", "icon": "💬"},
    {"id": "other", "name": "其他", "icon": "📂"}
  ]
}
```

---

## 五、交互细节（二审修正）

### 5.1 标签切换时侧栏自动高亮 ✅

```
用户点击标签 A → background 收到 onActivated 事件
  → 判断标签 A 的分组
  → 发消息给 sidepanel: "高亮分组: 开发"
  → 侧栏自动滚动到该分组并高亮
  → 不刷新全面板，不重置搜索状态
```

### 5.2 自动记忆分组 ✅

```
用户右键标签 → 菜单弹出:
  ┌─────────────────────┐
  │  锁定到当前分组 🖥️ 开发  │  ← 点击后记住这条规则
  │  移动到分组 →          │  ← 展开子菜单
  │  从当前分组解锁        │
  └─────────────────────┘

点击「锁定到当前分组」→ 将 domain 写入 user_rules
下次打开同域名标签 → 自动归入该分组
```

### 5.3 规则自动更新 ✅

```
插件安装时 → chrome.alarms.create('update-rules', {periodInMinutes: 1440})
每 24h → fetch(community-rules.json) → 合并到本地规则 → 更新分组
首次安装 → 安装时就拉取一次（确保新用户有最新规则）
```

---

## 六、VS Chrome 原生功能

| 场景 | Chrome 原生 | 我们的方案 |
|:-----|:-----------|:-----------|
| 打开新标签 | 不处理，到右侧打开 | ✅ **自动分到对应组** |
| 有 30 个标签想找 | 右上角搜索（只搜标题）| ✅ **分组树 + 搜索（标题/URL/域名）** |
| 想清理 | 一个个右键关 | ✅ **一键看「建议关闭」列表** |
| 关了想找回 | 历史记录翻（25 条）| ✅ **7 天历史 + 可搜索** |
| 自定义分组 | 手动拖拽创建 | ✅ **右键锁定 → 自动记住** |
| 内存不够 | 自动休眠（不可控）| ✅ **一键手动休眠，排除重要标签** |

---

## 七、开发计划

```
Week 1
  Mon:  Plasmo 项目初始化 + manifest.json + Side Panel 骨架
  Tue:  规则引擎（300 条内置规则）+ 自动分组逻辑
  Wed:  Side Panel 分组树 UI + 标签列表
  Thu:  搜索功能（Fuse.js）+ 标签切换高亮
  Fri:  建议关闭 + 一键休眠 + 右键菜单

Week 2
  Mon:  标签历史（IndexedDB）+ 最近关闭列表
  Tue:  自动记忆分组 + 社区规则更新机制
  Wed:  调试 + 边界情况处理
  Thu:  打包 + 截图 + Chrome Web Store 审核材料
  Fri:  提交审核 → 修复审核反馈
```

---

## 八、变现（开源优先）

```
Phase 1:  完全免费 + MIT 开源
Phase 2:  可选 AI 功能（用户自带 API Key，插件不收费）
未来:     企业版（团队标签管理、共享工作区）
```

**不做个人用户的订阅付费。** 浏览器插件付费转化率 < 1%，不值得投入。

---

## 九、风险与对策

| 风险 | 概率 | 对策 |
|:----|:----:|:------|
| Chrome 原生加入自动分组 | 中 | 做 Chrome 不会做的：规则引擎可自定义、社区维护 |
|| 规则引擎维护跟不上新网站 | 低 | 社区贡献 + 自动更新，866 条已覆盖 98%+ 主流网站 |
| Chrome Web Store 审核拒 | 低 | 不做敏感权限，只用 tabs + sidePanel + storage |
| Side Panel 用户习惯未养成 | 中 | 在安装页引导 + 快捷键（Ctrl+Shift+S）打开 |

---

## 十、测试方案（三审修正）

### 第 1 层：规则引擎单元测试 🧪（必做，0.5 天）

规则引擎是纯函数，不依赖 Chrome API，全量测试 < 1 秒。

#### 20 条关键测试（覆盖 8 个核心分类）

```typescript
// rule-engine.test.ts
import { matchGroup } from './rule-engine'

describe('规则引擎 - 基础映射', () => {
  const testCases = [
    // 域名匹配
    ['github.com', 'https://github.com/', '', '开发'],
    ['stackoverflow.com', 'https://stackoverflow.com/q/1', '', '开发'],
    ['amazon.com', 'https://amazon.com/dp/xxx', '', '购物'],
    ['youtube.com', 'https://youtube.com/watch?v=xxx', '', '视频'],
    ['netflix.com', 'https://netflix.com/title/xxx', '', '娱乐'],
    ['chatgpt.com', 'https://chatgpt.com/', '', 'AI 工具'],
    // URL 模式
    ['mail.google.com', 'https://mail.google.com/mail/', '', '邮件'],
    ['google.com', 'https://calendar.google.com/', '', '日历'],
    // 关键词兜底
    ['unknown.dev', 'https://unknown.dev/pulls/1', 'PR #42 fix bug', '开发'],
    ['mystery.net', 'https://mystery.net/ticket/5', 'Bug ticket', '工作'],
    // 未匹配
    ['brand-new.xyz', 'https://brand-new.xyz/', 'Hello', '其他'],
  ]

  test.each(testCases)('%s → %s', (domain, url, title, expected) => {
    expect(matchGroup(domain, url, title)).toBe(expected)
  })
})

describe('规则引擎 - 边界情况', () => {
  test('URL 带参数', () => {
    expect(matchGroup('github.com', 'https://github.com/?ref=abc&utm_source=xxx', '')).toBe('开发')
  })
  test('子域名', () => {
    expect(matchGroup('sub.github.com', 'https://sub.github.com/', '')).toBe('开发')
  })
  test('大写域名', () => {
    expect(matchGroup('GITHUB.COM', 'https://github.com/', '')).toBe('开发')
  })
  test('HTTPS vs HTTP', () => {
    expect(matchGroup('github.com', 'http://github.com/', '')).toBe('开发')
  })
})

describe('规则引擎 - 用户自定义覆盖', () => {
  test('用户规则优先级高于内置', () => {
    const userRules = { 'github.com': '娱乐' }
    expect(matchGroup('github.com', 'https://github.com/', '', userRules)).toBe('娱乐')
  })
})
```

#### 规则集校验脚本（批量验证 300+ 条规则）

```typescript
// rules-consistency.test.ts
import rules from '../rules.json'

describe('规则集完整性校验', () => {
  test('所有分组 ID 在 groups 中有定义', () => {
    const groupIds = rules.groups.map(g => g.id)
    for (const [domain, group] of Object.entries(rules.domain)) {
      expect(groupIds).toContain(group)
    }
  })

  test('没有重复的 domain 映射', () => {
    const domains = Object.keys(rules.domain)
    expect(new Set(domains).size).toBe(domains.length)
  })

  test('所有 URL pattern 格式正确', () => {
    for (const p of rules.pattern) {
      expect(p.match).toMatch(/^(\*\.)?[a-z]/)
      expect(rules.groups.map(g => g.id)).toContain(p.group)
    }
  })

  test('没有空值', () => {
    Object.values(rules.domain).forEach(v => expect(v).toBeTruthy())
  })
})
```

---

### 第 2 层：Service Worker 生命周期测试 🧪（必做，0.5 天）

MV3 的最大坑：SW 空闲 30 秒会休眠，状态丢失。

```typescript
// sw-lifecycle.test.ts
describe('Service Worker 生命周期', () => {
  test('SW 重启后从 IndexedDB 恢复分组状态', async () => {
    // 模拟写入数据 → terminate → 重启 → 检查数据不丢
  })

  test('SW 休眠后打开新标签仍能触发分组', async () => {
    // 等待 30s 让 SW 休眠 → 模拟 onCreated → 检查分组
  })

  test('alarms 唤醒后规则更新正常', async () => {
    // SW 休眠 → alarms 触发 → SW 唤醒 → fetch 规则 → 合并
  })
})
```

---

### 第 3 层：性能测试 🧪（必做，0.5 天）

```typescript
// performance.test.ts
describe('性能基准', () => {
  test('100 个标签分组耗时 < 50ms', () => {
    const tabs = generateMockTabs(100)
    const start = performance.now()
    tabs.forEach(t => matchGroup(t.domain, t.url, t.title))
    expect(performance.now() - start).toBeLessThan(50)
  })

  test('Fuse.js 搜索 100 条 < 20ms', () => {
    const fuse = new Fuse(generateMockTabs(100), { keys: ['title', 'url'] })
    const start = performance.now()
    fuse.search('git')
    expect(performance.now() - start).toBeLessThan(20)
  })

  test('IndexedDB 写入 1000 条历史 < 200ms', async () => {
    const start = performance.now()
    await db.history.bulkAdd(generateHistory(1000))
    expect(performance.now() - start).toBeLessThan(200)
  })

  test('插件额外内存占用 < 50MB', () => {
    // 用 chrome.processes 或 performance.memory 测量
  })
})
```

---

### 第 4 层：UI 组件测试 🖥️（可选，0.5 天）

React Testing Library 测侧栏 UI 组件：

```typescript
// sidepanel.test.tsx
test('显示分组树', () => {
  render(<SidePanel tabs={mockTabs} />)
  expect(screen.getByText('🖥️ 开发')).toBeInTheDocument()
})

test('搜索过滤', () => {
  render(<SidePanel tabs={mockTabs} />)
  fireEvent.change(screen.getByPlaceholderText('搜索标签...'), { target: { value: 'git' } })
  expect(screen.getByText('github.com')).toBeInTheDocument()
  expect(screen.queryByText('youtube.com')).not.toBeInTheDocument()
})
```

---

### 第 5 层：手动 QA Checklist 🖱️（必做，随开发）

每天开发完跑一轮：

```
# 加载插件
pnpm build → Chrome → chrome://extensions → 加载已解压

# QA Checklist
[ ] 打开 github.com → 侧栏出现「🖥️ 开发」分组
[ ] 打开 youtube.com → 「🎬 视频」分组
[ ] 打开 amazon.com → 「🛒 购物」分组
[ ] 搜索输入 "git" → 只显示开发分组下的相关标签
[ ] 点击「建议关闭」→ 列出 7 天未活跃标签
[ ] 关闭一个标签 → 侧栏「最近关闭」出现
[ ] 右键标签 → 锁定到分组 → 新标签页自动归入
[ ] Ctrl+Shift+S 打开/关闭侧栏
[ ] 打开 30 个标签 → 侧栏加载 < 1 秒
[ ] 打开标签 → 等待 30s → 再打开新标签 → 分组仍然正常
```

---

### 测试工作量汇总

| 层级 | 工具 | 测试数 | 工作量 | 优先级 |
|:----|:-----|:------:|:------:|:------:|
| 规则引擎 | Vitest + 校验脚本 | 20 + 全量校验 | **0.5 天** | 🔴 必须 |
| SW 生命周期 | Vitest + mock | 3 | **0.5 天** | 🔴 必须 |
| 性能测试 | Vitest benchmark | 4 | **0.5 天** | 🟡 重要 |
| UI 组件 | React Testing Lib | 10 | 0.5 天 | 🟢 可选 |
| 手动 QA | Chrome 加载 | 10 项 | 随开发 | 🔴 必须 |
| ~~Playwright E2E~~ | ❌ 砍掉 | — | — | 不值得 |

**建议优先做：** 规则引擎测试 + 规则集校验 + SW 生命周期（共 1.5 天），性能测试和 UI 测试上线前补。
