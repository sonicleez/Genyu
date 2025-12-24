import { ScriptPreset, Character, Product } from '../types';

/**
 * Build AI prompt for script generation based on selected preset
 */
export function buildScriptPrompt(
    userIdea: string,
    preset: ScriptPreset,
    characters: Character[],
    products: Product[],
    sceneCount: number,
    language: string,
    customInstruction?: string
): string {
    // Filter characters with names
    const availableCharacters = characters
        .filter(c => c.name.trim() !== '')
        .map(c => ({ name: c.name, id: c.id, description: c.description }));

    const characterListString = availableCharacters.length > 0
        ? JSON.stringify(availableCharacters, null, 2)
        : 'Không có nhân vật được định nghĩa.';

    // Filter products with names
    const availableProducts = products
        .filter(p => p.name.trim() !== '')
        .map(p => ({ name: p.name, id: p.id, description: p.description }));

    const productListString = availableProducts.length > 0
        ? JSON.stringify(availableProducts, null, 2)
        : null;

    // Build character instructions based on preset
    const characterInstructions = preset.outputFormat.hasDialogue && availableCharacters.length > 0
        ? `\n**AVAILABLE CHARACTERS (JSON):**\n${characterListString}\n\n**CHARACTER USAGE RULES:**
1. **Selective Tagging**: CHỈ trả về 'character_ids' cho các nhân vật THỰC SỰ xuất hiện hoặc đóng vai trò quan trọng trong cảnh. Tránh gán nhân vật rác nếu họ không có thoại hoặc không được mô tả hành động cụ thể.
2. **Dialogue Consistency**: Nếu một nhân vật có tên trong 'dialogues', ID của họ PHẢI có trong 'character_ids'.
3. **Visual Anchor**: Trong "visual_context", mô tả chi tiết đặc điểm nhận dạng của họ (kiểu tóc, màu tóc, trang phục cụ thể) ĐÚNG với mô tả được cung cấp.`
        : '';

    // Build product instructions
    const productInstructions = productListString
        ? `\n**AVAILABLE PRODUCTS/PROPS (JSON):**\n${productListString}\n\n**PRODUCT USAGE RULES:**
1. **Selective Tagging**: CHỈ trả về 'product_ids' cho sản phẩm/đạo cụ là tiêu điểm hoặc có tương tác trong cảnh.
2. **Visual Precision**: Mô tả cực kỳ chi tiết hình dáng, chất liệu, màu sắc của sản phẩm trong visual_context để đảm bảo tính nhất quán.`
        : '';

    // Build output format instructions based on preset
    let outputFormatInstructions = `\n**OUTPUT FORMAT (JSON Object):**\n`;

    outputFormatInstructions += `
- "detailed_story": "A comprehensive detailed story/script summary of the entire content (Detailed Script)."
- "scene_groups": [
    {
      "id": "group_id",
      "name": "Tên bối cảnh (VD: Boong tàu, Khoang tàu, Dưới nước)",
      "description": "Mô tả bối cảnh và diễn biến chung trong nhóm này",
      "continuity_reference_group_id": "id_nhóm_trước_đó" (Chỉ dùng nếu bối cảnh này lặp lại từ một nhóm phía trước để đảm bảo tính nhất quán)
    }
],
- "scenes": [
    {
        "visual_context": "BẮT ĐẦU bằng mốc thời gian [00:00-00:0X]. Mô tả theo cấu trúc chuẩn VEO 3.1: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. Cuối cùng thêm SFX (Sound Effects) và Emotion (Cảm xúc).",
        "scene_number": "1",
        "group_id": "group_id",
        "prompt_name": "Tiêu đề cảnh",
        "character_ids": ["id1"],
        "product_ids": ["id1"]
`;

    if (preset.outputFormat.hasDialogue) {
        outputFormatInstructions += `        , "dialogues": [{ "characterName": "Tên nhân vật", "line": "Lời thoại" }]\n`;
    }

    if (preset.outputFormat.hasNarration) {
        outputFormatInstructions += `        , "voiceover": "Lời tường thuật"\n`;
    }

    if (preset.outputFormat.hasCameraAngles) {
        outputFormatInstructions += `        , "camera_angle": "Góc máy"\n`;
    }

    outputFormatInstructions += `    }
]

**IMPORTANT RULES (VEO 3.1 STANDARDS):**
1. **Timestamped Scenes**: Mọi mô tả TRONG visual_context PHẢI bắt đầu bằng mốc thời gian (VD: [00:00-00:04]).
2. **The Veo Formula**: Cấu trúc visual_context PHẢI tuân thủ: [Cinematography: Camera movement/composition] + [Subject: Visual details of main character] + [Action: What they are doing] + [Context: Environment details] + [Style & Ambiance: Lighting, mood, film grain].
3. **Sound & Emotion**: BẮT BUỘC bao gồm SFX (VD: "SFX: tiếng mưa rơi, tiếng lá xào xạc") và Emotion (VD: "Emotion: Hopeful and determined") ở cuối visual_context.
4. **Director's Story Audit**: Trước khi viết mỗi cảnh, hãy tự hỏi: "Chi tiết này có giúp kể câu chuyện tốt hơn không?". TUYỆT ĐỐI LOẠI BỎ các yếu tố trang trí không liên quan đến cốt truyện hoặc tính cách nhân vật.
5. **Cinetic Shot Progression**: Đảm bảo sự chuyển động góc máy logic (WIDE SHOT -> MEDIUM -> CLOSE UP) để tạo nhịp điệu điện ảnh.
6. **No Ghost People**: NẾU KHÔNG CÓ character_ids, visual_context TUYỆT ĐỐI KHÔNG mô tả bất kỳ người nào.
7. **Integrity**: Chỉ sử dụng các character_id/product_id được cung cấp trong danh sách.
`;

    // Add custom instructions if present
    const customInstructionBlock = customInstruction?.trim()
        ? `\n**CUSTOM INSTRUCTIONS (META TOKENS):**\n${customInstruction}\n(Prioritize these instructions for tone and style)\n`
        : '';

    // Full prompt construction
    const prompt = `
${preset.systemPrompt}

---

**STORY CONCEPT:**
"${userIdea}"

${characterInstructions}
${productInstructions}

---

**TONE & STYLE:**
${preset.toneKeywords.join(', ')}
${customInstructionBlock}

**LANGUAGE REQUIREMENT:**
Write all dialogues, voiceovers, and narration in ${language}.

**SCENE STRUCTURE GUIDELINES:**
${preset.sceneGuidelines}

---

${outputFormatInstructions}

---

**EXAMPLE OUTPUT:**
${preset.exampleOutput}

---

**YOUR TASK:**
Create EXACTLY ${sceneCount} scenes following the format and guidelines above.
Return ONLY a valid JSON array. Do NOT include any text outside the JSON.
`;

    return prompt;
}

