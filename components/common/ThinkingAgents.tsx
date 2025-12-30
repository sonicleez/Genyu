import React from 'react';
import { AgentState } from '../../types';
import { Camera, Clapperboard, MessageSquare } from 'lucide-react';

interface ThinkingAgentsProps {
    agents?: {
        director: AgentState;
        dop: AgentState;
    };
}

const ThinkingAgents: React.FC<ThinkingAgentsProps> = ({ agents }) => {
    // Persistent state for positions (using snapped side and Y)
    const [positions, setPositions] = React.useState(() => {
        const saved = localStorage.getItem('agent_positions_v3');
        return saved ? JSON.parse(saved) : {
            director: { y: 150, side: 'left' as const },
            dop: { y: 250, side: 'right' as const }
        };
    });

    // Temp screen X/Y during drag
    const [dragPos, setDragPos] = React.useState<{ x: number, y: number } | null>(null);

    // Persistent state for minimized state
    const [minimized, setMinimized] = React.useState(() => {
        const saved = localStorage.getItem('agent_minimized');
        return saved ? JSON.parse(saved) : { director: false, dop: false };
    });

    const [dragging, setDragging] = React.useState<'director' | 'dop' | null>(null);
    const dragOffset = React.useRef({ x: 0, y: 0 });
    const isClickRef = React.useRef(true);

    React.useEffect(() => {
        localStorage.setItem('agent_positions_v3', JSON.stringify(positions));
    }, [positions]);

    React.useEffect(() => {
        localStorage.setItem('agent_minimized', JSON.stringify(minimized));
    }, [minimized]);

    const handleMouseDown = (e: React.MouseEvent, agent: 'director' | 'dop') => {
        setDragging(agent);
        isClickRef.current = true;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        setDragPos({ x: rect.left, y: rect.top });
        e.preventDefault();
        e.stopPropagation();
    };

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragging) return;
            isClickRef.current = false;

            setDragPos({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            });
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!dragging) return;

            if (!isClickRef.current) {
                // Snap to nearest side
                const threshold = window.innerWidth / 2;
                const finalSide = e.clientX < threshold ? 'left' : 'right';
                const yFromBottom = window.innerHeight - e.clientY;
                const clampedY = Math.max(20, Math.min(window.innerHeight - 100, yFromBottom));

                setPositions(prev => ({
                    ...prev,
                    [dragging]: { side: finalSide, y: clampedY }
                }));
            }

            setDragging(null);
            setDragPos(null);
        };

        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging]);

    if (!agents) return null;

    const { director, dop } = agents;

    const renderAgent = (
        agentKey: 'director' | 'dop',
        agent: AgentState,
        Icon: any,
        name: string,
        colorClass: string
    ) => {
        const pos = positions[agentKey];
        const isMinimized = minimized[agentKey];
        const isActive = agent.status !== 'idle';
        const side = pos.side;
        const isCurrentlyDragging = dragging === agentKey;

        // Calculate dynamic style
        const style: React.CSSProperties = {
            zIndex: isCurrentlyDragging ? 1000 : 300,
            cursor: isCurrentlyDragging ? 'grabbing' : 'grab',
            transition: isCurrentlyDragging ? 'none' : 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            position: 'fixed'
        };

        if (isCurrentlyDragging && dragPos) {
            style.left = `${dragPos.x}px`;
            style.top = `${dragPos.y}px`;
            style.right = 'auto'; // Clear right during drag
            style.bottom = 'auto'; // Clear bottom during drag
        } else {
            style.bottom = `${pos.y}px`;
            if (side === 'left') {
                style.left = '24px';
                style.right = 'auto';
            } else {
                style.right = '24px';
                style.left = 'auto';
            }
        }

        return (
            <div
                onMouseDown={(e) => handleMouseDown(e, agentKey)}
                onClick={(e) => {
                    if (isClickRef.current) {
                        setMinimized(prev => ({ ...prev, [agentKey]: !prev[agentKey] }));
                    }
                    e.stopPropagation();
                }}
                style={style}
                className={`flex flex-col items-${side === 'left' ? 'start' : 'end'} select-none group pointer-events-auto`}
            >
                {/* Thought/Message Bubble */}
                {!isMinimized && agent.message && (
                    <div className={`mb-4 max-w-[200px] p-4 rounded-2xl backdrop-blur-2xl border ${side === 'left' ? 'rounded-bl-none' : 'rounded-br-none'} transition-all duration-500 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative ${agent.status === 'error' ? 'bg-red-900/40 border-red-500/40 text-red-200' :
                        agent.status === 'success' ? 'bg-green-900/40 border-green-500/40 text-green-200' :
                            'bg-gray-900/80 border-white/10 text-white'
                        }`}>
                        <div className="flex items-start gap-2">
                            <MessageSquare size={12} className="mt-1 opacity-50 shrink-0" />
                            <p className="text-[11px] font-bold leading-relaxed tracking-tight">{agent.message}</p>
                        </div>

                        {/* Thinking Dots */}
                        {agent.status === 'thinking' && (
                            <div className="flex gap-1 mt-2">
                                <div className="w-1 h-1 bg-current rounded-full animate-bounce"></div>
                                <div className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                <div className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0.4s]"></div>
                            </div>
                        )}

                        {/* Pointer */}
                        <div className={`absolute -bottom-2 ${side === 'left' ? 'left-4' : 'right-4'} w-4 h-4 transform rotate-45 border-r border-b ${agent.status === 'error' ? 'bg-red-900/40 border-red-500/20' :
                            agent.status === 'success' ? 'bg-green-900/40 border-green-500/20' :
                                'bg-gray-900/80 border-white/5'
                            }`}></div>
                    </div>
                )}

                {/* Avatar Container */}
                <div className="flex items-center gap-3">
                    {side === 'right' && !isMinimized && (
                        <div className="text-right pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{name}</p>
                            <p className={`text-[9px] font-bold ${colorClass.replace('bg-', 'text-')} uppercase`}>{agent.status}</p>
                        </div>
                    )}

                    <div className={`relative transition-all duration-500 ${isMinimized ? 'opacity-60 scale-90' : 'scale-100 hover:scale-110'}`}>
                        {/* Premium Floating Ring */}
                        <div className={`w-14 h-14 rounded-full ${colorClass} p-1 shadow-[0_0_30px_rgba(0,0,0,0.4)] relative animate-float transition-all duration-500 ${isMinimized ? '' : 'ring-4 ring-white/5'}`}>
                            {/* Inner Container */}
                            <div className="w-full h-full rounded-full bg-gray-950/90 backdrop-blur-md flex items-center justify-center relative z-10 border border-white/10 overflow-hidden">
                                {isMinimized ? (
                                    <Icon size={18} className="opacity-40" />
                                ) : (
                                    <Icon size={24} className={`${agent.status === 'thinking' ? 'animate-pulse' : ''} text-white`} />
                                )}
                            </div>

                            {/* Status indicator dot */}
                            <div className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-gray-950 z-20 ${agent.status === 'thinking' ? 'bg-blue-500 animate-pulse' :
                                agent.status === 'speaking' ? 'bg-brand-orange animate-pulse' :
                                    agent.status === 'success' ? 'bg-green-500' :
                                        'bg-gray-500'
                                } shadow-xl`}></div>

                            {/* View Toggle Hint */}
                            <div className="absolute inset-0 z-30 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/60 backdrop-blur-[4px] rounded-full transition-all duration-300">
                                <span className="text-[9px] font-black text-white uppercase tracking-tighter">{isMinimized ? 'Max' : 'Min'}</span>
                            </div>
                        </div>
                    </div>

                    {side === 'left' && !isMinimized && (
                        <div className="text-left pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{name}</p>
                            <p className={`text-[9px] font-bold ${colorClass.replace('bg-', 'text-')} uppercase`}>{agent.status}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <style>
                {`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-float {
                    animation: float 4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
                }
                `}
            </style>
            <div className="fixed inset-0 pointer-events-none z-[500]">
                {renderAgent('director', director, Clapperboard, 'Director', 'bg-brand-orange')}
                {renderAgent('dop', dop, Camera, 'DOP Assistant', 'bg-blue-600')}
            </div>
        </>
    );
};

export default ThinkingAgents;
