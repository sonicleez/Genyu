export const slugify = (text: string): string => {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
};

export const downloadImage = (base64Image: string, filename: string) => {
    if (!base64Image) return;
    const link = document.createElement('a');
    link.href = base64Image;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const cleanToken = (t: string) => {
    if (!t) return "";
    if (t.includes('session-token=')) {
        return t.split('session-token=')[1].split(';')[0].trim();
    }
    return t.trim();
};

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const detectCharactersInText = (text: string, characters: { id: string, name: string }[]): string[] => {
    if (!text) return [];
    const detectedIds: string[] = [];

    characters.forEach(char => {
        if (!char.name) return;
        // Escape special characters in name
        const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Use Unicode property escapes for start/end boundaries
        // (?<!\p{L}) ensures no letter precedes
        // (?!\p{L}) ensures no letter follows
        // Requires 'u' flag
        try {
            // Standard word boundary behavior but Unicode-aware (\p{L} = Letters, \p{N} = Numbers)
            const regex = new RegExp(`(?<![\\p{L}\\p{N}_])${escapedName}(?![\\p{L}\\p{N}_])`, 'gui');
            if (regex.test(text)) {
                detectedIds.push(char.id);
            }
        } catch (e) {
            // Fallback for environments that don't support Unicode property escapes fully
            const fallbackRegex = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapedName}(?:$|[^\\p{L}\\p{N}_])`, 'gui');
            if (fallbackRegex.test(text)) {
                detectedIds.push(char.id);
            }
        }
    });

    return [...new Set(detectedIds)];
};