/**
 * Build AI prompt for regenerating a specific group of scenes
 */
export function buildGroupRegenerationPrompt(
    fullScript: string,
    groupToRegen: { id: string; name: string; description: string },
    allGroups: any[],
    preset: ScriptPreset,
    characters: Character[],
    products: Product[],
    language: string,
    customInstruction?: string,
    pacing?: 'slow' | 'medium' | 'fast'
): string {
    const availableCharacters = characters
        .filter(c => c.name.trim() !== '')
        .map(c => ({ name: c.name, id: c.id, description: c.description }));

    const characterListString = JSON.stringify(availableCharacters, null, 2);

    const availableProducts = products
        .filter(p => p.name.trim() !== '')
        .map(p => ({ name: p.name, id: p.id, description: p.description }));

    const productListString = JSON.stringify(availableProducts, null, 2);

    const sceneProperties: any = {
        scene_number: "Keep sequence consistent with original",
        group_id: groupToRegen.id,
        prompt_name: "String",
        visual_context: "String",
        character_ids: ["Array of strings"],
        product_ids: ["Array of strings"]
    };

    if (preset.outputFormat.hasDialogue) sceneProperties.dialogues = [{ characterName: "Name", line: "Line" }];
    if (preset.outputFormat.hasNarration) sceneProperties.voiceover = "String";
    if (preset.outputFormat.hasCameraAngles) sceneProperties.camera_angle = "String";

    const pacingInstruction = pacing ? `
**PACING REQUIREMENT:**
This group must have a **${pacing.toUpperCase()}** pacing.
- **Slow:** Focus on long takes, emotional close-ups, environmental textures.
- **Medium/Balanced:** Standard cinematic narrative flow.
- **Fast:** Quick cuts, dynamic camera movement, energetic action.
` : '';

    const prompt = `
${preset.systemPrompt}

---

**CONTEXT - FULL STORY PLOT:**
"${fullScript}"

${pacingInstruction}

---

**YOUR SPECIFIC TASK:**
You are asked to REGENERATE the scenes for a specific group/location.
- **Group Name:** "${groupToRegen.name}"
- **Group Description:** "${groupToRegen.description}"

**OTHER GROUPS:**
${allGroups.map(g => `- ${g.name}: ${g.description}`).join('\n')}

---

**REQUIREMENTS:**
1. Create a logical sequence of 2-4 scenes for THIS GROUP ONLY.
1. Return ONLY the JSON. No conversational filler.
2. Write in ${language}.

**AVAILABLE CHARACTERS:**
${characterListString}

**AVAILABLE PRODUCTS:**
${productListString}

**CUSTOM STYLE:**
${customInstruction || 'None'}

---

**OUTPUT FORMAT:**
Return ONLY a valid JSON object:
{
  "scenes": [
    // Array of scene objects for THIS GROUP ONLY
  ]
}

**SCENE STRUCTURE:**
${JSON.stringify(sceneProperties, null, 2)}
`;

    return prompt;
}
