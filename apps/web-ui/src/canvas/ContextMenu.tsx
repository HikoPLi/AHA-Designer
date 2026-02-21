import { useCallback } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { Trash2, Copy } from 'lucide-react';

interface ContextMenuProps {
    id: string;
    top?: number;
    left?: number;
    right?: number;
    bottom?: number;
    onClick: () => void;
}

export default function ContextMenu({ id, top, left, right, bottom, onClick }: ContextMenuProps) {
    const { deleteNode, duplicateNode } = useGraphStore();

    const handleDuplicate = useCallback(() => {
        duplicateNode(id);
        onClick();
    }, [id, duplicateNode, onClick]);

    const handleDelete = useCallback(() => {
        deleteNode(id);
        onClick();
    }, [id, deleteNode, onClick]);

    return (
        <div
            style={{
                top,
                left,
                right,
                bottom,
                position: 'absolute',
                zIndex: 10,
                background: 'var(--bg-panel-solid)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
                borderRadius: '6px',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '120px'
            }}
            className="context-menu"
        >
            <button
                className="btn"
                onClick={handleDuplicate}
                style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
            >
                <Copy size={14} style={{ marginRight: '8px' }} /> Duplicate
            </button>
            <button
                className="btn"
                onClick={handleDelete}
                style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: '#ef4444' }}
            >
                <Trash2 size={14} style={{ marginRight: '8px' }} /> Delete
            </button>
        </div>
    );
}
