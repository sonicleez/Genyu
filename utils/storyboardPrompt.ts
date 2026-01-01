import { Scene, Character, ProjectState } from '../types';
import { DIRECTOR_PRESETS } from '../constants/directors';
import { getGridLayout } from './imageSplitter';

interface StoryboardPromptResult {
    textPrompt: string;
    parts: { text?: string; inlineData?: { data: string; mimeType: string } }[];
}

/**
 * Build a comprehensive storyboard prompt with character references
 * Returns both text prompt and image parts for API call
 * @param previousBatchImage - Last image from previous batch for continuity (optional)
 */
export async function buildStoryboardPromptWithRefs(
    scenes: Scene[],
    state: ProjectState,
    safeGetImageData: (url: string) => Promise<{ data: string; mimeType: string } | null>,
    previousBatchImage?: string // NEW: For cross-batch reference
): Promise<StoryboardPromptResult> {
    const panelCount = Math.min(scenes.length, 4);
    const { cols, rows } = getGridLayout(panelCount);
    const parts: StoryboardPromptResult['parts'] = [];

    // 1. STYLE INJECTION
    const allDirectors = [...Object.values(DIRECTOR_PRESETS).flat(), ...(state.customDirectors || [])];
    const activeDirector = state.activeDirectorId
        ? allDirectors.find(d => d.id === state.activeDirectorId)
        : null;

    let styleInstruction = '';
    if (activeDirector) {
        styleInstruction = `DIRECTOR STYLE: ${activeDirector.name}. ${activeDirector.dna}`;
    }
    if (state.customMetaTokens) {
        styleInstruction += ` META: ${state.customMetaTokens}`;
    }

    // 2. CHARACTER REFERENCES - Inject face/body images
    const allCharacterIds = new Set<string>();
    scenes.forEach(s => {
        console.log(`[Storyboard] Scene ${s.sceneNumber} characterIds:`, s.characterIds);
        s.characterIds?.forEach(id => allCharacterIds.add(id));
    });

    console.log('[Storyboard] All character IDs from batch:', Array.from(allCharacterIds));
    const selectedChars = state.characters.filter(c => allCharacterIds.has(c.id));
    console.log('[Storyboard] Selected characters:', selectedChars.map(c => ({
        name: c.name,
        hasFace: !!c.faceImage,
        hasBody: !!c.bodyImage,
        hasMaster: !!c.masterImage
    })));

    let charImagesInjected = 0;
    for (const char of selectedChars) {
        if (char.faceImage) {
            const imgData = await safeGetImageData(char.faceImage);
            if (imgData) {
                parts.push({
                    text: `[CHARACTER: ${char.name}] - This is the ONLY valid face for ${char.name}. MUST appear identical in ALL panels.`
                });
                parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                charImagesInjected++;
                console.log(`[Storyboard] ✅ Injected face image for ${char.name}`);
            } else {
                console.warn(`[Storyboard] ⚠️ Failed to load face image for ${char.name}`);
            }
        }
        if (char.bodyImage || char.masterImage) {
            const imgData = await safeGetImageData(char.bodyImage || char.masterImage || '');
            if (imgData) {
                parts.push({
                    text: `[COSTUME: ${char.name}] - Match clothing, colors, and outfit exactly in ALL panels.`
                });
                parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                charImagesInjected++;
                console.log(`[Storyboard] ✅ Injected body/master image for ${char.name}`);
            }
        }
    }

    if (charImagesInjected === 0 && selectedChars.length > 0) {
        console.warn('[Storyboard] ⚠️ Characters found but NO images available. Generate Face/Body sheets first!');
    } else if (selectedChars.length === 0) {
        console.warn('[Storyboard] ⚠️ No characters assigned to these scenes. Add characters to scenes first!');
    }

    // 3. CUSTOM STYLE IMAGE
    if (state.stylePrompt === 'custom' && state.customStyleImage) {
        const styleImg = await safeGetImageData(state.customStyleImage);
        if (styleImg) {
            parts.push({
                text: `[STYLE REFERENCE] - Match the artistic style, color grading, and lighting of this image across ALL panels.`
            });
            parts.push({ inlineData: { data: styleImg.data, mimeType: styleImg.mimeType } });
        }
    }

    // 5. PREVIOUS BATCH REFERENCE (for cross-batch continuity)
    if (previousBatchImage) {
        const prevImg = await safeGetImageData(previousBatchImage);
        if (prevImg) {
            parts.push({
                text: `[CONTINUITY ANCHOR] - This is the LAST image from the previous batch. Match the style, characters, and environment EXACTLY to maintain continuity.`
            });
            parts.push({ inlineData: { data: prevImg.data, mimeType: prevImg.mimeType } });
        }
    }

    // 6. PANEL DESCRIPTIONS (dynamic based on panel count)
    const positionLabels: Record<number, string[]> = {
        1: ['center'],
        2: ['left', 'right'],
        3: ['left', 'center', 'right'],
        4: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
    };
    const positions = positionLabels[panelCount] || positionLabels[4];

    const panelDescriptions = scenes.slice(0, panelCount).map((scene, i) => {
        const position = positions[i];
        const description = scene.contextDescription || scene.language1 || `Scene ${scene.sceneNumber}`;
        const charNames = state.characters
            .filter(c => scene.characterIds?.includes(c.id))
            .map(c => c.name)
            .join(', ');

        return `Panel ${i + 1} (${position}): ${description}${charNames ? ` [Characters: ${charNames}]` : ''}`;
    }).join('\n\n');

    // 7. DYNAMIC GRID LAYOUT INSTRUCTION
    const gridDesc = panelCount === 1
        ? 'a SINGLE IMAGE (full frame)'
        : panelCount === 2
            ? '2 PANELS side by side (1x2 horizontal strip)'
            : panelCount === 3
                ? '3 PANELS in a row (1x3 horizontal strip)'
                : '4 PANELS in a 2x2 grid';

    // 8. FINAL TEXT PROMPT
    const textPrompt = `CREATE A ${panelCount}-PANEL STORYBOARD IMAGE (${cols}x${rows} layout).

${styleInstruction}

LAYOUT REQUIREMENTS:
- Single image containing ${panelCount} DISTINCT PANELS as ${gridDesc}
- Each panel separated by thin black borders (2-3px)
- Each panel is a SEPARATE shot/moment

STRICT CONSISTENCY RULES:
- Character faces MUST be IDENTICAL across all panels (use provided face references)
- Clothing/costume MUST be IDENTICAL across all panels (use provided body references)
- Lighting conditions MUST be CONSISTENT
- Color grading MUST be CONSISTENT
- Environment/location MUST be THE SAME
${previousBatchImage ? '- MATCH the continuity anchor image for style and characters' : ''}

PANEL CONTENTS:
${panelDescriptions}

CRITICAL: This is ONE IMAGE with ${panelCount} sub-panels, NOT ${panelCount} separate images.`;

    parts.push({ text: textPrompt });

    return { textPrompt, parts };
}

/**
 * Simple text-only prompt for fallback
 */
export function buildStoryboardPrompt(scenes: Scene[]): string {
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const maxScenes = Math.min(scenes.length, 4);

    const panelDescriptions = scenes.slice(0, maxScenes).map((scene, i) => {
        const position = positions[i];
        const description = scene.contextDescription || scene.language1 || `Scene ${scene.sceneNumber}`;
        return `Panel ${i + 1} (${position}): ${description}`;
    }).join('\n\n');

    return `Create a 4-panel storyboard in a 2x2 grid format.
Each panel must be clearly separated with thin black borders (2px).
Maintain STRICT CONSISTENCY across all panels:
- Same characters (face, body, clothing)
- Same lighting conditions
- Same color grading
- Same environment/location
- Only camera angle and action changes between panels

${panelDescriptions}

CRITICAL REQUIREMENTS:
1. All 4 panels share the SAME scene location and characters
2. Character identity must be IDENTICAL across all panels
3. Lighting and color palette must be CONSISTENT
4. Each panel shows a different moment/angle of the same scene`;
}
