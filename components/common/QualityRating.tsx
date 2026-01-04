/**
 * Quality Rating Component
 * 
 * Allows user to rate generated images for DOP learning.
 * Shows 👍 for approval and 👎 with rejection reasons in portal modal.
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ThumbsUp, ThumbsDown, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import { approvePrompt, rejectPrompt, RejectReason } from '../../utils/dopLearning';

interface QualityRatingProps {
    dopRecordId?: string;
    onRate?: (rating: 'good' | 'bad', reasons?: RejectReason[]) => void;
    size?: 'sm' | 'md';
    className?: string;
}

// Rejection reasons with Vietnamese labels
const REJECTION_OPTIONS: { value: RejectReason; label: string; emoji: string }[] = [
    { value: 'raccord_error', label: 'Sai Raccord', emoji: '🔗' },
    { value: 'character_mismatch', label: 'Nhân vật sai', emoji: '👤' },
    { value: 'wrong_outfit', label: 'Sai trang phục', emoji: '👔' },
    { value: 'wrong_pose', label: 'Sai tư thế', emoji: '🧍' },
    { value: 'wrong_angle', label: 'Sai góc camera', emoji: '📷' },
    { value: 'wrong_lighting', label: 'Sai ánh sáng', emoji: '💡' },
    { value: 'wrong_background', label: 'Sai background', emoji: '🏞️' },
    { value: 'quality_issue', label: 'Chất lượng kém', emoji: '📉' },
    { value: 'prompt_ignored', label: 'AI bỏ prompt', emoji: '🚫' },
    { value: 'nsfw_content', label: 'NSFW', emoji: '⚠️' },
    { value: 'other', label: 'Khác', emoji: '❓' },
];

export function QualityRating({
    dopRecordId,
    onRate,
    size = 'sm',
    className = ''
}: QualityRatingProps) {
    const [rated, setRated] = useState<'good' | 'bad' | null>(null);
    const [isRating, setIsRating] = useState(false);
    const [showRejectMenu, setShowRejectMenu] = useState(false);
    const [selectedReasons, setSelectedReasons] = useState<RejectReason[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowRejectMenu(false);
            }
        };
        if (showRejectMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showRejectMenu]);

    // Use prop or fallback to global (for async DOP recording)
    const effectiveDopRecordId = dopRecordId || (window as any).__lastDopRecordId;

    const handleApprove = async () => {
        if (rated || isRating) return;
        setIsRating(true);

        try {
            if (effectiveDopRecordId) {
                await approvePrompt(effectiveDopRecordId, {
                    overall: 0.95,
                    match: 0.95
                });
                console.log('[QualityRating] Approved:', effectiveDopRecordId);
            }
            setRated('good');
            onRate?.('good');
        } catch (e) {
            console.error('[QualityRating] Approve failed:', e);
        } finally {
            setIsRating(false);
        }
    };

    const handleReject = async () => {
        if (selectedReasons.length === 0) {
            return;
        }

        setIsRating(true);
        try {
            if (effectiveDopRecordId) {
                await rejectPrompt(effectiveDopRecordId, selectedReasons);
                console.log('[QualityRating] Rejected:', effectiveDopRecordId, selectedReasons);
            }
            setRated('bad');
            setShowRejectMenu(false);
            onRate?.('bad', selectedReasons);
        } catch (e) {
            console.error('[QualityRating] Reject failed:', e);
        } finally {
            setIsRating(false);
        }
    };

    const toggleReason = (reason: RejectReason) => {
        setSelectedReasons(prev =>
            prev.includes(reason)
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
        );
    };

    const iconSize = size === 'sm' ? 14 : 18;
    const buttonSize = size === 'sm' ? 'p-1' : 'p-1.5';

    // Already rated - show result
    if (rated) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                {rated === 'good' ? (
                    <span className="text-green-500 text-xs flex items-center gap-0.5">
                        <ThumbsUp size={iconSize} fill="currentColor" /> ✓
                    </span>
                ) : (
                    <span className="text-red-400 text-xs flex items-center gap-0.5">
                        <ThumbsDown size={iconSize} fill="currentColor" /> {selectedReasons.length}
                    </span>
                )}
            </div>
        );
    }

    const isDisabled = isRating || !effectiveDopRecordId;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="flex items-center gap-1">
                <span className="text-gray-500 text-xs mr-0.5">
                    {effectiveDopRecordId ? '📊' : '⏳'}
                </span>

                {/* Approve button */}
                <button
                    onClick={handleApprove}
                    disabled={isDisabled}
                    className={`${buttonSize} rounded hover:bg-green-500/20 text-gray-400 hover:text-green-500 
                        transition-colors disabled:opacity-50`}
                    title="Ảnh tốt"
                >
                    <ThumbsUp size={iconSize} />
                </button>

                {/* Reject button - opens menu */}
                <button
                    onClick={() => setShowRejectMenu(!showRejectMenu)}
                    disabled={isDisabled}
                    className={`${buttonSize} rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 
                        transition-colors disabled:opacity-50 ${showRejectMenu ? 'bg-red-500/20 text-red-400' : ''}`}
                    title="Báo lỗi"
                >
                    <ThumbsDown size={iconSize} />
                </button>
            </div>

            {/* Anchored Popup with Smart Positioning via Portal */}
            {showRejectMenu && createPortal(
                <div
                    className="fixed inset-0 z-[9998]"
                    onClick={() => setShowRejectMenu(false)}
                >
                    {/* Popup positioned near the rating buttons */}
                    <div
                        className="fixed z-[9999] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[320px] overflow-hidden"
                        style={{
                            // Position relative to containerRef
                            ...(containerRef.current ? (() => {
                                const rect = containerRef.current.getBoundingClientRect();
                                const popupHeight = 380; // Approximate popup height
                                const popupWidth = 320;

                                // Prefer positioning ABOVE the button
                                let top = rect.top - popupHeight - 8;
                                let left = rect.left + (rect.width / 2) - (popupWidth / 2);

                                // If not enough space above, position BELOW
                                if (top < 10) {
                                    top = rect.bottom + 8;
                                }

                                // Keep within horizontal viewport
                                if (left < 10) left = 10;
                                if (left + popupWidth > window.innerWidth - 10) {
                                    left = window.innerWidth - popupWidth - 10;
                                }

                                // Keep within vertical viewport
                                if (top + popupHeight > window.innerHeight - 10) {
                                    top = window.innerHeight - popupHeight - 10;
                                }

                                return { top: `${top}px`, left: `${left}px` };
                            })() : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 bg-gradient-to-r from-red-900/40 to-orange-900/30">
                            <span className="text-sm font-bold text-white flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-400" />
                                Chọn lý do lỗi
                            </span>
                            <button
                                onClick={() => setShowRejectMenu(false)}
                                className="p-1 hover:bg-gray-700/50 rounded transition-colors"
                            >
                                <X size={14} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Options Grid - Compact */}
                        <div className="p-2 grid grid-cols-2 gap-1.5">
                            {REJECTION_OPTIONS.map(opt => {
                                const isSelected = selectedReasons.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => toggleReason(opt.value)}
                                        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-left text-xs transition-all ${isSelected
                                            ? 'bg-red-500/30 border border-red-500/60 text-red-200'
                                            : 'bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700'
                                            }`}
                                    >
                                        <span>{opt.emoji}</span>
                                        <span className="truncate flex-1">{opt.label}</span>
                                        {isSelected && <CheckCircle2 size={12} className="text-red-400 flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-2 py-2 border-t border-gray-700 flex gap-2 bg-gray-800/50">
                            <button
                                onClick={handleReject}
                                disabled={selectedReasons.length === 0 || isRating}
                                className={`flex-1 px-3 py-2 rounded-lg font-bold text-xs transition-all ${selectedReasons.length > 0
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {isRating ? '⏳' : `Báo lỗi (${selectedReasons.length})`}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedReasons([]);
                                    setShowRejectMenu(false);
                                }}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs transition-colors"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default QualityRating;
