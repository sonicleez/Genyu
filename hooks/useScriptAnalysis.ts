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
    locationAnchor?: string; // PHASE 2: Fixed location description for all scenes in chapter
}

export interface CharacterAnalysis {
    name: string;
    mentions: number;
    suggestedDescription: string;
    outfitByChapter: Record<string, string>; // chapterId -> outfit description
    isMain: boolean;
}

export interface SceneAnalysis {
    voiceOverText: string;      // Narration/commentary (off-screen narrator)
    dialogueText?: string;       // Character dialogue (spoken on-screen)
    dialogueSpeaker?: string;    // Who is speaking the dialogue
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

// NEW: Location Detection for shared concept art
export interface LocationAnalysis {
    id: string;
    name: string;                    // "Casino Interior"
    description: string;             // "Dark luxurious gambling hall with roulette tables..."
    keywords: string[];              // ["casino", "gambling", "luxury"]
    chapterIds: string[];            // Which chapters use this location
    sceneRanges: { start: number; end: number }[]; // Scene number ranges
    conceptPrompt: string;           // Full prompt for generating concept art
    isInterior: boolean;             // Interior vs Exterior
    timeOfDay?: string;              // Suggested time
    mood?: string;                   // Atmospheric mood
}

export interface ScriptAnalysisResult {
    totalWords: number;
    estimatedDuration: number; // total seconds
    chapters: ChapterAnalysis[];
    characters: CharacterAnalysis[];
    locations: LocationAnalysis[]; // NEW: Detected unique locations
    suggestedSceneCount: number;
    scenes: SceneAnalysis[];
    globalContext?: string; // World setting, era, tone summary from AI
}

// Words per minute for duration estimation
const WPM_SLOW = 120;
const WPM_MEDIUM = 150;
const WPM_FAST = 180;

export type AnalysisStage = 'idle' | 'preparing' | 'connecting' | 'clustering' | 'thinking' | 'post-processing' | 'finalizing';

export function useScriptAnalysis(userApiKey: string | null) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('idle');
    const [analysisResult, setAnalysisResult] = useState<ScriptAnalysisResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    /**
     * Analyze script text using AI
     */
    const analyzeScript = useCallback(async (
        scriptText: string,
        readingSpeed: 'slow' | 'medium' | 'fast' = 'medium',
        modelSelector: string = 'gemini-2.5-flash|none', // format: model|thinkingLevel
        characterStyle?: CharacterStyleDefinition | null,
        director?: DirectorPreset | null,
        researchNotes?: { director?: string; dop?: string; story?: string } | null,
        activeCharacters: { id: string; name: string; description?: string }[] = [] // New Param for auto-assignment
    ): Promise<ScriptAnalysisResult | null> => {
        if (!userApiKey) {
            setAnalysisError('API key required');
            return null;
        }

        setIsAnalyzing(true);
        setAnalysisStage('preparing');
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

            // Only apply thinking config to models that support it
            // gemini-2.5-flash does NOT support thinkingConfig
            const supportsThinking = modelName.includes('2.5-pro') || modelName.includes('thinking');
            const thinkingBudget = supportsThinking ? (thinkingBudgets[thinkingLevel] ?? undefined) : undefined;

            if (!supportsThinking && thinkingLevel !== 'none') {
                console.warn(`[ScriptAnalysis] Model ${modelName} does not support thinking mode. Ignoring thinking level: ${thinkingLevel}`);
            }

            // Context Injection
            let contextInstructions = "";

            // [New] Global Story Context - INJECT FIRST
            if (researchNotes?.story) {
                contextInstructions += `\n[GLOBAL STORY CONTEXT - MANDATORY WORLD SETTING]:\n${researchNotes.story}\n- ALL visual descriptions MUST align with this world setting. Do not hallucinate settings that contradict this context.\n`;
            }

            if (characterStyle) {
                // Check if this is a mannequin style
                const isMannequinStyle = characterStyle.id?.includes('mannequin') || characterStyle.name?.toLowerCase().includes('mannequin');
                const mannequinPrefix = isMannequinStyle ? 'Faceless white mannequin, egg-shaped head. ' : '';

                contextInstructions += `\nVISUAL STYLE CONSTRAINT: The user selected the character style "${characterStyle.name}" (${characterStyle.promptInjection.global}).\n- You MUST generate "suggestedDescription" that aligns with this style.\n${isMannequinStyle ? `- MANDATORY MANNEQUIN PREFIX: Every character's suggestedDescription MUST start with: "${mannequinPrefix}"\n` : ''}- CRITICAL: You MUST extract the SPECIFIC OUTFIT (uniforms, period clothing, colors) from the script.\n- IF SCRIPT IS VAGUE: You MUST INFER appropriate period-accurate clothing in EXTREME DETAIL.\n- TEXTURE & MATERIAL LOCK: You MUST describe textures with MICROSCOPIC DETAIL (e.g. "cracked leather with oil stains", "coarse wool with pilling", "rusted brass buttons", "frayed cotton edges").\n- FORMAT: "${mannequinPrefix}WEARING: [Detailed Outfit Description with specific textures/materials] + [Accessories/Props] + [SHOES: specific footwear]."\n- Example: "Faceless white mannequin, egg-shaped head. WEARING: A heavy, cracked vintage bomber jacket (worn leather texture), coarse grey wool trousers with mud splatters, tarnished silver cufflinks. SHOES: Brown leather oxford shoes with scuff marks."\n- COMPLETE OUTFIT MANDATORY: Every character MUST have pants/skirt AND shoes specified.\n`;
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

            // Expected Scene Count (Soft Target)
            const wordsPerScene = readingSpeed === 'slow' ? 8 : readingSpeed === 'fast' ? 12 : 10;
            const expectedSceneCount = Math.ceil(wordCount / wordsPerScene);

            // [New] Existing Character Library - Inject to avoid duplicates
            if (activeCharacters && activeCharacters.length > 0) {
                const charList = activeCharacters.map(c => `- ${c.name}: ${c.description || 'No description'}`).join('\n');
                contextInstructions += `\n[EXISTING CHARACTER LIBRARY - MANDATORY REUSE]:\n${charList}\n- CRITICAL: If the script refers to any of these characters (by name or context), you MUST reuse their exact name. Do NOT create new entries for them in the "characters" JSON array unless they are truly new characters not found in this list.\n`;
            }

            // ═══════════════════════════════════════════════════════════════
            // STEP 1: VISUAL CLUSTERING (The "Director's Thinking" Phase)
            // ═══════════════════════════════════════════════════════════════
            setAnalysisStage('clustering'); // New Stage

            const clusteringSystemPrompt = `
*** CRITICAL ROLE: VISUAL DIRECTOR ***
You are NOT a text splitter. You are a CINEMATIC ADAPTER.
Your job is to read the raw input and restructure it into VISUAL BLOCKS (Shots).

*** BEAT DETECTION (CRITICAL - DO NOT SKIP IMPORTANT ACTIONS) ***
Each of these patterns MUST become its OWN separate shot:

1. **NUMBER + ACTION**: Any sentence with a significant number AND an action verb.
   - "60 đặc vụ liên bang bao vây trung tâm giam giữ" → SEPARATE SHOT (important action!)
   - "400,000 euros trước khi casino cấm" → SEPARATE SHOT (dramatic number!)

2. **DRAMATIC VERBS**: These verbs ALWAYS create a new visual beat:
   - Vietnamese: bao vây, tấn công, nổ súng, chết, giết, đấm, đá, chạy, bắt, trốn, cháy
   - English: surround, attack, shoot, die, kill, punch, kick, run, arrest, escape, burn

3. **ESTABLISHING vs ACTION**: Time/Location MUST be SEPARATE from the action that follows.
   - "Tháng 3 năm 2013, Baltimore." → Shot 1: Establishing (city/date)
   - "60 đặc vụ bao vây trung tâm giam giữ." → Shot 2: Action (agents surrounding)
   - These are TWO shots, NOT one!

*** ALGORITHM (THE GOLDEN RULES) ***
1. **SCAN**: Read the input text.
2. **DETECT BEATS**: Identify each distinct visual moment using rules above.
3. **MERGE ONLY DESCRIPTIONS**: Only merge adjectives/materials with their subject.
   - "A mask. White ceramic. Long beak." → ONE shot (describing same object)
   - "A mask. He picks it up." → TWO shots (describing, then action!)
4. **VO TRACKING**: You MUST keep track of which part of the text corresponds to which visual.

*** ANTI-SKIP RULE ***
If a sentence contains DRAMATIC content (violence, numbers, key actions), it MUST have its own visual.
Do NOT hide important actions inside B-rolls. They need to be MAIN scenes.
            `;

            const clusteringUserPrompt = `
Analyze and REWRITE the following voice-over script into a list of "VISUAL SHOTS".
Don't worry about JSON format yet. Just simple text blocks.

INPUT SCRIPT:
"""
${scriptText}
"""

OUTPUT FORMAT:
- Shot 1: [Visual Description] (Covers text: "...")
- Shot 2: [Visual Description] (Covers text: "...")
...
            `;

            // Call Step 1 (Clustering)
            // Use gemini-2.5-flash for speed if not generating JSON
            const clusteringResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: clusteringSystemPrompt + "\n\n" + clusteringUserPrompt }] }]
            });
            const visualPlan = clusteringResponse.text || '';
            console.log('[ScriptAnalysis] 🧠 Visual Plan:', visualPlan);


            // ═══════════════════════════════════════════════════════════════
            // STEP 2: JSON GENERATION (The "DOP's Execution" Phase)
            // ═══════════════════════════════════════════════════════════════
            setAnalysisStage('thinking'); // Transition to JSON generation

            const prompt = `Analyze this voice-over script and the Director's Visual Plan to generate the final Production Script JSON.

=== ORIGINAL SCRIPT ===
"""
${scriptText}
"""

=== DIRECTOR'S VISUAL PLAN (Follow this segmentation) ===
"""
${visualPlan}
"""

TASK:
1. Use the "Director's Visual Plan" as the SOURCE TRUTH for scene segmentation.
2. Map the original script text (Voice Over) to these visual scenes.
   - CRITICAL: Every Main Scene MUST have \`voiceOverText\`.
   - The \`voiceOverText\` must be the EXACT segment of the original script that corresponds to this visual.
   - DO NOT LEAVE \`voiceOverText\` EMPTY.
3. Extract Characters, Locations, and Chapters as usual.

CRITICAL - LOCATION ANCHOR RULE:
- Each chapter MUST define a "locationAnchor" - a DETAILED, FIXED environment description
- ALL scenes in that chapter MUST visually exist in this EXACT location
- Format: "Interior/Exterior, [specific place], [decade], [architectural style], [lighting], [key props]"

VISUAL PROMPT FORMAT:
"[SHOT TYPE]. [Cinematic Purpose]. [Spatial View/Axis]. [Location from locationAnchor]. [Subject/Characters]. [Action]. [Mood]."
- SHOT TYPES: WIDE SHOT, MEDIUM SHOT, CLOSE-UP, EXTREME CLOSE-UP, POV
- SPATIAL ROTATION: For every scene, describe the view from a DIFFERENT AXIS or angle.

CRITICAL - DURATION & COVERAGE (B-ROLL LOGIC):
- Merged scenes may have long Voice-Over text.
- IF a scene's \`voiceOverText\` is > 15 words, you MUST generate \`expansionScenes\` (1-3 shots depending on length).

CRITICAL - VISUAL VARIETY (THE BBC 5-SHOT RULE):
When creating B-Rolls, you MUST strictly follow the "5-Shot Coverage" principle to ensure editable footage.
For every Main Shot, generate B-Rolls that are **DIFFERENT** types from this list:
  1. **CU HANDS/ACTION:** Close-up of what is being done (hands, mechanism, details).
  2. **CU FACE:** Close-up of the character's eyes/reaction.
  3. **WIDE SHOT:** Establishing where they are (Context).
  4. **OTS (Over The Shoulder):** Looking at what they see (Relational).
  5. **CREATIVE ANGLE:** Low angle, high angle, or unusual perspective.

CRITICAL - SUBJECT & TEMPORAL LOCK (The Key to Logical B-Rolls):
- **Problem:** AI often generates B-Rolls that drift into new actions.
- **Rule:** A B-Roll happens at the **EXACT SAME MOMENT** as the Main Scene.
- **SUBJECT LOCK:** If Main Scene is "Man looking at Mask", B-Roll MUST be "Close-up of Man's Eyes" or "Close-up of Mask details". It CANNOT be "Man walking away".
- **ACTION LOCK:** **NO NEW ACTIONS** in B-Rolls. Only *different views* of the *current action*.
- **Consistency:** B-Rolls are for *coverage*, not advancing the plot.

ALGORITHM for B-Rolls:
- If Main Scene is **WIDE SHOT/ESTABLISHING**, B-Roll MUST be **CU DETAILS** (Face/Hands/Object) to show what is important.
- If Main Scene is **CLOSE-UP/DETAIL**, B-Roll MUST be **WIDE SHOT** (Context) or **OTS** to show where it is happening.
- NEVER repeat the same shot type.

${contextInstructions}

RESPOND WITH JSON ONLY:
{
  "globalContext": "Detailed summary of world, era, setting...",
  "locations": [
    {
      "id": "loc_casino",
      "name": "Casino Interior",
      "description": "Dark luxurious 1940s gambling hall...",
      "keywords": ["casino", "gambling"],
      "chapterIds": ["chapter_1"],
      "isInterior": true,
      "timeOfDay": "night",
      "mood": "tense",
      "conceptPrompt": "WIDE SHOT establishing..."
    }
  ],
  "chapters": [
    {
      "id": "chapter_1",
      "title": "Chapter Title",
      "suggestedTimeOfDay": "night",
      "suggestedWeather": "clear",
      "locationAnchor": "Interior, 1940s Monte Carlo casino...",
      "locationId": "loc_casino"
    }
  ],
  "characters": [
    {
      "name": "Étienne Marchand",
      "mentions": 5,
      "suggestedDescription": "Faceless white mannequin...",
      "outfitByChapter": { "chapter_1": "suit..." },
      "isMain": true
    }
  ],
  "scenes": [
    {
      "voiceOverText": "Segment of original text for this shot...",
      "dialogueText": "Any dialogue...",
      "dialogueSpeaker": "Speaker Name",
      "visualPrompt": "WIDE SHOT. Casino. Étienne stands...",
      "chapterId": "chapter_1",
      "characterNames": ["Étienne Marchand"],
      "needsExpansion": false
    }
  ]
}`;

            setAnalysisStage('connecting');
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    temperature: 0.3,
                    responseMimeType: 'application/json',
                    maxOutputTokens: 65536,
                    ...(thinkingBudget && {
                        thinkingConfig: { thinkingBudget }
                    })
                }
            });

            setAnalysisStage('post-processing');
            const text = response.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON in response');

            const parsed = JSON.parse(jsonMatch[0]);

            // Calculate durations and finalize
            const result: ScriptAnalysisResult = {
                totalWords: wordCount,
                estimatedDuration: estimatedTotalDuration,
                chapters: (parsed.chapters || []).map((ch: any) => ({
                    ...ch,
                    startIndex: 0,
                    endIndex: 0,
                    estimatedDuration: Math.ceil(estimatedTotalDuration / (parsed.chapters?.length || 1))
                })),
                characters: parsed.characters || [],
                locations: (parsed.locations || []).map((loc: any) => ({
                    ...loc,
                    sceneRanges: loc.sceneRanges || []
                })),
                suggestedSceneCount: parsed.scenes.length,
                scenes: parsed.scenes.map((s: any) => ({
                    ...s,
                    estimatedDuration: Math.ceil(((s.voiceOverText || '').split(/\s+/).length / wpm) * 60)
                })),
                globalContext: parsed.globalContext
            };

            // Log detected locations
            if (result.locations.length > 0) {
                console.log(`[ScriptAnalysis] 📍 Detected ${result.locations.length} unique locations:`,
                    result.locations.map(l => l.name).join(', '));
            }

            setAnalysisStage('finalizing');
            setAnalysisResult(result);
            console.log('[ScriptAnalysis] ✅ Analysis complete:', result);
            return result;

        } catch (error: any) {
            console.error('[ScriptAnalysis] ❌ Error:', error);
            setAnalysisError(error.message || 'Analysis failed');
            return null;
        } finally {
            setIsAnalyzing(false);
            setAnalysisStage('idle');
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

        // Create chapter ID -> locationAnchor map for quick lookup
        const chapterLocationMap: Record<string, string> = {};
        analysis.chapters.forEach(ch => {
            chapterLocationMap[ch.id] = ch.locationAnchor || '';
        });

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
                // PHASE 2: Store locationAnchor in description for concept image reference
                description: ch.locationAnchor || ch.title,
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
            // PHASE 2: Get locationAnchor for this scene's chapter
            const locationAnchor = chapterLocationMap[sceneAnalysis.chapterId] || '';

            // Main scene with VO
            const mainScene: Scene = {
                id: `scene_${sceneNumber}`,
                sceneNumber: String(sceneNumber),
                groupId: sceneAnalysis.chapterId,

                // Dialogue - if AI detected dialogue, format it with speaker
                language1: sceneAnalysis.dialogueText
                    ? (sceneAnalysis.dialogueSpeaker
                        ? `${sceneAnalysis.dialogueSpeaker}: ${sceneAnalysis.dialogueText}`
                        : sceneAnalysis.dialogueText)
                    : '',
                vietnamese: '', // Secondary language empty by default

                promptName: `Scene ${sceneNumber}`,

                // VO fields - narration text
                voiceOverText: sceneAnalysis.voiceOverText,
                isVOScene: Boolean(sceneAnalysis.voiceOverText),
                isDialogueScene: Boolean(sceneAnalysis.dialogueText && sceneAnalysis.dialogueSpeaker),
                voSecondsEstimate: sceneAnalysis.estimatedDuration,

                // PHASE 2: Visual prompt with LOCATION ANCHOR injection
                contextDescription: [
                    locationAnchor ? `[LOCATION ANCHOR - MANDATORY]: ${locationAnchor}` : '',
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
            // Map characters to scene index (0-based)
            sceneCharacterMap[scenes.length] = sceneAnalysis.characterNames || [];

            // AUTO-ASSIGN EXISTING CHARACTERS
            if (existingCharacters && existingCharacters.length > 0) {
                const foundIds: string[] = [];
                const namesInScene = (sceneAnalysis.characterNames || []).map((n: string) => n.toLowerCase());

                existingCharacters.forEach(char => {
                    const charName = char.name.toLowerCase();
                    // Check for full match or partial match (e.g. "John" in "John Doe")
                    const isMatch = namesInScene.some((n: string) =>
                        charName.includes(n) || n.includes(charName) ||
                        (char.description && char.description.toLowerCase().includes(n))
                    );
                    if (isMatch) {
                        foundIds.push(char.id);
                    }
                });
                mainScene.characterIds = foundIds;
            }

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

                        // PHASE 3: B-roll inherits locationAnchor from parent scene
                        contextDescription: [
                            locationAnchor ? `[LOCATION ANCHOR - MANDATORY]: ${locationAnchor}` : '',
                            `[B-ROLL FOR SCENE ${sceneNumber - 1}]: Match environment from parent scene`,
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
        analysisStage,
        analysisResult,
        analysisError,
        analyzeScript,
        generateSceneMap,
        setAnalysisResult
    };
}
