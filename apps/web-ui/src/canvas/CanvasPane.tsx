import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useReactFlow,
  useOnSelectionChange,
  Panel,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { v4 as uuidv4 } from "uuid";
import HardwareNode from "./nodes/HardwareNode";
import ContextMenu from "./ContextMenu";
import { useGraphStore, AhaNode } from "../store/useGraphStore";
import { Grid, Maximize, MousePointer2, Move } from "lucide-react";
import { useI18n } from "../i18n";

const nodeTypes = {
  hardware: HardwareNode,
};

export default function CanvasPane() {
  const { t } = useI18n();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    addNode,
  } = useGraphStore();
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Canvas Settings State
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">(
    "select",
  );

  useOnSelectionChange({
    onChange: ({ nodes }) => {
      if (nodes.length > 0) {
        setSelectedNode(nodes[0].id);
      } else {
        setSelectedNode(null);
      }
    },
  });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const payload = event.dataTransfer.getData("application/aha-node");
      const plainPayload = event.dataTransfer.getData("text/plain");
      const fallbackType = event.dataTransfer.getData("application/reactflow");
      const fallbackLabel = event.dataTransfer.getData(
        "application/reactflow-label",
      );

      let type = fallbackType;
      let label = fallbackLabel;
      let tdp = fallbackType === "SoC" ? 15 : 2;
      let manufacturer: string | undefined;
      let mpn: string | undefined;
      let description: string | undefined;
      let datasheetUrl: string | undefined;
      let buyUrl: string | undefined;
      let stock: number | undefined;

      const parsePayload = (raw: string) => {
        try {
          const parsed = JSON.parse(raw) as {
            ahaDrag?: boolean;
            type?: string;
            label?: string;
            tdp?: number;
            mfg?: string;
            mpn?: string;
            description?: string;
            datasheetUrl?: string;
            buyUrl?: string;
            stock?: number;
          };

          if (!parsed.ahaDrag) {
            return;
          }

          type = parsed.type ?? type;
          label = parsed.label ?? label;
          tdp = typeof parsed.tdp === "number" ? parsed.tdp : tdp;
          manufacturer = parsed.mfg;
          mpn = parsed.mpn;
          description = parsed.description;
          datasheetUrl = parsed.datasheetUrl;
          buyUrl = parsed.buyUrl;
          stock = parsed.stock;
        } catch (error) {
          console.warn("Failed to parse drop payload:", error);
        }
      };

      if (payload) {
        parsePayload(payload);
      } else if (plainPayload) {
        // Safari/WKWebView fallback: custom mime types may be stripped.
        parsePayload(plainPayload);
      }

      if (typeof type === "undefined" || !type) {
        return;
      }
      if (typeof label === "undefined" || !label) {
        label = "New Component";
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: AhaNode = {
        id: uuidv4(),
        type: "hardware",
        position,
        data: {
          label,
          category: type,
          tdp_w: tdp,
          manufacturer,
          mpn,
          description,
          datasheet_url: datasheetUrl,
          buy_url: buyUrl,
          stock,
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: AhaNode) => {
      event.preventDefault();
      const pane = ref.current?.getBoundingClientRect();
      if (!pane) return;

      setMenu({
        id: node.id,
        top: event.clientY < pane.height - 200 && event.clientY - pane.top,
        left: event.clientX < pane.width - 200 && event.clientX - pane.left,
        right:
          event.clientX >= pane.width - 200 &&
          pane.width - event.clientX + pane.left,
        bottom:
          event.clientY >= pane.height - 200 &&
          pane.height - event.clientY + pane.top,
      });
    },
    [setMenu],
  );

  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

  return (
    <div className="canvas-area" ref={ref} onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        panOnDrag={interactionMode === "pan"}
        selectionOnDrag={interactionMode === "select"}
        panOnScroll={true}
        zoomOnScroll={true}
      >
        <Controls />
        <MiniMap
          nodeStrokeColor="var(--minimap-stroke)"
          nodeColor="var(--minimap-node)"
          maskColor="var(--minimap-mask)"
        />
        {showGrid && (
          <Background
            color="var(--grid-color)"
            gap={16}
            variant={BackgroundVariant.Dots}
          />
        )}

        {/* Top Toolbar */}
        <Panel position="top-center" style={{ marginTop: "12px" }}>
          <div
            style={{
              display: "flex",
              gap: "8px",
              background: "var(--bg-panel-solid)",
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <button
              className="btn"
              onClick={() => setInteractionMode("select")}
              style={{
                background:
                  interactionMode === "select"
                    ? "var(--accent-soft)"
                    : "transparent",
              }}
              title={t("canvas.selectMode")}
            >
              <MousePointer2 size={16} />
            </button>
            <button
              className="btn"
              onClick={() => setInteractionMode("pan")}
              style={{
                background:
                  interactionMode === "pan"
                    ? "var(--accent-soft)"
                    : "transparent",
              }}
              title={t("canvas.panMode")}
            >
              <Move size={16} />
            </button>
            <div
              style={{
                width: "1px",
                background: "var(--border-color)",
                margin: "0 4px",
              }}
            />
            <button
              className="btn"
              onClick={() => setShowGrid(!showGrid)}
              style={{
                color: showGrid ? "var(--accent-primary)" : "var(--text-muted)",
              }}
              title={t("canvas.toggleGrid")}
            >
              <Grid size={16} />
            </button>
            <button
              className="btn"
              onClick={() => setSnapToGrid(!snapToGrid)}
              style={{
                color: snapToGrid
                  ? "var(--accent-primary)"
                  : "var(--text-muted)",
              }}
              title={t("canvas.toggleSnap")}
            >
              <Maximize size={16} />
            </button>
          </div>
        </Panel>

        <Panel position="top-right">
          <div
            style={{
              background: "var(--bg-panel-solid)",
              padding: "8px",
              borderRadius: "4px",
              fontSize: "12px",
              border: "1px solid var(--border-color)",
            }}
          >
            {t("canvas.title")}
          </div>
        </Panel>
        {menu && <ContextMenu onClick={onPaneClick} {...menu} />}
      </ReactFlow>
    </div>
  );
}
