# 智能标签管家 — Tab Manager

> 浏览器标签页自动分组管理扩展（Chrome Extension MV3）

## 特性

- **自动分组** — 基于 866 条内置规则引擎（域名 631 + URL 模式 184 + 关键词 51），打开标签页自动归类，覆盖中文/国际主流网站
- **侧栏面板** — Chrome Side Panel，不占用标签栏空间
- **实时搜索** — Fuse.js 模糊搜索，按标题/URL/域名实时过滤
- **建议关闭** — 一键关闭同组重复/冗余标签页
- **一键休眠** — 释放内存，标签页变灰易识别
- **标签历史** — Dexie IndexedDB 持久化，7 天最近关闭可回溯
- **右键菜单** — 标签页右键 → 智能分组 / 移动到此组
- **零依赖** — 全离线可用，零 API 调用，零模型下载
- **规则可贡献** — JSON 格式内置规则，社区可 PR 扩展

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 构建生产版本
pnpm build

# 运行测试
pnpm test

# 打包
pnpm package
```

产物在 `build/chrome-mv3-prod/`，Chrome 加载已解压的扩展指向该目录即可。

## 测试

```bash
# 单元测试（规则引擎 + 规则集校验）
pnpm test          # vitest, 61 个测试

# UI 黑盒测试（需本地 Chrome + Playwright）
npx playwright install chromium
node test/ui-blackbox.cjs
```

## 项目文档

| 文件 | 内容 |
|:----|:------|
| [`PLAN.md`](./PLAN.md) | 完整产品方案 — 定位、功能、技术方案、规则引擎、变现、风险对策 |
| [`TEST.md`](./TEST.md) | 测试方案 & 结果 — 7 层测试架构，64 项测试状态 |
| [`CONTEXT.md`](./CONTEXT.md) | 项目上下文 — 架构决策、开发环境、上架清单、V2 方向 |

## 项目结构

```
src/
├── background/        # Service Worker (生命周期、右键菜单、休眠、记忆分组)
│   └── index.ts
├── lib/
│   ├── db.ts          # Dexie IndexedDB (标签历史)
│   ├── rule-engine.ts # 规则引擎核心
│   └── __tests__/     # 单元测试 (61 tests)
├── rules/
│   └── rules.json     # 328 条内置分组规则, 14 分组
├── sidepanel/
│   ├── index.tsx      # React 入口
│   ├── SidePanel.tsx  # 主面板
│   ├── GroupTree.tsx  # 分组树
│   └── SearchBar.tsx  # 搜索栏
└── ...
```

## 技术栈

- [Plasmo](https://docs.plasmo.com/) — 扩展框架
- React 18 + TypeScript
- [Fuse.js](https://fusejs.io/) — 模糊搜索
- [Dexie.js](https://dexie.org/) — IndexedDB 封装
- Tailwind CSS — 样式
- Vitest — 单元测试

## 许可

MIT
