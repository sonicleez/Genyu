import React from 'react';
import { ScriptPreset } from '../types';
import { getAllPresets } from '../utils/scriptPresets';

interface PresetSelectorProps {
    activePresetId: string;
    customPresets: ScriptPreset[];
    onSelect: (presetId: string) => void;
    className?: string;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
    activePresetId,
    customPresets,
    onSelect,
    className = ''
}) => {
    const allPresets = getAllPresets(customPresets);
    const activePreset = allPresets.find(p => p.id === activePresetId);

    return (
        <div className={`preset-selector ${className}`}>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
                📝 Chọn Loại Kịch Bản
            </label>

            {/* Dropdown */}
            <select
                value={activePresetId}
                onChange={(e) => onSelect(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
                {allPresets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                        {preset.icon} {preset.name}
                    </option>
                ))}
                <option value="create_custom" className="text-brand-orange font-bold">+ Tùy chỉnh (Thêm mới)...</option>
            </select>

            {/* Active Preset Info */}
            {activePreset && (
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">
                        <span className="font-semibold text-purple-400">Mô tả:</span> {activePreset.description}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {activePreset.toneKeywords.map((keyword, i) => (
                            <span
                                key={i}
                                className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-300 rounded-full"
                            >
                                {keyword}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface PresetCardGridProps {
    activePresetId: string;
    customPresets: ScriptPreset[];
    onSelect: (presetId: string) => void;
}

export const PresetCardGrid: React.FC<PresetCardGridProps> = ({
    activePresetId,
    customPresets,
    onSelect
}) => {
    const allPresets = getAllPresets(customPresets);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {allPresets.map(preset => {
                const isActive = preset.id === activePresetId;
                return (
                    <button
                        key={preset.id}
                        onClick={() => onSelect(preset.id)}
                        className={`
                            p-4 rounded-lg border-2 transition-all text-left
                            ${isActive
                                ? 'border-purple-500 bg-purple-900/30 shadow-lg shadow-purple-500/20'
                                : 'border-gray-700 bg-gray-800/50 hover:border-purple-400 hover:bg-gray-800'
                            }
                        `}
                    >
                        <div className="text-3xl mb-2">{preset.icon}</div>
                        <div className="text-sm font-semibold text-white mb-1">
                            {preset.name}
                        </div>
                        <div className="text-xs text-gray-400 line-clamp-2">
                            {preset.description}
                        </div>
                        {isActive && (
                            <div className="mt-2 text-xs text-purple-400 font-semibold">
                                ✓ Đang chọn
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
};
