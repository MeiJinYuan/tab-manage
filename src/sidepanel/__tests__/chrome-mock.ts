/**
 * Chrome API Mock — 用于 UI 组件测试
 */
import { vi } from "vitest"

export function createChromeMock() {
  return {
    runtime: {
      id: "test-ext-id",
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      sendMessage: vi.fn().mockResolvedValue({}),
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      group: vi.fn().mockResolvedValue(1),
      ungroup: vi.fn().mockResolvedValue(undefined),
      discard: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn(),
      },
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn(),
      },
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn() },
    },
  }
}

// 安装 chrome mock 到 globalThis
export function setupChromeMock() {
  const mock = createChromeMock()
  vi.stubGlobal("chrome", mock)
  return mock
}
