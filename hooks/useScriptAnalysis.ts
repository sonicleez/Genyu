/**
 * useScriptAnalysis Hook
 * 
 * Analyzes imported voice-over scripts using AI to:
 * 1. Detect chapter headers
 * 2. Identify characters
 * 3. Suggest scene breakdown
 * 4. Generate visual prompts with Director + Character Style
 */

import { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Scene, SceneGroup, Character, CharacterStyleDefinition } from '../types';
import { DirectorPreset, DIRECTOR_PRESETS } from '../constants/directors';
import { resolveStyleWithInheritance } from '../constants/characterStyles';

// Analysis result types
export interface ChapterAnalysis {
    id: string;
    title: string;
    startIndex: number;
    endIndex: number;
    estimatedDuration: number; // seconds
    suggestedTimeOfDay?: string;
    suggestedWeather?: string;
}

export interface CharacterAnalysis {
    name: string;
    mentions: number;
    suggestedDescription: string;
    outfitByChapter: Record<string, string>; // chapterId -> outfit description
    isMain: boolean;
}

export interface SceneAnalysis {
    voiceOverText: string;
    visualPrompt: string;
    chapterId: string;
    characterNames: string[];
    estimatedDuration: number;
    needsExpansion: boolean; // If VO is long and needs multiple visual scenes
    expansionScenes?: {
        visualPrompt: string;
        isBRoll: boolean;
    }[];
}

export interface ScriptAnalysisResult {
    totalWords: number;
    estimatedDuration: number; // total seconds
    chapters: ChapterAnalysis[];
    characters: CharacterAnalysis[];
    suggestedSceneCount: number;
    scenes: SceneAnalysis[];
}

// Words per minute for duration estimation
const WPM_SLOW = 120;
const WPM_MEDIUM = 150;
const WPM_FAST = 180;

