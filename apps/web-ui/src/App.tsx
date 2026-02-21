import { ReactFlowProvider } from "@xyflow/react";
import CanvasPane from "./canvas/CanvasPane";
import LeftPanel from "./panels/LeftPanel";
import RightPanel from "./panels/RightPanel";
import {
  Layers,
  ActivitySquare,
  Save,
  GitCommitHorizontal,
  Undo2,
  Redo2,
  FileDown,
  Trash2,
} from "lucide-react";
import { useStore } from "zustand";
import { useGraphStore } from "./store/useGraphStore";

function App() {
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
  const setGraph = useGraphStore((state) => state.setGraph);

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

  const handleClearCanvas = () => {
    if (window.confirm("Are you sure you want to clear the entire canvas?")) {
      setGraph([], []);
    }
  };

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
            }}
          >
            <GitCommitHorizontal size={14} /> feature/demo-a-jetson
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "4px", marginRight: "8px" }}>
            <button
              className="btn"
              onClick={() => undo()}
              disabled={pastStates.length === 0}
              title="Undo (Ctrl+Z)"
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
              title="Redo (Ctrl+Y)"
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
              title="Clear Canvas"
              style={{ padding: "6px" }}
            >
              <Trash2 size={16} color="var(--text-muted)" />
            </button>
          </div>
          <button className="btn" onClick={handleExportBOM}>
            <FileDown size={14} /> Export BOM
          </button>
          <button className="btn">
            <Save size={14} /> Save
          </button>
          <button
            className="btn primary"
            onClick={() => console.log("Create Change Request")}
          >
            <Layers size={14} /> Change Request
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
        }}
      >
        Libraries Synced · Local Mode · Tauri Connected
      </footer>
    </div>
  );
}

export default App;
