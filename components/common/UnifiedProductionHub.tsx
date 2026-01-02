import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageSquare,
    Send,
    X,
    ChevronUp,
    ChevronDown,
    Command,
    Play,
    Pause,
    Trash2,
    RotateCcw,
    Zap,
    Info,
    AlertCircle,
    CheckCircle2,
    Settings,
    User,
    Film
} from 'lucide-react';
import { AgentStatus, ProductionLogEntry } from '../../types';
import { DirectorPreset, DIRECTOR_PRESETS } from '../../constants/directors';

interface UnifiedProductionHubProps {
    agents: {
        director: { status: AgentStatus; message?: string; currentStage?: string };
        dop: { status: AgentStatus; message?: string; currentStage?: string };
    };
    logs: ProductionLogEntry[];
    onSendCommand: (command: string) => void;
    onAddUserLog?: (message: string) => void;
    onClearChat?: () => void;
    onToggleAgentVisibility?: () => void;
    // Quick Director
    activeDirectorId?: string;
    onDirectorChange?: (directorId: string) => void;
}



const UnifiedProductionHub: React.FC<UnifiedProductionHubProps> = ({
    agents,
    logs,
    onSendCommand,
    onAddUserLog,
    onClearChat,
    onToggleAgentVisibility,
    activeDirectorId,
    onDirectorChange
}) => {


    const [isExpanded, setIsExpanded] = useState(false);
    const [command, setCommand] = useState('');
    const [showDirectorPicker, setShowDirectorPicker] = useState(false);
    const [position, setPosition] = useState(() => {
        const saved = localStorage.getItem('unified_hub_position');
        return saved ? JSON.parse(saved) : { x: window.innerWidth - 380, y: window.innerHeight - 100 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [snapEdge, setSnapEdge] = useState<'left' | 'right' | null>(null);

    const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, isExpanded]);

    // Persistent Position
    useEffect(() => {
        localStorage.setItem('unified_hub_position', JSON.stringify(position));
    }, [position]);

    // Auto-reposition when expanding if too close to edge
    useEffect(() => {
        if (isExpanded) {
            const hubWidth = 360;
            const hubHeight = 500;
            const padding = 20;
            let newX = position.x;
            let newY = position.y;

            // Check right edge
            if (position.x + hubWidth > window.innerWidth - padding) {
                newX = window.innerWidth - hubWidth - padding;
            }
            // Check bottom edge
            if (position.y + hubHeight > window.innerHeight - padding) {
                newY = window.innerHeight - hubHeight - padding;
            }

            if (newX !== position.x || newY !== position.y) {
                setPosition({ x: Math.max(padding, newX), y: Math.max(padding, newY) });
            }
        }
    }, [isExpanded]);


    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;

        setIsDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: position.x,
            initialY: position.y
        };

        e.preventDefault();
    }, [position]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragRef.current) return;

            const deltaX = e.clientX - dragRef.current.startX;
            const deltaY = e.clientY - dragRef.current.startY;

            let newX = dragRef.current.initialX + deltaX;
            let newY = dragRef.current.initialY + deltaY;

            // Constraints
            const padding = 20;
            const hubWidth = isExpanded ? 360 : 200;
            const hubHeight = isExpanded ? 500 : 70;

            newX = Math.max(padding, Math.min(window.innerWidth - hubWidth - padding, newX));
            newY = Math.max(padding, Math.min(window.innerHeight - hubHeight - padding, newY));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                // Snap to edges
                const hubWidth = isExpanded ? 360 : 200;
                const centerX = position.x + hubWidth / 2;
                if (centerX < window.innerWidth / 2) {
                    setSnapEdge('left');
                    setPosition(prev => ({ ...prev, x: 20 }));
                } else {
                    setSnapEdge('right');
                    setPosition(prev => ({ ...prev, x: window.innerWidth - hubWidth - 20 }));
                }
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isExpanded, position]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (command.trim()) {
            // Log user message first
            if (onAddUserLog) {
                onAddUserLog(command);
            }
            onSendCommand(command);
            setCommand('');
        }
    };


    const getStatusColor = (status: AgentStatus) => {
        switch (status) {
            case 'thinking': return 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]';
            case 'speaking': return 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]';
            case 'success': return 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
            case 'error': return 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]';
            default: return 'bg-slate-400 opacity-50';
        }
    };

    return (
        <div
            className={`fixed z-[9999] transition-all duration-300 ease-out ${isDragging ? 'scale-[1.02] cursor-grabbing' : 'cursor-grab'}`}
            style={{
                left: position.x,
                top: position.y,
                width: isExpanded ? '360px' : '220px'
            }}
            onMouseDown={handleMouseDown}
        >

            <div className={`relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${(agents.director.status === 'thinking' || agents.dop.status === 'thinking')
                ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)]'
                : 'border-white/20 shadow-2xl'
                } bg-slate-900/80 backdrop-blur-xl ${isExpanded ? 'h-[500px]' : 'h-[72px]'} ${(!isExpanded && (agents.director.status === 'thinking' || agents.dop.status === 'thinking')) ? 'animate-pulse' : ''
                }`}>


                {/* Hub Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        {/* Director Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-white/20 shadow-lg">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${getStatusColor(agents.director.status)} transition-all duration-300 ${agents.director.status === 'thinking' ? 'animate-pulse' : ''}`} />
                        </div>


                        {/* Agent-to-Agent Synergy Glow (Horizontal bridge) */}
                        <div className="relative w-8 flex items-center justify-center">
                            <div className={`absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/40 to-cyan-500/20 blur-md transition-opacity duration-700 ${agents.director.status === 'thinking' || agents.dop.status === 'thinking' ? 'opacity-100 scale-x-125' : 'opacity-0 scale-x-75'}`} />
                            <div className={`w-full h-[1px] bg-gradient-to-r from-purple-500/50 via-white/40 to-blue-500/50 rounded-full transition-all duration-500 ${agents.director.status === 'thinking' || agents.dop.status === 'thinking' ? 'opacity-100' : 'opacity-10'}`} />
                        </div>


                        {/* DOP Avatar */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center border border-white/20 shadow-lg">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${getStatusColor(agents.dop.status)} transition-all duration-300 ${agents.dop.status === 'thinking' ? 'animate-pulse' : ''}`} />
                        </div>
                    </div>

                    <div className="flex items-center gap-1 no-drag">
                        {/* Quick Director Picker */}
                        {onDirectorChange && (
                            <>
                                <button
                                    onClick={() => setShowDirectorPicker(!showDirectorPicker)}
                                    aria-label="Change Director"
                                    title="Đổi Director nhanh"
                                    className="p-1.5 rounded-lg hover:bg-amber-500/20 transition-colors text-slate-400 hover:text-amber-400 flex items-center gap-1"
                                >
                                    <Film className="w-4 h-4" />
                                </button>

                                {/* Director Dropdown (Portal-like positioning) */}
                                {showDirectorPicker && (
                                    <>
                                        {/* Backdrop to close on click outside */}
                                        <div
                                            className="fixed inset-0 z-[9998]"
                                            onClick={() => setShowDirectorPicker(false)}
                                        />
                                        <div className="fixed z-[9999] w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                                            style={{
                                                top: position.y + 60,
                                                left: Math.min(position.x, window.innerWidth - 240)
                                            }}
                                        >
                                            <div className="px-3 py-2 border-b border-white/10 bg-amber-500/10">
                                                <span className="text-xs font-bold text-amber-400 uppercase">🎬 Quick Director</span>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto py-1">
                                                {Object.entries(DIRECTOR_PRESETS).map(([category, directors]) => (
                                                    <div key={category}>
                                                        <div className="text-[9px] text-slate-500 uppercase tracking-wider px-3 py-1.5 bg-white/5">{category}</div>
                                                        {directors.map(d => (
                                                            <button
                                                                key={d.id}
                                                                onClick={() => {
                                                                    onDirectorChange(d.id);
                                                                    setShowDirectorPicker(false);
                                                                }}
                                                                className={`w-full text-left px-3 py-2 text-xs transition-colors ${d.id === activeDirectorId
                                                                    ? 'bg-amber-500/20 text-amber-300 font-medium'
                                                                    : 'hover:bg-white/5 text-slate-300'
                                                                    }`}
                                                            >
                                                                {d.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {/* Clear Chat Button */}
                        {onClearChat && logs.length > 0 && (
                            <button
                                onClick={onClearChat}
                                aria-label="Clear Chat"
                                title="Xóa lịch sử chat"
                                className="p-1.5 rounded-lg hover:bg-rose-500/20 transition-colors text-slate-500 hover:text-rose-400"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            aria-label="Expand Hub"
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                        >

                            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                        </button>
                    </div>

                </div>

                {/* Minimized Content: Status Messages */}
                {!isExpanded && (
                    <div className="flex-1 flex flex-col justify-center px-4 overflow-hidden">
                        <div className="flex flex-col gap-0.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {agents.director.status !== 'idle' ? 'DIRECTOR' : agents.dop.status !== 'idle' ? 'DOP' : 'UNIT READY'}
                            </p>
                            <p className="text-xs text-slate-300 truncate font-medium">
                                {agents.director.currentStage || agents.dop.currentStage || agents.director.message || agents.dop.message || "Standing by..."}
                            </p>
                        </div>
                    </div>
                )}

                {/* Expanded Content: Chat Log */}
                {isExpanded && (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Status Bar */}
                        <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-tighter">
                            <div className="flex items-center gap-2">
                                <span className={agents.director.status !== 'idle' ? 'text-purple-400' : ''}>Dir: {agents.director.status}</span>
                                <span className="opacity-30">|</span>
                                <span className={agents.dop.status !== 'idle' ? 'text-blue-400' : ''}>DOP: {agents.dop.status}</span>
                            </div>
                            {(agents.director.currentStage || agents.dop.currentStage) && (
                                <div className="flex items-center gap-1.5 animate-pulse text-indigo-400">
                                    <RotateCcw className="w-3 h-3 animate-spin-slow" />
                                    {agents.director.currentStage || agents.dop.currentStage}
                                </div>
                            )}
                        </div>

                        {/* Logs */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar no-drag"
                        >
                            {logs.map((log) => (
                                <div key={log.id} className={`flex flex-col gap-1 ${log.sender === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-1.5 px-1">
                                        {log.sender === 'director' && <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Director</span>}
                                        {log.sender === 'dop' && <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">DOP</span>}
                                        {log.sender === 'user' && <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-right w-full">YOU</span>}
                                    </div>
                                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm ${log.sender === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : log.sender === 'director'
                                            ? 'bg-purple-900/40 text-purple-50 border border-purple-500/20 rounded-tl-none'
                                            : log.sender === 'dop'
                                                ? 'bg-blue-900/40 text-blue-50 border border-blue-500/20 rounded-tl-none'
                                                : 'bg-slate-800 text-slate-300'
                                        }`}>
                                        {log.message}
                                    </div>
                                </div>
                            ))}

                            {/* THINKING ANIMATION */}
                            {(agents.director.status === 'thinking' || agents.dop.status === 'thinking') && (
                                <div className="flex flex-col gap-1 items-start animate-fade-in-up">
                                    <div className="flex items-center gap-1.5 px-1">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${agents.director.status === 'thinking' ? 'text-purple-400' : 'text-blue-400'}`}>
                                            {agents.director.status === 'thinking' ? 'Director' : 'DOP'}
                                        </span>
                                    </div>
                                    <div className={`px-4 py-3 rounded-2xl border rounded-tl-none shadow-sm flex items-center gap-2 ${agents.director.status === 'thinking'
                                        ? 'bg-purple-900/40 border-purple-500/20 text-purple-300'
                                        : 'bg-blue-900/40 border-blue-500/20 text-blue-300'
                                        }`}>
                                        <div className="flex space-x-1">
                                            <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                            <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                            <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                                        </div>
                                        <span className="text-[10px] font-medium opacity-70">
                                            {agents.director.status === 'thinking' ? agents.director.currentStage : agents.dop.currentStage}...
                                        </span>
                                    </div>
                                </div>
                            )}
                            {logs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 opacity-50">
                                    <Command className="w-8 h-8" />
                                    <p className="text-xs">No activity yet. Commands are ready.</p>
                                </div>
                            )}
                        </div>

                        {/* Command Bar */}
                        <div className="p-3 bg-white/5 border-t border-white/10 no-drag">
                            <form onSubmit={handleSubmit} className="relative group">
                                <input
                                    id="director-command-bar"
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    placeholder="Type a command (e.g. 'Stop and change style')..."
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                                />

                                <button
                                    type="submit"
                                    disabled={!command.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-indigo-400 disabled:opacity-30 transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                                <div className="absolute -top-6 left-2 flex items-center gap-1.5 opacity-0 group-focus-within:opacity-100 transition-opacity">
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-800 border border-white/5 px-1.5 py-0.5 rounded uppercase">Cmd + K</span>
                                    <span className="text-[9px] text-slate-600">to quick focus</span>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnifiedProductionHub;
