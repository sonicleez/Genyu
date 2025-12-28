/**
 * useSequenceExpansion
 * 
 * Hook for AI-powered sequence expansion.
 * Expands a single VO scene into multiple sub-scenes with:
 * - Director Agent: Emotional beats + story progression
 * - DOP Agent: Camera progression (Wide → Medium → Close-Up)
 */

import { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Scene } from '../types';

export interface SubSceneProposal {
    contextDescription: string;
    emotionalBeat: string;
    cameraProgression: string;
    suggestedAngle: string;
    suggestedLens: string;
    duration: number; // seconds
}

export interface SequenceExpansionResult {
    subScenes: SubSceneProposal[];
    totalDuration: number;
    directorRationale: string;
    dopRationale: string;
}

interface UseSequenceExpansionReturn {
    isExpanding: boolean;
    expansionResult: SequenceExpansionResult | null;
    expansionError: string | null;
    expandSequence: (
        voText: string,
        estimatedDuration: number,
        directorNotes?: string,
        dopNotes?: string,
        readingSpeed?: 'slow' | 'medium' | 'fast'
    ) => Promise<SequenceExpansionResult | null>;
    clearResult: () => void;
}

export function useSequenceExpansion(userApiKey: string | null): UseSequenceExpansionReturn {
    const [isExpanding, setIsExpanding] = useState(false);
    const [expansionResult, setExpansionResult] = useState<SequenceExpansionResult | null>(null);
    const [expansionError, setExpansionError] = useState<string | null>(null);

    const expandSequence = useCallback(async (
        voText: string,
        estimatedDuration: number,
        directorNotes?: string,
        dopNotes?: string,
        readingSpeed: 'slow' | 'medium' | 'fast' = 'medium'
    ): Promise<SequenceExpansionResult | null> => {
        if (!userApiKey) {
            setExpansionError('API key required');
            return null;
        }

        setIsExpanding(true);
        setExpansionError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: userApiKey });

            // Calculate number of sub-scenes based on timing formula
            const secondsPerScene = readingSpeed === 'fast' ? 3 : 4;
            const subSceneCount = Math.max(2, Math.min(5, Math.ceil(estimatedDuration / secondsPerScene)));

            // Camera progression templates based on scene count
            const cameraProgressions: Record<number, string[]> = {
                2: ['Wide establishing shot', 'Close-up emotional beat'],
                3: ['Wide establishing shot', 'Medium shot action', 'Close-up emotional climax'],
                4: ['Wide establishing shot', 'Medium-wide transitional', 'Medium shot action', 'Close-up emotional climax'],
                5: ['Wide establishing shot', 'Medium-wide context', 'Medium shot action', 'Medium close-up reaction', 'Extreme close-up emotional climax']
            };

            const prompt = `You are a DUAL-AGENT SYSTEM: a Director and a DOP working together.

VOICE-OVER TEXT:
"${voText}"

DURATION: ${estimatedDuration} seconds
SUB-SCENES NEEDED: ${subSceneCount}

${directorNotes ? `[USER DIRECTOR NOTES - MANDATORY]:\n${directorNotes}\n` : ''}
${dopNotes ? `[USER DOP NOTES - MANDATORY]:\n${dopNotes}\n` : ''}

TASK:
1. DIRECTOR AGENT: Break this VO into ${subSceneCount} sequential emotional beats
   - Each beat should progress the narrative naturally
   - Consider pacing: start slower, build tension, climax
   
2. DOP AGENT: Assign camera work for each sub-scene
   - Follow "escalation rule": Wide → Medium → Close-Up
   - Suggested progression: ${cameraProgressions[subSceneCount]?.join(' → ') || 'Wide → Medium → Close-Up'}
   - Consider lighting and lens choices

RESPOND WITH JSON ONLY:
{
  "directorRationale": "Brief explanation of the emotional arc",
  "dopRationale": "Brief explanation of camera progression choices",
  "subScenes": [
    {
      "contextDescription": "Visual description of what's happening",
      "emotionalBeat": "Emotional purpose (e.g., 'Curiosity', 'Rising tension')",
      "cameraProgression": "Camera instruction (e.g., 'Wide establishing shot')",
      "suggestedAngle": "WIDE|MEDIUM_WIDE|MEDIUM|MEDIUM_CLOSE|CLOSE_UP|EXTREME_CLOSE",
      "suggestedLens": "35mm|50mm|85mm|24mm",
      "duration": ${Math.floor(estimatedDuration / subSceneCount)}
    }
    // ... ${subSceneCount} entries total
  ]
}`;

            console.log('[SequenceExpansion] 🎬 Calling AI with prompt for', subSceneCount, 'sub-scenes');

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt
            });

            // Extract text from response
            let responseText = '';
            try {
                const candidate = response.candidates?.[0];
                const textPart = candidate?.content?.parts?.find((p: any) => p.text);
                responseText = textPart?.text || '';
            } catch (e) {
                console.error('Failed to extract text from response:', e);
            }

            if (!responseText) {
                throw new Error('Không nhận được kết quả từ AI');
            }

            // Parse JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Không tìm thấy JSON trong response');
            }

            const parsedResult = JSON.parse(jsonMatch[0]) as SequenceExpansionResult;
            parsedResult.totalDuration = estimatedDuration;

            console.log('[SequenceExpansion] ✅ Parsed result:', parsedResult.subScenes.length, 'sub-scenes');
            setExpansionResult(parsedResult);
            return parsedResult;

        } catch (err: any) {
            console.error('[SequenceExpansion] ❌ Expansion failed:', err);
            setExpansionError(err.message || 'Failed to expand sequence');
            return null;
        } finally {
            setIsExpanding(false);
        }
    }, [userApiKey]);

    const clearResult = useCallback(() => {
        setExpansionResult(null);
        setExpansionError(null);
    }, []);

    return {
        isExpanding,
        expansionResult,
        expansionError,
        expandSequence,
        clearResult
    };
}
