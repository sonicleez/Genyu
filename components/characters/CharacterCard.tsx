import React from 'react';
import { Trash2 } from 'lucide-react';
import { Character } from '../../types';

export interface CharacterCardProps {
    character: Character;
    index: number;
    setDefault: (id: string) => void;
    onDelete: () => void;
    onValuesChange: (id: string, updates: Partial<Character>) => void;
    onEdit: () => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ character, index, setDefault, onDelete, onValuesChange, onEdit }) => {
    return (
        <div
            onClick={onEdit}
            className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-brand-orange cursor-pointer transition-all flex items-center space-x-4 relative group"
        >
            {/* Avatar Preview */}
            <div className="w-14 h-14 rounded-lg bg-gray-900 border border-gray-600 overflow-hidden flex-shrink-0 relative">
                {character.masterImage ? (
                    <img src={character.masterImage} alt={character.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl font-bold">
                        {character.name.charAt(0) || '👤'}
                    </div>
                )}

                {/* Loading Indicator */}
                {(character.isAnalyzing || character.workflowStatus === 'active') && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-orange"></div>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <input
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    type="text"
                    value={character.name}
                    onChange={(e) => onValuesChange(character.id, { name: e.target.value })}
                    placeholder={`Character ${index + 1}`}
                    className="bg-transparent font-bold text-brand-cream focus:outline-none focus:border-b border-brand-orange w-full truncate placeholder-gray-600"
                />
                <p className="text-xs text-gray-400 truncate mt-0.5">{character.description || "No description"}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-1">
                <button
                    onClick={(e) => { e.stopPropagation(); setDefault(character.id); }}
                    className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${character.isDefault ? 'text-yellow-400' : 'text-gray-600 opacity-0 group-hover:opacity-100'}`}
                    title="Set Default"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 text-gray-600 hover:text-red-500 rounded hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                    <Trash2 size={14} />
                </button>
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
        </div>
    );
};
