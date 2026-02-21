import { useCallback } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useReactFlow,
    useOnSelectionChange,
    Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import HardwareNode from './nodes/HardwareNode';
import ContextMenu from './ContextMenu';
import { useState, useRef } from 'react';
import { useGraphStore, AhaNode } from '../store/useGraphStore';

const nodeTypes = {
    hardware: HardwareNode,
};

export default function CanvasPane() {
    const { nodes, edges, onNodesChange, onEdgesChange, onConnect, setSelectedNode, addNode } = useGraphStore();
    const { screenToFlowPosition } = useReactFlow();
    const [menu, setMenu] = useState<any>(null);
    const ref = useRef<HTMLDivElement>(null);

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
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('application/reactflow-label');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode: AhaNode = {
                id: uuidv4(),
                type: 'hardware',
                position,
                data: { label, category: type, tdp_w: type === 'SoC' ? 15 : 2 },
            };

            addNode(newNode);
        },
        [screenToFlowPosition, addNode]
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
                right: event.clientX >= pane.width - 200 && pane.width - event.clientX + pane.left,
                bottom: event.clientY >= pane.height - 200 && pane.height - event.clientY + pane.top,
            });
        },
        [setMenu]
    );

    const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

    return (
        <div className="canvas-area" onDrop={onDrop} onDragOver={onDragOver} ref={ref}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={onPaneClick}
                fitView
            >
                <Controls />
                <MiniMap nodeStrokeColor="#ffffff" nodeColor="#16191f" maskColor="rgba(0,0,0,0.4)" />
                <Background color="#2a2e37" gap={16} />
                <Panel position="top-right">
                    <div style={{ background: 'var(--bg-panel-solid)', padding: '8px', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                        Hardware Architecture Canvas
                    </div>
                </Panel>
                {menu && <ContextMenu onClick={onPaneClick} {...menu} />}
            </ReactFlow>
        </div>
    );
}
