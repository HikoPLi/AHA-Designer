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

const nodeTypes = {
  hardware: HardwareNode,
};

export default function CanvasPane() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNode,
    addNode,
  } = useGraphStore();
  const { screenToFlowPosition, fitView } = useReactFlow();
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
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      const label = event.dataTransfer.getData("application/reactflow-label");

      if (typeof type === "undefined" || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: AhaNode = {
        id: uuidv4(),
        type: "hardware",
        position,
        data: { label, category: type, tdp_w: type === "SoC" ? 15 : 2 },
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
    <div
      className="canvas-area"
      onDrop={onDrop}
      onDragOver={onDragOver}
      ref={ref}
    >
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
        fitView
      >
        <Controls />
        <MiniMap
          nodeStrokeColor="#ffffff"
          nodeColor="#16191f"
          maskColor="rgba(0,0,0,0.4)"
        />
        {showGrid && (
          <Background
            color="#2a2e37"
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
                    ? "rgba(255,255,255,0.1)"
                    : "transparent",
              }}
              title="Select Mode"
            >
              <MousePointer2 size={16} />
            </button>
            <button
              className="btn"
              onClick={() => setInteractionMode("pan")}
              style={{
                background:
                  interactionMode === "pan"
                    ? "rgba(255,255,255,0.1)"
                    : "transparent",
              }}
              title="Pan Mode"
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
              title="Toggle Grid"
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
              title="Toggle Snap to Grid"
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
            Hardware Architecture Canvas
          </div>
        </Panel>
        {menu && <ContextMenu onClick={onPaneClick} {...menu} />}
      </ReactFlow>
    </div>
  );
}
