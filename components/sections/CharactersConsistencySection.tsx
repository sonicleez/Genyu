import React from 'react';
import { Plus } from 'lucide-react';
import { SectionTitle } from '../common/SectionTitle';
import { CharacterCard } from '../characters/CharacterCard';
import { Character } from '../../types';

interface CharactersConsistencySectionProps {
    characters: Character[];
    onSetDefaultCharacter: (id: string) => void;
    onDeleteCharacter: (id: string) => void;
    onUpdateCharacter: (id: string, updates: Partial<Character>) => void;
    onSetEditingCharacterId: (id: string) => void;
    onAddCharacter: () => void;
}

export const CharactersConsistencySection: React.FC<CharactersConsistencySectionProps> = ({
    characters,
    onSetDefaultCharacter,
    onDeleteCharacter,
    onUpdateCharacter,
    onSetEditingCharacterId,
    onAddCharacter
}) => {
    return (
        <div className="my-16">
            <SectionTitle>Characters Consistency</SectionTitle>
            <div className="grid md:grid-cols-3 gap-6">
                {characters.map((char, index) => (
                    <CharacterCard
                        key={char.id}
                        character={char}
                        index={index}
                        setDefault={onSetDefaultCharacter}
                        onDelete={() => onDeleteCharacter(char.id)}
                        onValuesChange={onUpdateCharacter}
                        onEdit={() => onSetEditingCharacterId(char.id)}
                    />
                ))}
                {/* Add Character Button */}
                <button
                    onClick={onAddCharacter}
                    className="bg-gray-800/50 p-4 rounded-lg border-2 border-dashed border-gray-700 hover:border-brand-orange hover:bg-gray-800/80 flex items-center justify-center space-x-3 transition-all group"
                >
                    <div className="w-10 h-10 rounded-full bg-gray-700 group-hover:bg-brand-orange/20 flex items-center justify-center transition-colors">
                        <Plus size={18} className="text-gray-500 group-hover:text-brand-orange" />
                    </div>
                    <span className="text-gray-400 group-hover:text-white font-medium">Thêm Nhân Vật</span>
                </button>
            </div>
        </div>
    );
};
