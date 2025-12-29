/**
 * Character Style System - Extensible Architecture
 * 
 * Allows enforcing visual consistency across ALL characters in a project.
 * Built-in styles: faceless, silhouette, anime, noir
 * Users can create custom styles that extend built-in ones.
 */

import { CharacterStyleDefinition, CharacterStyleCategory } from '../types';

// Re-export for convenience
export type { CharacterStyleDefinition, CharacterStyleCategory } from '../types';

/**
 * Built-in Character Styles
 */
export const BUILT_IN_CHARACTER_STYLES: CharacterStyleDefinition[] = [
    // === FACELESS CATEGORY ===
    {
        id: 'faceless-mannequin',
        name: 'Faceless Mannequin',
        category: 'faceless',
        promptInjection: {
            global: `FACELESS DOCUMENTARY STYLE - STRICT MANNEQUIN PROTOCOL:
1. HEAD: ALL human figures must have smooth, featureless white mannequin heads made of MATTE WHITE PLASTIC/RESIN. ABSOLUTELY NO eyes, NO nose, NO mouth, NO ears, NO hair texture, NO facial features whatsoever. Clean egg-shaped oval white head like a department store display mannequin. The head surface must be uniform smooth white with NO indentations or shadows suggesting facial features.
2. HANDS: Grey or white mannequin hands, smooth plastic material, articulated at joints like display mannequin hands.
3. MATERIAL CONSISTENCY: Head, neck, and hands must all be the same smooth matte white/grey plastic material throughout. No skin tones, no flesh texture.
4. COMPLETE OUTFIT MANDATORY: Every character must be FULLY CLOTHED from head to toe. This includes: shirt/top, pants/skirt/dress, SHOES (mandatory - no bare feet), and any accessories mentioned in the description. If shoes are not specified, add appropriate footwear for the outfit.
5. APPLIES TO ALL: This applies to EVERY human - main characters AND background people, crowds, extras. Differentiate characters ONLY by clothing, body language, and positioning.`,
            character: `[FACELESS MANNEQUIN CHARACTER]: This character has a smooth white plastic mannequin head with ZERO facial features - no eyes, no nose, no mouth, no ears. Head is a perfect smooth white oval. Hands are grey/white mannequin hands. Character MUST be fully clothed including SHOES. Identify them by their detailed clothing, posture, and accessories only.`,
            negative: `NO real human faces, NO eyes, NO nose, NO mouth, NO ears, NO eyebrows, NO facial expressions, NO photorealistic faces on ANY character including background crowds and extras. NO partial faces, NO face shadows suggesting features. NO bare feet, NO missing pants, NO missing shoes, NO incomplete outfits. ALL humans must be complete department store mannequins with full outfits and footwear.`
        },
        isBuiltIn: true,
        tags: ['documentary', 'anonymous', 'privacy', 'reenactment'],
        description: 'All characters have smooth white mannequin-style blank faces with complete outfits',
        icon: '👤'
    },
    {
        id: 'faceless-silhouette',
        name: 'Shadow Silhouette',
        category: 'faceless',
        promptInjection: {
            global: `SILHOUETTE MODE: All human figures appear as dark backlit silhouettes against brighter backgrounds. No visible facial details. Strong rim lighting from behind. Dramatic noir-style shadows.`,
            character: `[SILHOUETTE]: Character appears as a dark shadow figure, backlit, with no visible facial features. Only outline and body shape visible.`,
            negative: `NO visible faces, NO front lighting on faces, NO detailed facial features, NO clear face visibility`
        },
        isBuiltIn: true,
        tags: ['noir', 'mystery', 'crime', 'thriller'],
        description: 'Characters shown as dark backlit silhouettes',
        icon: '🌑'
    },
    {
        id: 'faceless-blur',
        name: 'Motion Blur Face',
        category: 'faceless',
        promptInjection: {
            global: `BLURRED IDENTITY: All human faces are obscured by motion blur or camera out-of-focus effect. Bodies and clothing remain sharp but faces are intentionally blurred or smeared.`,
            character: `[BLURRED]: Character's face is motion-blurred or out of focus, identity obscured while body remains sharp.`,
            negative: `NO clear faces, NO sharp facial features, NO identifiable faces`
        },
        isBuiltIn: true,
        tags: ['documentary', 'privacy', 'anonymous'],
        description: 'Faces obscured by motion blur or focus effect',
        icon: '😶'
    },

    // === STYLIZED CATEGORY ===
    {
        id: 'anime-consistent',
        name: 'Anime Consistent',
        category: 'stylized',
        promptInjection: {
            global: `ANIME STYLE: All characters drawn in consistent anime art style. Large expressive eyes, simplified but recognizable features, vibrant hair colors, clean linework, 2D aesthetic.`,
            character: `[ANIME]: Character in anime style with distinctive hair color, large expressive eyes, and stylized features.`,
            negative: `NO photorealistic, NO 3D render, NO western cartoon style, NO uncanny valley, NO hyperrealistic`
        },
        isBuiltIn: true,
        tags: ['anime', 'manga', 'japanese', 'animation'],
        description: 'Consistent anime art style for all characters',
        icon: '🎌'
    },
    {
        id: 'noir-shadow',
        name: 'Film Noir',
        category: 'stylized',
        promptInjection: {
            global: `FILM NOIR AESTHETIC: High contrast black and white or very desaturated. Dramatic shadows cutting across faces. Venetian blind lighting patterns. 1940s noir cinematography. Hard shadows, low-key lighting.`,
            character: `[NOIR]: Character lit with dramatic side lighting, half face in deep shadow, mysterious atmosphere, hard shadows.`,
            negative: `NO bright colors, NO flat lighting, NO modern look, NO even lighting, NO soft shadows`
        },
        isBuiltIn: true,
        tags: ['noir', 'detective', 'vintage', '1940s', 'mystery'],
        description: '1940s film noir aesthetic with dramatic shadows',
        icon: '🎬'
    },
    {
        id: 'painterly',
        name: 'Painterly Art',
        category: 'stylized',
        promptInjection: {
            global: `PAINTERLY STYLE: All elements rendered in classical oil painting aesthetic. Visible brushstrokes, rich textures, Renaissance-inspired lighting, artistic interpretation over photorealism.`,
            character: `[PAINTED]: Character rendered as if in a classical painting, with artistic brushwork and warm tones.`,
            negative: `NO photorealistic, NO flat digital look, NO CGI appearance, NO sharp digital edges`
        },
        isBuiltIn: true,
        tags: ['art', 'painting', 'classical', 'artistic'],
        description: 'Classical painting style with visible brushstrokes',
        icon: '🎨'
    },

    // === REALISTIC CATEGORY ===
    {
        id: 'realistic-cinematic',
        name: 'Cinematic Realistic',
        category: 'realistic',
        promptInjection: {
            global: `CINEMATIC REALISM: Photorealistic rendering with cinematic color grading. Natural skin textures, realistic lighting, film-quality depth of field. Professional movie production quality.`,
            character: `[REALISTIC]: Character rendered photorealistically with natural skin, realistic proportions, and cinematic lighting.`,
            negative: `NO cartoon, NO anime, NO stylized, NO uncanny valley, NO plastic skin`
        },
        isBuiltIn: true,
        tags: ['realistic', 'cinematic', 'film', 'movie'],
        description: 'Photorealistic cinematic quality',
        icon: '🎥'
    }
];

