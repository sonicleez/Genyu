import { ScriptPreset, Character, Product, DirectorPreset } from '../types';

/**
 * Build AI prompt for script generation based on selected preset and director
 */
export function buildScriptPrompt(
    userIdea: string,
    preset: ScriptPreset,
    characters: Character[],
    products: Product[],
    sceneCount: number,
    language: string,
    customInstruction?: string,
    director?: DirectorPreset
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

    // Build character instructions - ALWAYS include when characters exist
    const characterInstructions = availableCharacters.length > 0
        ? `\n**AVAILABLE CHARACTERS (JSON):**\n${characterListString}\n\n**CHARACTER USAGE RULES:**
1. **AUTO ASSIGN REQUIRED**: Tự động gán 'character_ids' cho các cảnh có nhân vật xuất hiện hoặc được nhắc đến. PHẢI gán ít nhất 1 character nếu cảnh có người.
2. **DO NOT RE-DESCRIBE APPEARANCE**: KHÔNG mô tả lại ngoại hình nhân vật (kiểu tóc, màu tóc, trang phục) trong visual_context. Chỉ dùng TÊN nhân vật. Ngoại hình sẽ được lấy từ ảnh reference, KHÔNG từ text.
3. **ACTION FOCUS**: Trong visual_context, CHỈ mô tả HÀNH ĐỘNG, TƯ THẾ, VỊ TRÍ của nhân vật. VD: "[Tên] đang chạy", "[Tên] ngồi bên cửa sổ", KHÔNG PHẢI "Cô gái tóc dài đen mặc áo xanh...".
4. **No Ghost People**: NẾU cảnh KHÔNG có character_ids, visual_context TUYỆT ĐỐI KHÔNG được mô tả người. Chỉ mô tả landscape/environment.
5. **Selective but Active**: Chọn đúng nhân vật cho từng cảnh, nhưng phải chủ động gán - không để trống nếu cảnh có người.`
        : '';


    // Build product instructions
    const productInstructions = productListString
        ? `\n**AVAILABLE PRODUCTS/PROPS (JSON):**\n${productListString}\n\n**PRODUCT USAGE RULES:**
1. **Selective Tagging**: CHỈ trả về 'product_ids' cho sản phẩm/đạo cụ là tiêu điểm hoặc có tương tác trong cảnh.
2. **Visual Precision**: Mô tả cực kỳ chi tiết hình dáng, chất liệu, màu sắc của sản phẩm trong visual_context để đảm bảo tính nhất quán.`
        : '';

    // Build Director instructions
    const directorInstructions = director
        ? `\n**DIRECTORIAL VISION (Mandatory Style):**
PHẢI viết kịch bản và mô tả hình ảnh theo phong cách của đạo diễn: **${director.name}**.
- **Mô tả phong cách**: ${director.description}
- **Visual DNA (Technical Keywords)**: ${director.dna}
- **Narrative Influence**: Đảm bảo cấu trúc câu, lời thoại và nhịp điệu phân cảnh phản ánh đúng linh hồn của đạo diễn này. Nếu phong cách là 'Vua đối xứng', hãy mô tả bố cục đối xứng trong visual_context. Nếu là 'Neon Noir', hãy tập trung vào ánh sáng neon và bóng đổ.`
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
        "visual_context": "BẮT ĐẦU bằng SHOT TYPE. Tiếp theo là [CINEMATIC PURPOSE]. NGUYÊN LÝ: Nhân vật là DUY NHẤT. Nếu góc OTS/Back View cho cảnh có 1 nhân vật, hãy đặt camera SAU VAI họ để họ làm tiền cảnh (mờ), tiêu điểm là vật họ đang nhìn. TUYỆT ĐỐI KHÔNG vẽ nhân vật đó lần thứ 2 ở hậu cảnh (Ghosting).",
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

**IMPORTANT RULES (IMAGE GENERATION OPTIMIZED):**
1. **Shot Type First**: Mọi visual_context PHẢI bắt đầu bằng SHOT TYPE rõ ràng (CLOSE UP, MEDIUM SHOT, WIDE SHOT, etc.).
2. **Visual Description Formula**: Cấu trúc: SHOT TYPE + [CINEMATIC PURPOSE] + Subject details (inc. Costume Anchor) + Action/Pose + Environment (inc. **SET LANDMARKS** e.g. "near the fireplace", "by the kitchen counter") + Lighting + Atmosphere.
3. **Cinematic Objective**: Mỗi cảnh PHẢI có một mục đích kể chuyện rõ ràng. Nếu có đạo cụ mới xuất hiện, PHẢI có ít nhất 1 cảnh nhân vật nhặt/lấy nó.
4. **POV Connection**: Ưu tiên sử dụng góc máy POV (Point of View) để kết nối cái nhìn của nhân vật với các chi tiết quan trọng hoặc đạo cụ. 
5. **Set Integrity**: Luôn giữ vững vị trí các vật thể lớn cố định trong bối cảnh (Landmarks) làm mỏ neo thị giác.
6. **No Timestamps**: KHÔNG sử dụng mốc thời gian [00:00-00:05]. 
7. **No SFX/Emotion**: KHÔNG thêm SFX hoặc Emotion vào visual_context.
8. **CONTINUITY TAGS**: Sử dụng các thẻ sau:
    - [SAME_OUTFIT]: Đảm bảo trang phục y hệt cảnh trước.
    - [SAME_LIGHTING]: Đảm bảo hướng và màu sắc ánh sáng nhất quán.
    - [SAME_LOCATION]: Đảm bảo các chi tiết bối cảnh xung quanh không thay đổi.
9. **TRANSITION HINTS**: Mô tả ngắn gọn sự thay đổi tư thế/vị trí so với cảnh trước.
10. **OTS & BACK VIEW (IDENTITY SINGULARITY & ANTI-GHOSTING)**: 
    - **Nguyên lý Độc bản (Singularity)**: Mỗi nhân vật (vd: Chú mèo) là DUY NHẤT. Tuyệt đối không được xuất hiện 2 lần trong 1 khung hình.
    - **Single Character Scene (Cảnh 1 nhân vật)**: Nếu cảnh chỉ có 1 nhân vật, khi dùng góc OTS:
        *   **Cấu trúc**: Nhân vật đó PHẢI là người đứng ở tiền cảnh (tiếp giáp camera, mờ). Khung hình phải nhìn xuyên qua vai họ để thấy bối cảnh/đồ vật.
        *   **Cấm kỵ**: Tuyệt đối KHÔNG được vẽ thêm nhân vật đó một lần nữa ở trung cảnh hay hậu cảnh.
    - **Mô tả điểm nhìn**: Nếu chú mèo đang ngồi nhìn lò sưởi, góc OTS sẽ là: "[OTS] shot behind the Cat's shoulder, looking at the glowing fireplace. THE CAT IS ONLY VISUALIZED AS A BLURRED SHOULDER IN FOREGROUND. The focal point is the FIREPLACE. No other cats visible."
    - **Khóa Tham Chiếu**: Luôn dùng: "Same outfit, features, and lighting as reference, UNCHANGED. NO NEW CHARACTERS."
    - **Nội suy**: Mô tả bối cảnh nhân vật đang nhìn thấy thay vì lặp lại bối cảnh cũ.
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
${directorInstructions}

**LANGUAGE REQUIREMENT:**
Write all dialogues, voiceovers, and narration in ${language}.

**SCENE STRUCTURE GUIDELINES:**
${preset.sceneGuidelines}

---

**CONTINUITY GUIDELINES:**
- **Group locking**: Các scene trong cùng một 'group_id' PHẢI có sự nhất quán tuyệt đối về bối cảnh và ánh sáng.
- **Time-of-Day Lock**: Xác định rõ thời gian trong ngày (VD: Sunrise, Golden Hour, High Noon, Night) và GIỮ NGUYÊN cho toàn bộ group.
- **Progressive Action**: Nếu các cảnh diễn ra liên tiếp, hãy mô tả hành động như một chuỗi chuyển động mượt mà. Đảm bảo tư thế, trang phục (nhàu, rách) và các vật dụng đang cầm (giỏ, vũ khí) phải khớp tuyệt đối với mô tả cảnh trước.
- **Visual Anchors**: Luôn nhắc lại các vật thể/chi tiết đặc trưng của bối cảnh để tạo mỏ neo thị giác.
- **Seamless Movement**: Khi nhân vật di chuyển từ bối cảnh này sang bối cảnh khác trong cùng một dòng thời gian, hãy ghi chú rõ hành động đang tiếp diễn (VD: "Vẫn cầm giỏ hoa quả từ cảnh trước, chú mèo bước vào nhà...").
- **Action Persistence**: Giữ nguyên mức độ mệt mỏi, vết bẩn, hoặc trạng thái cảm xúc của nhân vật nếu thời gian giữa 2 phân cảnh là cực ngắn.
- **Background Integrity**: Chỉ thay đổi bối cảnh nếu nội dung yêu cầu, nhưng các vật thể nhân vật đang tương tác (vũ khí, đạo cụ) phải đi theo nhân vật.

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
    pacing?: 'slow' | 'medium' | 'fast',
    sceneCount?: number
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
1. Create a logical sequence of ${sceneCount || '4-8'} scenes for THIS GROUP ONLY. Ensure a complete and rich narrative flow for this specific location.
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
