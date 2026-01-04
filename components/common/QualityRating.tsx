/**
 * Quality Rating Component
 * 
 * Allows user to rate generated images for DOP learning.
 * Shows 👍 for approval and 👎 with rejection reasons in anchored popup.
 */

import React, { useState, useRef, useEffect } from 'react';
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

    const handleApprove = async () => {
        if (rated || isRating) return;
        setIsRating(true);

        try {
            if (dopRecordId) {
                await approvePrompt(dopRecordId, {
                    overall: 0.95,
                    match: 0.95
                });
                console.log('[QualityRating] Approved:', dopRecordId);
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
            if (dopRecordId) {
                await rejectPrompt(dopRecordId, selectedReasons);
                console.log('[QualityRating] Rejected:', dopRecordId, selectedReasons);
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

    const isDisabled = isRating || !dopRecordId;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="flex items-center gap-1">
                <span className="text-gray-500 text-xs mr-0.5">
                    {dopRecordId ? '📊' : '⏳'}
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

            {/* Fixed Center Modal - prevents clipping */}
            {showRejectMenu && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[199] bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowRejectMenu(false)}
                    />
                    {/* Modal */}
                    <div
                        className="fixed z-[200] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                            bg-gray-900/98 backdrop-blur-xl border border-gray-700/80 rounded-xl shadow-2xl
                            w-[320px] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gradient-to-r from-red-900/30 to-orange-900/20">
                            <span className="text-sm font-bold text-white flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-400" />
                                Chọn lý do lỗi
                            </span>
                            <button
                                onClick={() => setShowRejectMenu(false)}
                                className="p-1.5 hover:bg-gray-700/50 rounded transition-colors"
                            >
                                <X size={16} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Options Grid */}
                        <div className="p-3 grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                            {REJECTION_OPTIONS.map(opt => {
                                const isSelected = selectedReasons.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => toggleReason(opt.value)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all ${isSelected
                                            ? 'bg-red-500/25 border border-red-500/50 text-red-300 shadow-lg shadow-red-500/20'
                                            : 'bg-gray-800/60 border border-gray-700/50 text-gray-300 hover:bg-gray-700/60 hover:border-gray-600'
                                            }`}
                                    >
                                        <span className="text-sm">{opt.emoji}</span>
                                        <span className="truncate flex-1">{opt.label}</span>
                                        {isSelected && <CheckCircle2 size={14} className="text-red-400 flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="px-3 py-3 border-t border-gray-700/50 flex gap-2 bg-gray-800/30">
                            <button
                                onClick={handleReject}
                                disabled={selectedReasons.length === 0 || isRating}
                                className={`flex-1 px-4 py-2 rounded-lg font-bold text-sm transition-all ${selectedReasons.length > 0
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {isRating ? '⏳ Đang gửi...' : `Báo lỗi (${selectedReasons.length})`}
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedReasons([]);
                                    setShowRejectMenu(false);
                                }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                            >
                                Hủy
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default QualityRating;
