import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { HardDrive, Cpu, Radio, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Map categories to icons
const CategoryIcon = ({ category, size = 16 }: { category: string; size?: number }) => {
    switch (category) {
        case 'SoC':
        case 'MCU':
            return <Cpu size={size} />;
        case 'Sensor':
            return <Radio size={size} />;
        case 'PMIC':
            return <Zap size={size} />;
        default:
            return <HardDrive size={size} />;
    }
};

export default memo(function HardwareNode({ data, selected }: NodeProps) {
    // We can show badges based on arbitrary data fields passed to the node 
    const hasError = data.error === true;
    const isHealthy = data.healthy === true;

    return (
        <div style={{
            boxShadow: selected ? '0 0 0 2px var(--accent-primary)' : '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
            background: 'var(--bg-panel-solid)',
            border: `1px solid ${hasError ? '#ef4444' : selected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            padding: '0',
            minWidth: '150px',
            color: 'var(--text-primary)',
            fontFamily: 'system-ui, sans-serif',
            position: 'relative'
        }}>
            {/* Header */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderBottom: '1px solid var(--border-color)',
                padding: '8px 12px',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>
                        <CategoryIcon category={String(data.category)} />
                    </span>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{String(data.label)}</div>
                </div>

                {/* Validation Badges */}
                {hasError && <AlertTriangle size={14} color="#ef4444" />}
                {isHealthy && !hasError && <CheckCircle2 size={14} color="#10b981" />}
            </div>

            {/* Body */}
            <div style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Class: </span>{String(data.category)}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Power: </span>{data.tdp_w ? `${data.tdp_w} W` : 'N/A'}</div>
            </div>

            {/* Ports / Handles */}
            {/* Left Data Ports */}
            <Handle
                type="target"
                position={Position.Left}
                id="data-in"
                style={{ background: '#3b82f6', width: '8px', height: '8px', border: '1px solid #16191f' }}
            />

            {/* Right Data Ports */}
            <Handle
                type="source"
                position={Position.Right}
                id="data-out"
                style={{ background: '#3b82f6', width: '8px', height: '8px', border: '1px solid #16191f' }}
            />

            {/* Top Power Input */}
            <Handle
                type="target"
                position={Position.Top}
                id="pwr-in"
                style={{ background: '#ef4444', width: '8px', height: '8px', border: '1px solid #16191f' }}
            />

            {/* Bottom Power Output (for PMICs etc) */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="pwr-out"
                style={{ background: '#ef4444', width: '8px', height: '8px', border: '1px solid #16191f', borderRadius: '4px' }}
            />
        </div>
    );
});
