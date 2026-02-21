import { Cpu, Zap, Activity, Radio, HardDrive, Search, Layers } from 'lucide-react';
import { useState } from 'react';

// Real-world advanced EDA component library (Mock DB)
const LIBRARY_ITEM = [
    { type: 'SoC', label: 'Jetson Orin NX (16GB)', mfg: 'NVIDIA', icon: <Cpu strokeWidth={1.5} />, tdp: 15, package: '260-pin SO-DIMM' },
    { type: 'SoC', label: 'Jetson AGX Orin', mfg: 'NVIDIA', icon: <Cpu strokeWidth={1.5} />, tdp: 60, package: 'Custom Module' },
    { type: 'SoC', label: 'Snapdragon 8 Gen 3', mfg: 'Qualcomm', icon: <Cpu strokeWidth={1.5} />, tdp: 12, package: 'FCBGA' },
    { type: 'MCU', label: 'STM32G474VET6', mfg: 'STMicroelectronics', icon: <Cpu strokeWidth={1.5} />, tdp: 0.5, package: 'LQFP-100' },
    { type: 'MCU', label: 'RP2040', mfg: 'Raspberry Pi', icon: <Cpu strokeWidth={1.5} />, tdp: 0.3, package: 'QFN-56' },
    { type: 'MCU', label: 'ESP32-S3-WROOM-1', mfg: 'Espressif', icon: <Radio strokeWidth={1.5} />, tdp: 1.2, package: 'Module' },
    { type: 'Sensor', label: 'IMX219 8MP Camera', mfg: 'Sony', icon: <Activity strokeWidth={1.5} />, tdp: 1.5, package: 'MIPI CSI-2 Module' },
    { type: 'Sensor', label: 'IMX477 12MP Camera', mfg: 'Sony', icon: <Activity strokeWidth={1.5} />, tdp: 2.1, package: 'MIPI CSI-2 Module' },
    { type: 'Sensor', label: 'BME680 Env', mfg: 'Bosch', icon: <Activity strokeWidth={1.5} />, tdp: 0.05, package: 'LGA-8' },
    { type: 'PMIC', label: 'TPS65219', mfg: 'Texas Instruments', icon: <Zap strokeWidth={1.5} />, tdp: 0.8, package: 'VQFN-32' },
    { type: 'PMIC', label: 'MAX77620', mfg: 'Maxim', icon: <Zap strokeWidth={1.5} />, tdp: 1.0, package: 'WLP-81' },
    { type: 'Memory', label: '8GB LPDDR5', mfg: 'Micron', icon: <Layers strokeWidth={1.5} />, tdp: 2.5, package: 'BGA-200' },
    { type: 'Memory', label: '16GB DDR4', mfg: 'Samsung', icon: <Layers strokeWidth={1.5} />, tdp: 3.5, package: 'FBGA' },
    { type: 'Storage', label: '980 PRO 1TB NVMe', mfg: 'Samsung', icon: <HardDrive strokeWidth={1.5} />, tdp: 6.5, package: 'M.2 2280' },
    { type: 'Storage', label: 'EMMC 64GB', mfg: 'SanDisk', icon: <HardDrive strokeWidth={1.5} />, tdp: 1.5, package: 'BGA-153' },
];

export default function LeftPanel() {
    const [searchQuery, setSearchQuery] = useState('');

    const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow-label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    const filteredLibs = LIBRARY_ITEM.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.mfg.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.type.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <aside className="side-panel">
            <div className="panel-header" style={{ paddingBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Layers size={18} color="var(--accent-primary)" /> <span style={{ fontWeight: 600 }}>Library Explorer</span>
                </div>

                {/* Advanced Search Bar */}
                <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search part, type or mfg..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.5)',
                            border: '1px solid var(--border-color)',
                            color: '#fff',
                            padding: '6px 10px 6px 30px',
                            borderRadius: '6px',
                            fontSize: '12px'
                        }}
                    />
                </div>
            </div>

            <div className="panel-content" style={{ padding: '0 12px 12px 12px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', textAlign: 'center' }}>
                    Drag & Drop into workspace to instantiate
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredLibs.map((item, idx) => (
                        <div
                            key={idx}
                            className="lib-item"
                            draggable
                            onDragStart={(e) => onDragStart(e, item.type, item.label)}
                            style={{
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '8px',
                                padding: '12px',
                                cursor: 'grab',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                gap: '12px',
                                alignItems: 'center'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                        >
                            {/* Visual Asset Container */}
                            <div style={{
                                width: '40px', height: '40px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <span style={{ color: 'var(--accent-primary)' }}>{item.icon}</span>
                            </div>

                            {/* Details Container */}
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, color: '#f8fafc' }} title={item.label}>
                                        {item.label}
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', fontSize: '10px' }}>
                                    <span style={{ color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                                        {item.mfg}
                                    </span>
                                    <span style={{ color: '#9ca3af', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {item.type}
                                    </span>
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                    <span>TDP: <strong style={{ color: '#e2e8f0' }}>{item.tdp}W</strong></span>
                                    <span>Pkg: {item.package}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredLibs.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            No components found for "{searchQuery}".<br />
                            <span style={{ color: 'var(--accent-primary)', cursor: 'pointer' }}>Ask AI to generate one?</span>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
