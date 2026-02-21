import { ReactFlowProvider } from "@xyflow/react";
import CanvasPane from "./canvas/CanvasPane";
import LeftPanel from "./panels/LeftPanel";
import RightPanel from "./panels/RightPanel";
import {
  ActivitySquare,
  Layers,
  Save,
  Undo2,
  Redo2,
  FileDown,
  Trash2,
  FolderOpen,
  SunMedium,
  MoonStar,
  Globe,
} from "lucide-react";
import { useStore } from "zustand";
import { useGraphStore } from "./store/useGraphStore";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import type { Edge } from "@xyflow/react";
import type { AhaNode } from "./store/useGraphStore";
import { useI18n, type Locale } from "./i18n";
import { invoke } from "@tauri-apps/api/core";

const GRAPH_STORAGE_KEY = "aha-designer-graph-v1";
const THEME_STORAGE_KEY = "aha-designer-theme";
const WORKSPACE_STORAGE_KEY = "aha-designer-workspace";

type PersistedGraph = {
  nodes: AhaNode[];
  edges: Edge[];
};

type WorkspaceEnvelope = {
  version: number;
  savedAt: string;
  nodes: AhaNode[];
  edges: Edge[];
};

const safeReadGraph = (): PersistedGraph | null => {
  const raw = localStorage.getItem(GRAPH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedGraph>;
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    };
  } catch (error) {
    console.warn("Failed to restore local graph draft:", error);
    return null;
  }
};

