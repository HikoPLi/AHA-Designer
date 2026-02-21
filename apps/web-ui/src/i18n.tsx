import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "zh-CN";

const STORAGE_KEY = "aha-designer-locale";

const messages: Record<Locale, Record<string, string>> = {
  en: {
    "app.openWorkspaceDialog": "Open AHA Workspace",
    "app.openWorkspace": "Open Workspace...",
    "app.loadWorkspace": "Load Workspace",
    "app.workspaceLoaded": "Workspace loaded",
    "app.undo": "Undo (Ctrl+Z)",
    "app.redo": "Redo (Ctrl+Y)",
    "app.clearCanvas": "Clear Canvas",
    "app.clearCanvasConfirm": "Are you sure you want to clear the entire canvas?",
    "app.exportBOM": "Export BOM",
    "app.save": "Save",
    "app.savedAt": "Saved at {time}",
    "app.changeRequest": "Change Request",
    "app.theme": "Theme",
    "app.language": "Language",
    "app.themeDark": "Dark",
    "app.themeLight": "Light",
    "app.footerStatus": "Libraries Synced · Local Mode · Tauri Connected",
    "app.localDraft": "Local draft auto-saved",
    "language.en": "English",
    "language.zh-CN": "简体中文",

    "left.libraryExplorer": "Library Explorer",
    "left.tabLibrary": "Library",
    "left.tabLive": "Live API",
    "left.searchPlaceholder": "Search part, type or mfg...",
    "left.dragHint": "Drag & Drop into workspace to instantiate",
    "left.tdp": "TDP",
    "left.pkg": "Pkg",
    "left.noComponent": "No components found for \"{query}\".",
    "left.askAi": "Ask AI to generate one?",
    "left.liveTitle": "Live Component Search (TrustedParts)",
    "left.liveCompanyId": "Company ID",
    "left.liveApiKey": "API Key",
    "left.liveQueryPlaceholder": "Search MPN or keyword...",
    "left.liveSearch": "Search Live",
    "left.liveSearching": "Searching trusted inventory...",
    "left.liveNoResult": "No live parts found for this query.",
    "left.liveAuthHint": "Enter TrustedParts Company ID and API Key.",
    "left.liveStock": "Stock",
    "left.livePrice": "Price",
    "left.liveOffers": "offers",
    "left.liveExactMatch": "Exact match",
    "left.liveInStockOnly": "In-stock only",

    "canvas.selectMode": "Select Mode",
    "canvas.panMode": "Pan Mode",
    "canvas.toggleGrid": "Toggle Grid",
    "canvas.toggleSnap": "Toggle Snap to Grid",
    "canvas.title": "Hardware Architecture Canvas",

    "menu.duplicate": "Duplicate",
    "menu.delete": "Delete",

    "right.tab.properties": "Properties",
    "right.tab.ai": "Copilot",
    "right.tab.git": "Git",
    "right.selectNode": "Select a node on the canvas to edit its properties.",
    "right.systemOverview": "System Overview",
    "right.totalNodes": "Total Nodes",
    "right.totalPower": "Total Power",
    "right.avgPower": "Avg Power/Node",
    "right.hotspots": "High-Power Nodes",
    "right.energyDistribution": "Energy Distribution",
    "right.topConsumers": "Top Power Consumers",
    "right.emptyPowerData": "No component power data available yet.",
    "right.validationHealthy": "Validation ready",
    "right.validationIssues": "Validation has issues",
    "right.runValidation": "Run Validation Loop",
    "right.status": "Status",
    "right.componentInstance": "Component Instance",
    "right.designator": "Designator / Label",
    "right.category": "Category",
    "right.manufacturer": "Manufacturer",
    "right.mpn": "MPN",
    "right.openDatasheet": "Open Datasheet",
    "right.maxTdp": "Max TDP (Watts)",
    "right.aiProvider": "AI Provider",
    "right.baseUrl": "Base URL",
    "right.model": "Model",
    "right.loading": "Loading...",
    "right.apiKey": "API Key",
    "right.optional": "Optional",
    "right.notRequiredLocal": "Not required for local",
    "right.aiDesc":
      "Describe your hardware requirements here. The AI will synthesize a draft architecture layout.",
    "right.aiPlaceholder": "I need an Edge AI grading system...",
    "right.send": "Send",
    "right.run": "Run",
    "right.aiSynthesizing": "AI is synthesizing architecture...",
    "right.aiMissing": "Please check your API Key and enter a prompt.",
    "right.gitIntegration": "Git Integration",
    "right.gitStatus": "Status",
    "right.gitAddAll": "Add All",
    "right.gitPull": "Pull",
    "right.gitPush": "Push",
    "right.executeCommand": "Execute Command",
    "right.output": "Output",
    "right.executing": "Executing...",
    "right.noOutput": "No output yet. Run a command to see results.",
    "right.commandExecuted": "Command executed successfully (no output).",
  },
  "zh-CN": {
    "app.openWorkspaceDialog": "打开 AHA 工作区",
    "app.openWorkspace": "打开工作区...",
    "app.loadWorkspace": "加载工作区",
    "app.workspaceLoaded": "工作区已加载",
    "app.undo": "撤销 (Ctrl+Z)",
    "app.redo": "重做 (Ctrl+Y)",
    "app.clearCanvas": "清空画布",
    "app.clearCanvasConfirm": "确认清空整个画布吗？",
    "app.exportBOM": "导出 BOM",
    "app.save": "保存",
    "app.savedAt": "已保存于 {time}",
    "app.changeRequest": "创建变更请求",
    "app.theme": "主题",
    "app.language": "语言",
    "app.themeDark": "夜间",
    "app.themeLight": "白天",
    "app.footerStatus": "元件库已同步 · 本地模式 · Tauri 已连接",
    "app.localDraft": "本地草稿已自动保存",
    "language.en": "English",
    "language.zh-CN": "简体中文",

    "left.libraryExplorer": "元件库浏览",
    "left.tabLibrary": "本地库",
    "left.tabLive": "实时 API",
    "left.searchPlaceholder": "搜索器件、类型或厂商...",
    "left.dragHint": "拖拽到工作区以实例化节点",
    "left.tdp": "功耗",
    "left.pkg": "封装",
    "left.noComponent": "未找到与“{query}”匹配的元件。",
    "left.askAi": "让 AI 生成一个？",
    "left.liveTitle": "实时元件检索（TrustedParts）",
    "left.liveCompanyId": "Company ID",
    "left.liveApiKey": "API Key",
    "left.liveQueryPlaceholder": "输入型号或关键词检索...",
    "left.liveSearch": "实时检索",
    "left.liveSearching": "正在检索真实库存...",
    "left.liveNoResult": "未检索到匹配的实时元件。",
    "left.liveAuthHint": "请先填写 TrustedParts 的 Company ID 与 API Key。",
    "left.liveStock": "库存",
    "left.livePrice": "价格",
    "left.liveOffers": "个报价",
    "left.liveExactMatch": "精确匹配",
    "left.liveInStockOnly": "仅看有库存",

    "canvas.selectMode": "选择模式",
    "canvas.panMode": "平移模式",
    "canvas.toggleGrid": "显示/隐藏网格",
    "canvas.toggleSnap": "吸附网格开关",
    "canvas.title": "硬件架构画布",

    "menu.duplicate": "复制",
    "menu.delete": "删除",

    "right.tab.properties": "属性",
    "right.tab.ai": "Copilot",
    "right.tab.git": "Git",
    "right.selectNode": "在画布中选中一个节点以编辑其属性。",
    "right.systemOverview": "系统总览",
    "right.totalNodes": "节点总数",
    "right.totalPower": "总功耗",
    "right.avgPower": "平均单节点功耗",
    "right.hotspots": "高功耗节点",
    "right.energyDistribution": "功耗分布",
    "right.topConsumers": "高功耗组件 Top",
    "right.emptyPowerData": "当前暂无可用的功耗数据。",
    "right.validationHealthy": "可执行校验",
    "right.validationIssues": "校验存在问题",
    "right.runValidation": "运行校验循环",
    "right.status": "状态",
    "right.componentInstance": "组件实例",
    "right.designator": "标识 / 标签",
    "right.category": "类别",
    "right.manufacturer": "厂商",
    "right.mpn": "型号",
    "right.openDatasheet": "打开 Datasheet",
    "right.maxTdp": "最大 TDP (瓦)",
    "right.aiProvider": "AI 服务商",
    "right.baseUrl": "基础 URL",
    "right.model": "模型",
    "right.loading": "加载中...",
    "right.apiKey": "API Key",
    "right.optional": "可选",
    "right.notRequiredLocal": "本地模式无需填写",
    "right.aiDesc": "描述你的硬件需求，AI 将生成一份架构草图。",
    "right.aiPlaceholder": "我需要一个边缘 AI 质检系统...",
    "right.send": "发送",
    "right.run": "运行",
    "right.aiSynthesizing": "AI 正在合成架构...",
    "right.aiMissing": "请检查 API Key 并输入需求描述。",
    "right.gitIntegration": "Git 集成",
    "right.gitStatus": "状态",
    "right.gitAddAll": "全部暂存",
    "right.gitPull": "拉取",
    "right.gitPush": "推送",
    "right.executeCommand": "执行命令",
    "right.output": "输出",
    "right.executing": "执行中...",
    "right.noOutput": "暂无输出，执行命令后显示结果。",
    "right.commandExecuted": "命令执行成功（无输出）。",
  },
};

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const getDefaultLocale = (): Locale => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh-CN") {
    return stored;
  }
  const browser = navigator.language.toLowerCase();
  return browser.startsWith("zh") ? "zh-CN" : "en";
};

const withParams = (template: string, params?: Record<string, string | number>) => {
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce((output, [key, value]) => {
    return output.split(`{${key}}`).join(String(value));
  }, template);
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getDefaultLocale());

  const setLocale = (next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    const template = messages[locale][key] ?? messages.en[key] ?? key;
    return withParams(template, params);
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
