# 智能标签管家 — 项目上下文

## 项目概览

| 项目 | 信息 |
|:----|:------|
| **名称** | 智能标签管家 (Tab Manager) |
| **类型** | Chrome 浏览器扩展 (Manifest V3) |
| **版本** | 1.0.0 |
| **框架** | Plasmo + React 18 + TypeScript + Tailwind CSS |
| **状态** | MVP 完成，待上架 Chrome Web Store |
| **仓库** | `git@github.com:MeiJinYuan/tab-manage.git` |

---

## 产品定位

> 自动帮你把标签页分好组，不用手动归类。

**MVP 不做 AI。** 规则引擎自动分组是核心差异化优势。AI 功能在 V2 考虑。

**核心原则：**
- 全离线可用，零 API 调用，零模型下载
- 免费 + 开源 (MIT) + 可选 API Key，不做订阅
- 规则引擎社区可贡献 JSON 规则

---

## 技术架构

```
Chrome Extension (MV3)
├── Service Worker (background)
│   ├── 标签事件监听 (onCreated/onUpdated/onActivated/onRemoved)
│   ├── 规则引擎匹配
│   ├── 一键休眠 & 建议关闭
│   ├── 右键菜单 (锁定/移动/解锁分组)
│   └── 24h 定时规则更新
│
├── Side Panel (React UI)
│   ├── 分组树 (展开/折叠)
│   ├── 实时搜索 (Fuse.js)
│   ├── 建议关闭列表
│   ├── 一键休眠按钮
│   └── 最近关闭历史
│
├── IndexedDB (Dexie.js)
│   ├── tab_history → 7天关闭记录
│   ├── user_rules → 用户自定义规则
│   └── settings → 用户偏好
│
└── 规则集
    ├── 内置 328 条规则 (14 分组)
    ├── 社区规则 (GitHub, 每24h拉取)
    └── 用户自定义 (右键锁定)
```

---

## 规则引擎

**文件：** `src/lib/rule-engine.ts`
**规则：** `src/rules/rules.json`

| 匹配层 | 规则数 | 匹配方式 |
|:------|:------:|:---------|
| 域名精准匹配 | 277 | `github.com` → 开发 |
| URL 模式匹配 | 41 | `*.google.com/mail/*` → 邮件 |
| Title 关键词 | 10 | `"PR #"` → 开发 |
| **总计** | **328** | **14 个分组** |

匹配顺序：域名 → URL 模式 → 关键词 → 其他（兜底）
用户自定义规则优先级最高。

---

## 开发环境

```bash
# 依赖管理
pnpm install                # 安装依赖

# 开发
pnpm dev                    # Plasmo 热重载开发

# 构建
pnpm build                  # 生产构建 → build/chrome-mv3-prod/

# 测试
pnpm test                   # Vitest 单元测试 (61 tests)
node test/ui-blackbox.cjs   # UI 黑盒测试 (需 Playwright)

# 打包
pnpm package                # → dist/tab-manager-v1.0.0.zip

# 加载到 Chrome
chrome://extensions → 开发者模式 → 加载已解压 → 选 build/chrome-mv3-prod/
```

---

## 项目结构

```
tab-manager/
├── .gitignore
├── .npmrc
├── README.md                     # 项目说明
├── PLAN.md                       # 完整产品方案 (v3)
├── TEST.md                       # 测试方案 & 结果
├── CONTEXT.md                    # 本文件 - 项目上下文
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── vitest.config.ts
│
├── assets/
│   └── icon.png                  # 插件图标
│
├── src/
│   ├── background/
│   │   └── index.ts              # Service Worker (215行)
│   ├── lib/
│   │   ├── db.ts                 # IndexedDB (82行)
│   │   ├── rule-engine.ts        # 规则引擎 (103行)
│   │   └── __tests__/
│   │       ├── rule-engine.test.ts       # 50 tests
│   │       └── rules-consistency.test.ts # 11 tests
│   ├── rules/
│   │   └── rules.json            # 328条规则
│   └── sidepanel/
│       ├── index.tsx             # React 入口
│       ├── SidePanel.tsx         # 主面板 (248行)
│       ├── GroupTree.tsx         # 分组树 (110行)
│       └── SearchBar.tsx         # 搜索栏 (55行)
│
├── build/
│   └── chrome-mv3-prod/          # 构建产物 (10 files)
│
├── dist/
│   ├── tab-manager-v1.0.0.zip    # Chrome Web Store 提交包
│   └── tab-manager-v1.0.0.tar.gz
│
└── test/
    ├── ui-blackbox.cjs           # UI 黑盒测试 (Playwright)
    ├── ui-blackbox.mjs
    └── ui-blackbox.spec.ts
```

---

## 关键决策记录

| 决策 | 选择 | 理由 |
|:----|:-----|:------|
| **框架** | Plasmo | 零配置 MV3，内置 React + Tailwind 支持 |
| **搜索** | Fuse.js | 轻量 (12KB)，模糊搜索，无需后端 |
| **存储** | Dexie.js (IndexedDB) | 离线优先，7 天历史，无大小限制 |
| **AI** | ❌ 不做 (MVP) | 规则引擎 328 条已覆盖 95% 场景，AI 增加复杂度和成本 |
| **变现** | 免费 + 可选 API Key | 浏览器插件付费转化率 < 1%，不值得 |
| **E2E 测试** | ❌ 砍掉 | Playwright E2E 维护成本 > 收益 |
| **SW 生命周期测试** | 手动验证 | MV3 SW 休眠特性需真实 Chrome 环境 |
| **分组图标** | Emoji | 无需图片资源，零加载延迟 |

---

## 上架 Chrome Web Store

**待办清单：**

- [ ] 注册 Chrome 开发者（$5 一次性）
- [ ] 准备截图 (1280×800, 至少 1 张)
- [ ] 编写商店描述（中英文）
- [ ] 设置隐私政策（如需）
- [ ] 上传 `dist/tab-manager-v1.0.0.zip`
- [ ] 等待审核 (通常 1-3 天)

**权限说明：**
```json
{
  "permissions": ["storage", "sidePanel", "tabs", "alarms", "contextMenus"],
  "host_permissions": ["<all_urls>"]
}
```
- `storage` / `sidePanel` — 侧栏面板必须
- `tabs` — 读取标签页信息 (标题/URL) 用于规则匹配
- `alarms` — 24h 规则更新定时器
- `contextMenus` — 右键菜单 (锁定/移动分组)
- `<all_urls>` — 在新标签页打开时获取 URL 进行规则匹配

---

## V2 方向 (未来)

- **AI 智能分组** — 用户自带 API Key，对未匹配的标签进行语义分类
- **规则编辑器** — 在侧栏中直接编辑/添加自定义规则
- **分组导出/分享** — 将分组配置导出为 JSON，社区共享
- **标签页同步** — 跨设备同步分组状态（需 Chrome Storage Sync）
- **企业版** — 团队标签管理、共享工作区