export function useScriptAnalysis(userApiKey: string | null) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ScriptAnalysisResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    /**
     * Analyze script text using AI
     */
    const analyzeScript = useCallback(async (
        scriptText: string,
        readingSpeed: 'slow' | 'medium' | 'fast' = 'medium',
        modelSelector: string = 'gemini-2.0-flash|none', // format: model|thinkingLevel
        characterStyle?: CharacterStyleDefinition | null,
        director?: DirectorPreset | null,
        researchNotes?: { director?: string; dop?: string } | null  // NEW: Research notes injection
    ): Promise<ScriptAnalysisResult | null> => {
        if (!userApiKey) {
            setAnalysisError('API key required');
            return null;
        }

        setIsAnalyzing(true);
        setAnalysisError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: userApiKey });
            const wpm = readingSpeed === 'slow' ? WPM_SLOW : readingSpeed === 'fast' ? WPM_FAST : WPM_MEDIUM;
            const wordCount = scriptText.split(/\s+/).length;
            const estimatedTotalDuration = Math.ceil((wordCount / wpm) * 60);

            // Parse model selector format: "model-name|thinking-level"
            const [modelName, thinkingLevel] = modelSelector.split('|');

            // Map thinking level to budget tokens
            const thinkingBudgets: Record<string, number | undefined> = {
                'high': 24576,
                'medium': 8192,
                'low': 2048,
                'minimal': 512,
                'none': undefined
            };
            const thinkingBudget = thinkingBudgets[thinkingLevel] ?? undefined;

            // Context Injection
            let contextInstructions = "";
            if (characterStyle) {
                contextInstructions += `\nVISUAL STYLE CONSTRAINT: The user selected the character style "${characterStyle.name}" (${characterStyle.promptInjection.global}).\n- You MUST generate "suggestedDescription" that aligns with this style.\n- CRITICAL: You MUST extract the SPECIFIC OUTFIT (uniforms, period clothing, colors) from the script.\n- IF SCRIPT IS VAGUE: You MUST INFER appropriate period-accurate clothing in EXTREME DETAIL.\n- TEXTURE & MATERIAL LOCK: You MUST describe textures with MICROSCOPIC DETAIL (e.g. "cracked leather with oil stains", "coarse wool with pilling", "rusted brass buttons", "frayed cotton edges").\n- FORMAT: "[Style Description]. WEARING: [Detailed Outfit Description with specific textures/materials] + [Accessories/Props]."\n- Example: "Faceless white mannequin. WEARING: A heavy, cracked vintage bomber jacket (worn leather texture), coarse grey wool trousers with mud splatters, and tarnished silver cufflinks."\n`;
            } else {
                contextInstructions += `\n- For characters, provide a HIGHLY DETAILED VISUAL DESCRIPTION (Age, Ethnicity, Hair, Face, Body, Initial Outfit).`;
            }

            if (director) {
                contextInstructions += `\nDIRECTOR VISION: ${director.name} (${director.description}).\n- Frame scenes according to this director's style.\n`;
            }

            // Inject Research Notes (User's custom research for this script)
            if (researchNotes?.director) {
                contextInstructions += `\n[USER DIRECTOR NOTES - MANDATORY CONTEXT]:\n${researchNotes.director}\n- Apply these storytelling guidelines to scene breakdown and character actions.\n`;
            }
            if (researchNotes?.dop) {
                contextInstructions += `\n[USER DOP NOTES - MANDATORY CAMERA/LIGHTING CONTEXT]:\n${researchNotes.dop}\n- Apply these cinematography guidelines to visual prompts.\n`;
            }

            const prompt = `Analyze this voice-over script for a documentary video. Return JSON only.

SCRIPT:
"""
${scriptText}
"""

TASK:
1. Identify CHAPTER HEADERS
2. Extract CHARACTER NAMES - EXTRACT **ALL** CHARACTERS, including:
   - Main protagonists
   - Supporting characters (police, dealers, guards, etc.)
   - Historical figures mentioned by name
   - Minor roles who contribute to scenes (even with 1 mention)
3. Break into SCENES (3-5s each)
4. Create VISUAL PROMPTS

CHARACTER RULES (CRITICAL - FOLLOW EXACTLY):
- List EVERY named person or role that appears visually in any scene
- MERGE ALIASES: If "The man" and "Étienne" refer to the same person, use "Étienne Marchand" only
- MERGE TITLES: "Plainclothes officers" and "Monegasque police" = use "Monegasque Police Officers"
- Include roles like: croupier, dealer, security guard, waitress, etc.
- For groups (e.g., "two officers"), use plural: "Monegasque Police Officers"
- Set isMain: true ONLY for protagonist(s), false for all others
- DO NOT skip minor characters - they are needed for visual consistency

SCENE RULES:
- Each scene should have voice-over text (~3-4s)${contextInstructions}
- If a VO segment needs multiple visuals, mark needsExpansion: true
- Expansion scenes are B-roll
- CONSISTENCY CHECK: Ensure the same character is not listed twice under different names.

RESPOND WITH JSON ONLY:
{
  "chapters": [
    {
      "id": "chapter_1",
      "title": "Chapter Title",
      "suggestedTimeOfDay": "night",
      "suggestedWeather": "clear"
    }
  ],
  "characters": [
    {
      "name": "Étienne Marchand",
      "mentions": 5,
      "suggestedDescription": "Faceless white mannequin head. WEARING: A tailored charcoal grey 1940s wool suit with wide lapels, crisp white shirt, silk tie, and a gold pocket watch chain. (Micro-texture: Fabric has visible weave texture).",
      "outfitByChapter": {
        "chapter_1": "charcoal grey 1940s wool suit",
        "chapter_2": "casual linen shirt and trousers"
      },
      "isMain": true
    }
  ],
  "scenes": [
    {
      "voiceOverText": "Exact text from script...",
      "visualPrompt": "WIDE SHOT. Casino interior, roulette table, elegant chandelier...",
      "chapterId": "chapter_1",
      "characterNames": ["Character Name"],
      "needsExpansion": false
    },
    {
      "voiceOverText": "Longer text that needs multiple visuals...",
      "visualPrompt": "First visual - establishing shot",
      "chapterId": "chapter_1",
      "characterNames": [],
      "needsExpansion": true,
      "expansionScenes": [
        { "visualPrompt": "B-roll: Close-up of chips", "isBRoll": true },
        { "visualPrompt": "B-roll: Wheel spinning", "isBRoll": true }
      ]
    }
  ]
}`;

            const response = await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    temperature: 0.3,
                    responseMimeType: 'application/json',
                    ...(thinkingBudget && {
                        thinkingConfig: { thinkingBudget }
                    })
                }
            });

            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON in response');

            const parsed = JSON.parse(jsonMatch[0]);

            // Calculate durations
            const result: ScriptAnalysisResult = {
                totalWords: wordCount,
                estimatedDuration: estimatedTotalDuration,
                chapters: parsed.chapters.map((ch: any, i: number) => ({
                    ...ch,
                    startIndex: 0,
                    endIndex: 0,
                    estimatedDuration: Math.ceil(estimatedTotalDuration / parsed.chapters.length)
                })),
                characters: parsed.characters || [],
                suggestedSceneCount: parsed.scenes.length +
                    parsed.scenes.reduce((sum: number, s: any) => sum + (s.expansionScenes?.length || 0), 0),
                scenes: parsed.scenes.map((s: any) => ({
                    ...s,
                    estimatedDuration: Math.ceil((s.voiceOverText.split(/\s+/).length / wpm) * 60)
                }))
            };

            setAnalysisResult(result);
            console.log('[ScriptAnalysis] ✅ Analysis complete:', result);
            return result;

        } catch (error: any) {
            console.error('[ScriptAnalysis] ❌ Error:', error);
            setAnalysisError(error.message || 'Analysis failed');
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    }, [userApiKey]);

    /**
     * Generate Scene Map from analysis result
     */
    const generateSceneMap = useCallback((
        analysis: ScriptAnalysisResult,
        director: DirectorPreset | null,
        characterStyle: CharacterStyleDefinition | null,
        existingCharacters: Character[] = []
    ): { scenes: Scene[]; groups: SceneGroup[]; newCharacters: { name: string; description: string }[]; sceneCharacterMap: Record<number, string[]> } => {

        const groups: SceneGroup[] = analysis.chapters.map(ch => {
            const outfitOverrides: Record<string, string> = {};
            // Map character name -> outfit for this chapter
            analysis.characters.forEach(c => {
                // Ensure case-insensitive or exact name match? 
                // We will use the exact name here and rely on App.tsx to resolve IDs
                if (c.outfitByChapter?.[ch.id]) {
                    outfitOverrides[c.name] = c.outfitByChapter[ch.id];
                }
            });

            return {
                id: ch.id,
                name: ch.title,
                description: ch.title,
                timeOfDay: (ch.suggestedTimeOfDay as any) || 'day',
                weather: (ch.suggestedWeather as any) || 'clear',
                outfitOverrides
            };
        });

        const scenes: Scene[] = [];
        let sceneNumber = 1;

        // Resolve character style prompts
        const stylePrompt = characterStyle?.promptInjection.global || '';
        const directorDna = director?.dna || '';
        const directorCamera = director?.signatureCameraStyle || '';

        const sceneCharacterMap: Record<number, string[]> = {};

        for (const sceneAnalysis of analysis.scenes) {
            // Main scene with VO
            const mainScene: Scene = {
                id: `scene_${sceneNumber}`,
                sceneNumber: String(sceneNumber),
                groupId: sceneAnalysis.chapterId,
                language1: '',
                vietnamese: '',
                promptName: `Scene ${sceneNumber}`,

                // VO fields
                voiceOverText: sceneAnalysis.voiceOverText,
                isVOScene: true,
                voSecondsEstimate: sceneAnalysis.estimatedDuration,

                // Visual prompt with style injection
                contextDescription: [
                    stylePrompt ? `[CHARACTER STYLE]: ${stylePrompt}` : '',
                    directorDna ? `[DIRECTOR DNA]: ${directorDna}` : '',
                    directorCamera ? `[CAMERA STYLE]: ${directorCamera}` : '',
                    sceneAnalysis.visualPrompt
                ].filter(Boolean).join('\n\n'),

                characterIds: [], // Will be mapped after character creation
                productIds: [],
                generatedImage: null,
                veoPrompt: '',
                isGenerating: false,
                error: null
            };

            // Map characters to scene index (0-based)
            sceneCharacterMap[scenes.length] = sceneAnalysis.characterNames || [];
            scenes.push(mainScene);
            sceneNumber++;

            // Expansion scenes (B-roll)
            if (sceneAnalysis.needsExpansion && sceneAnalysis.expansionScenes) {
                for (const expansion of sceneAnalysis.expansionScenes) {
                    const bRollScene: Scene = {
                        id: `scene_${sceneNumber}`,
                        sceneNumber: String(sceneNumber),
                        groupId: sceneAnalysis.chapterId,
                        language1: '',
                        vietnamese: '',
                        promptName: `B-Roll ${sceneNumber}`,

                        // B-roll has no VO
                        voiceOverText: undefined,
                        isVOScene: false,
                        referenceSceneId: mainScene.id, // Reference the VO scene

                        contextDescription: [
                            stylePrompt ? `[CHARACTER STYLE]: ${stylePrompt}` : '',
                            directorDna ? `[DIRECTOR DNA]: ${directorDna}` : '',
                            expansion.visualPrompt
                        ].filter(Boolean).join('\n\n'),

                        characterIds: [],
                        productIds: [],
                        generatedImage: null,
                        veoPrompt: '',
                        isGenerating: false,
                        error: null
                    };

                    // B-roll inherits characters from main scene? Or none?
                    // Typically B-roll is about environment or specific details.
                    // If it's a character B-roll, visualPrompt should describe it.
                    // For now, we don't auto-assign characters to B-roll to avoid clutter
                    sceneCharacterMap[scenes.length] = [];

                    scenes.push(bRollScene);
                    sceneNumber++;
                }
            }
        }

        // Identify new characters not in existing list
        const existingNames = new Set(existingCharacters.map(c => c.name.toLowerCase()));
        const newCharacters = analysis.characters
            .filter(c => !existingNames.has(c.name.toLowerCase()))
            .map(c => ({
                name: c.name,
                description: c.suggestedDescription
            }));

        return { scenes, groups, newCharacters, sceneCharacterMap };
    }, []);

    return {
        isAnalyzing,
        analysisResult,
        analysisError,
        analyzeScript,
        generateSceneMap,
        setAnalysisResult
    };
}
