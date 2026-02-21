import { create } from 'zustand';
import { temporal } from 'zundo';
import { Node, Edge, addEdge, Connection, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';

export interface ComponentData {
    label: string;
    category: string;
    tdp_w?: number;
    [key: string]: any;
}

export type AhaNode = Node<ComponentData>;

interface GraphState {
    nodes: AhaNode[];
    edges: Edge[];
    selectedNodeId: string | null;
    onNodesChange: (changes: NodeChange<AhaNode>[]) => void;
    onEdgesChange: (changes: EdgeChange[]) => void;
    onConnect: (connection: Connection) => void;
    addNode: (node: AhaNode) => void;
    setSelectedNode: (id: string | null) => void;
    updateNodeData: (id: string, key: string, value: any) => void;
    setGraph: (nodes: AhaNode[], edges: Edge[]) => void;
    deleteNode: (id: string) => void;
    duplicateNode: (id: string) => void;
}

export const useGraphStore = create<GraphState>()(temporal((set, get) => ({
    nodes: [],
    edges: [],
    selectedNodeId: null,

    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes) as AhaNode[],
        });
    },

    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges),
        });
    },

    onConnect: (connection) => {
        set({
            edges: addEdge({ ...connection, type: 'smoothstep', animated: true }, get().edges),
        });
    },

    addNode: (node) => {
        set({
            nodes: [...get().nodes, node]
        });
    },

    setSelectedNode: (id) => {
        set({ selectedNodeId: id });
    },

    updateNodeData: (id, key, value) => {
        set({
            nodes: get().nodes.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            [key]: value
                        }
                    };
                }
                return node;
            })
        });
    },

    setGraph: (nodes, edges) => {
        set({ nodes, edges, selectedNodeId: null });
    },

    deleteNode: (id) => {
        set({
            nodes: get().nodes.filter((n) => n.id !== id),
            edges: get().edges.filter((e) => e.source !== id && e.target !== id),
            selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId
        });
    },

    duplicateNode: (id) => {
        const node = get().nodes.find((n) => n.id === id);
        if (node) {
            const newNode = {
                ...node,
                id: crypto.randomUUID(),
                position: { x: node.position.x + 50, y: node.position.y + 50 },
                selected: false
            };
            set({ nodes: [...get().nodes, newNode] });
        }
    }
})));