function App() {
  const { t, locale, setLocale } = useI18n();
  const { undo, redo } = useGraphStore.temporal.getState();
  const pastStates = useStore(
    useGraphStore.temporal,
    (state) => state.pastStates,
  );
  const futureStates = useStore(
    useGraphStore.temporal,
    (state) => state.futureStates,
  );
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const setGraph = useGraphStore((state) => state.setGraph);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const deleteNode = useGraphStore((state) => state.deleteNode);
  const duplicateNode = useGraphStore((state) => state.duplicateNode);

  const [workspacePath, setWorkspacePath] = useState<string | null>(
    () => localStorage.getItem(WORKSPACE_STORAGE_KEY) || null,
  );
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isGraphReady, setIsGraphReady] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const persisted = safeReadGraph();
    if (persisted) {
      setGraph(persisted.nodes, persisted.edges);
    }
    setIsGraphReady(true);
  }, [setGraph]);

  useEffect(() => {
    if (!isGraphReady) {
      return;
    }
    const graph: PersistedGraph = { nodes, edges };
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(graph));
  }, [nodes, edges, isGraphReady]);

  const persistNow = () => {
    const graph: PersistedGraph = { nodes, edges };
    localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(graph));
    setSavedAt(new Date().toLocaleTimeString());
  };

  const normalizeLoadedGraph = (payload: unknown): PersistedGraph | null => {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const typedPayload = payload as Partial<WorkspaceEnvelope & PersistedGraph>;
    const loadedNodes = Array.isArray(typedPayload.nodes)
      ? typedPayload.nodes
      : null;
    const loadedEdges = Array.isArray(typedPayload.edges)
      ? typedPayload.edges
      : null;

    if (!loadedNodes || !loadedEdges) {
      return null;
    }
    return {
      nodes: loadedNodes,
      edges: loadedEdges,
    };
  };

  const handleOpenWorkspace = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: t("app.openWorkspaceDialog"),
        filters: [{ name: "AHA Workspace", extensions: ["json"] }],
      });
      if (selected) {
        const selectedPath = selected as string;
        const content = await invoke<string>("load_workspace_file", {
          path: selectedPath,
        });
        const parsed = JSON.parse(content);
        const loadedGraph = normalizeLoadedGraph(parsed);
        if (!loadedGraph) {
          throw new Error("Invalid workspace file schema.");
        }
        setGraph(loadedGraph.nodes, loadedGraph.edges);
        setWorkspacePath(selectedPath);
        localStorage.setItem(WORKSPACE_STORAGE_KEY, selectedPath);
        localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(loadedGraph));
        setSavedAt(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed to open workspace:", err);
      window.alert(`Failed to load workspace: ${String(err)}`);
    }
  };

  const handleExportBOM = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Designator,Category,TDP (W)\n";
    nodes.forEach((node) => {
      const row = [
        node.data.label,
        node.data.category,
        node.data.tdp_w || "N/A",
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "aha_bom_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveWorkspace = async () => {
    try {
      let targetPath = workspacePath;
      if (!targetPath) {
        const selected = await saveDialog({
          title: t("app.save"),
          defaultPath: "aha-workspace.aha.json",
          filters: [{ name: "AHA Workspace", extensions: ["json"] }],
        });
        if (!selected) {
          persistNow();
          return;
        }
        targetPath = selected;
      }

      const workspaceEnvelope: WorkspaceEnvelope = {
        version: 1,
        savedAt: new Date().toISOString(),
        nodes,
        edges,
      };
      const resolvedPath = await invoke<string>("save_workspace_file", {
        path: targetPath,
        graphJson: JSON.stringify(workspaceEnvelope, null, 2),
      });
      setWorkspacePath(resolvedPath);
      localStorage.setItem(WORKSPACE_STORAGE_KEY, resolvedPath);
      persistNow();
    } catch (err) {
      console.error("Failed to save workspace:", err);
      window.alert(`Failed to save workspace: ${String(err)}`);
    }
  };

  const handleClearCanvas = () => {
    if (window.confirm(t("app.clearCanvasConfirm"))) {
      setGraph([], []);
    }
  };

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) {
        return false;
      }
      const tagName = element.tagName;
      return (
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        element.isContentEditable
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const commandKey = event.metaKey || event.ctrlKey;

      if (commandKey && key === "s") {
        event.preventDefault();
        void handleSaveWorkspace();
        return;
      }

      if (commandKey && key === "d" && selectedNodeId && !isTypingTarget(event.target)) {
        event.preventDefault();
        duplicateNode(selectedNodeId);
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedNodeId &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        deleteNode(selectedNodeId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, deleteNode, duplicateNode, nodes, edges, workspacePath]);

  return (
    <div className="app-container">
      {/* Top Navigation Banner */}
      <header className="top-nav">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ActivitySquare size={24} color="var(--accent-primary)" />
          <h1
            style={{
              fontSize: "16px",
              fontWeight: 600,
              letterSpacing: "0.5px",
            }}
          >
            AHA Designer{" "}
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: "12px",
                fontWeight: 400,
              }}
            >
              v0.1.0
            </span>
          </h1>

          <div
            style={{
              width: "1px",
              height: "24px",
              background: "var(--border-color)",
              margin: "0 8px",
            }}
          ></div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
              transition: "background 0.2s",
            }}
            onClick={handleOpenWorkspace}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = "var(--surface-soft)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            title={t("app.loadWorkspace")}
          >
            {workspacePath ? (
              <>
                <FolderOpen size={14} /> {workspacePath.split(/[/\\]/).pop()}
              </>
            ) : (
              <>
                <FolderOpen size={14} /> {t("app.loadWorkspace")}
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              className="btn"
              style={{ padding: "6px" }}
              title={`${t("app.theme")}: ${
                theme === "dark" ? t("app.themeDark") : t("app.themeLight")
              }`}
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? <MoonStar size={16} /> : <SunMedium size={16} />}
            </button>
            <label className="toolbar-label">
              <Globe size={14} />
              <select
                className="toolbar-select"
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                aria-label={t("app.language")}
              >
                <option value="en">{t("language.en")}</option>
                <option value="zh-CN">{t("language.zh-CN")}</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: "4px", marginRight: "8px" }}>
            <button
              className="btn"
              onClick={() => undo()}
              disabled={pastStates.length === 0}
              title={t("app.undo")}
              style={{ padding: "6px" }}
            >
              <Undo2
                size={16}
                color={
                  pastStates.length > 0
                    ? "var(--text-primary)"
                    : "var(--text-muted)"
                }
              />
            </button>
            <button
              className="btn"
              onClick={() => redo()}
              disabled={futureStates.length === 0}
              title={t("app.redo")}
              style={{ padding: "6px" }}
            >
              <Redo2
                size={16}
                color={
                  futureStates.length > 0
                    ? "var(--text-primary)"
                    : "var(--text-muted)"
                }
              />
            </button>
            <button
              className="btn"
              onClick={handleClearCanvas}
              title={t("app.clearCanvas")}
              style={{ padding: "6px" }}
            >
              <Trash2 size={16} color="var(--text-muted)" />
            </button>
          </div>
          <button className="btn" onClick={handleExportBOM}>
            <FileDown size={14} /> {t("app.exportBOM")}
          </button>
          <button className="btn" onClick={handleSaveWorkspace}>
            <Save size={14} /> {t("app.save")}
          </button>
          <button
            className="btn primary"
            onClick={() => console.log("Create Change Request")}
          >
            <Layers size={14} /> {t("app.changeRequest")}
          </button>
        </div>
      </header>

      {/* Main Workspace containing the panes */}
      <main className="main-workspace">
        <ReactFlowProvider>
          <LeftPanel />
          <CanvasPane />
          <RightPanel />
        </ReactFlowProvider>
      </main>

      {/* Bottom Status Bar */}
      <footer
        style={{
          height: "24px",
          background: "var(--bg-panel-solid)",
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          fontSize: "11px",
          color: "var(--text-muted)",
          justifyContent: "space-between",
        }}
      >
        <div>{t("app.footerStatus")}</div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ opacity: 0.7 }}>
            {savedAt ? t("app.savedAt", { time: savedAt }) : t("app.localDraft")}
          </div>
          {workspacePath && <div style={{ opacity: 0.7 }}>{workspacePath}</div>}
        </div>
      </footer>
    </div>
  );
}

export default App;
