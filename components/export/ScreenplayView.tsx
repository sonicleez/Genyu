import React from 'react';
import { ProjectState, SceneGroup, Scene } from '../../types';

interface ScreenplayViewProps {
    state: ProjectState;
}

export const ScreenplayView: React.FC<ScreenplayViewProps> = ({ state }) => {
    return (
        <div className="screenplay-container bg-white text-black p-[1in] font-mono leading-tight max-w-[8.5in] mx-auto min-h-[11in] shadow-2xl print:shadow-none print:m-0 print:p-[1in]">
            {/* Title Page */}
            <div className="title-page h-[9in] flex flex-col items-center justify-center text-center space-y-4 mb-20 break-after-page">
                <h1 className="text-3xl font-bold uppercase tracking-widest">{state.projectName || 'UNTITLED PROJECT'}</h1>
                <p className="text-lg italic">Written by AI & {state.projectName || 'User'}</p>
                <div className="mt-20">
                    <p>Based on Idea:</p>
                    <p className="max-w-md">"{state.customScriptInstruction || 'Original Concept'}"</p>
                </div>
            </div>

            {/* Script Content */}
            <div className="script-content space-y-6 text-[12pt]">
                {state.sceneGroups.map((group, groupIdx) => {
                    const groupScenes = state.scenes.filter(s => s.groupId === group.id);
                    return (
                        <div key={group.id} className="scene-group space-y-6">
                            {groupScenes.map((scene, sceneIdx) => (
                                <div key={scene.id} className="scene-block space-y-4 break-inside-avoid">
                                    {/* Slugline */}
                                    <h2 className="uppercase font-bold pt-4">
                                        {scene.scene_number}. {group.name} - {scene.prompt_name}
                                    </h2>

                                    {/* Action / Visual Context */}
                                    <div className="action-text pl-0 pr-0">
                                        {scene.visual_context}
                                    </div>

                                    {/* Dialogue / Voiceover */}
                                    {scene.voiceover && (
                                        <div className="dialogue-block mx-auto w-[4in] space-y-1">
                                            <p className="text-center font-bold uppercase pl-0">NARRATOR (V.O.)</p>
                                            <p className="text-sm pl-4 pr-4">
                                                {scene.voiceover}
                                            </p>
                                        </div>
                                    )}

                                    {scene.dialogues && scene.dialogues.length > 0 && scene.dialogues.map((d, dIdx) => (
                                        <div key={dIdx} className="dialogue-block mx-auto w-[4in] space-y-1">
                                            <p className="text-center font-bold uppercase pl-0">{d.characterName || 'CHARACTER'}</p>
                                            <p className="text-sm pl-4 pr-4">
                                                {d.line}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* Global Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        margin: 0;
                        size: auto;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .screenplay-container, .screenplay-container * {
                        visibility: visible;
                    }
                    .screenplay-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        box-shadow: none !important;
                    }
                }
                .screenplay-container {
                    font-family: 'Courier Prime', 'Courier New', Courier, monospace;
                }
            `}} />
        </div>
    );
};