/**
 * Get a style by ID (searches built-in and custom)
 */
export function getCharacterStyleById(
    styleId: string,
    customStyles: CharacterStyleDefinition[] = []
): CharacterStyleDefinition | undefined {
    const allStyles = [...BUILT_IN_CHARACTER_STYLES, ...customStyles];
    return allStyles.find(s => s.id === styleId);
}

/**
 * Resolve style with inheritance
 * If a style extends another, merge their prompt injections
 */
export function resolveStyleWithInheritance(
    styleId: string,
    customStyles: CharacterStyleDefinition[] = []
): CharacterStyleDefinition | undefined {
    const style = getCharacterStyleById(styleId, customStyles);
    if (!style) return undefined;

    if (style.extendsStyleId) {
        const parent = resolveStyleWithInheritance(style.extendsStyleId, customStyles);
        if (parent) {
            return {
                ...style,
                promptInjection: {
                    global: `${parent.promptInjection.global}\n\n${style.promptInjection.global}`,
                    character: style.promptInjection.character.includes('{{INHERITED}}')
                        ? style.promptInjection.character.replace('{{INHERITED}}', parent.promptInjection.character)
                        : `${parent.promptInjection.character} ${style.promptInjection.character}`,
                    negative: `${parent.promptInjection.negative}, ${style.promptInjection.negative}`
                }
            };
        }
    }

    return style;
}

/**
 * Get all styles grouped by category
 */
export function getStylesByCategory(
    customStyles: CharacterStyleDefinition[] = []
): Record<CharacterStyleCategory, CharacterStyleDefinition[]> {
    const allStyles = [...BUILT_IN_CHARACTER_STYLES, ...customStyles];

    return {
        faceless: allStyles.filter(s => s.category === 'faceless'),
        stylized: allStyles.filter(s => s.category === 'stylized'),
        realistic: allStyles.filter(s => s.category === 'realistic'),
        custom: allStyles.filter(s => s.category === 'custom')
    };
}
