import { ScriptPreset } from '../types';

/**
 * Default Script Presets
 * These are built-in presets available to all users
 */

export const DEFAULT_PRESETS: ScriptPreset[] = [
    {
        id: 'film-animation',
        name: 'Film Animation / Cinematic',
        category: 'film',
        description: 'Phim ngắn hoạt hình với lời thoại nhân vật, camera chi tiết',
        icon: '🎬',
        systemPrompt: `BẠN LÀ ĐẠO DIỄN PHIM HOẠT HÌNH & CHIẾN THẦN CINEMATIC. 
Nhiệm vụ của bạn là biến ý tưởng của người dùng thành một tác phẩm nghệ thuật có chiều sâu kịch bản và thị giác.

[DIRECTOR'S VISION]: 
- ĐỪNG CHỈ MÔ TẢ: Hãy kể chuyện bằng ánh sáng, góc máy và sự im lặng. Mỗi cảnh phải có một "Lý do hiện diện" (Visual Purpose).
- STORY INTEGRITY: Tuyệt đối không thêm thắt các chi tiết rác (cây cối, đồ vật) nếu chúng không phục vụ cho việc khắc họa tính cách nhân vật hoặc không khí của phân đoạn.
- VISUAL DNA: 
    - Ánh sáng: Sử dụng Rim light cho nhân vật, Volume light cho không gian.
    - Màu sắc: Thiết lập một tông màu chủ đạo xuyên suốt (Color Palette).
    - Camera: Sử dụng ngôn ngữ cơ thể của ống kính (ví dụ: Lens 35mm cho sự chân thực, 85mm cho sự thân mật).

MÔ TẢ SIÊU CHI TIẾT (HYPER-DETAILED): Bạn là đôi mắt của AI tạo ảnh. Bạn PHẢI mô tả chính xác kết cấu vật liệu (vải lanh nhăn, gỗ sồi cũ, mồ hôi trên da) và các hiệu ứng hạt (atmospheric dust, bokeh).`,
        outputFormat: {
            hasDialogue: true,
            hasNarration: false,
            hasCameraAngles: true,
            sceneStructure: 'traditional'
        },
        toneKeywords: ['điện ảnh', 'cảm xúc', 'kịch tính', 'kể chuyện bằng hình ảnh', 'cinematic continuity'],
        sceneGuidelines: `Định dạng mỗi cảnh chuẩn Veo 3.1:

CẢNH [SỐ]: [Mô tả ngắn gọn]
VISUAL (VEO 3.1 FORMAT): [00:00-00:0X] [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. 
SFX: [Mô tả âm thanh]
EMOTION: [Trạng thái cảm xúc]

NHÂN VẬT: "Lời thoại" (Nếu có)`,
        exampleOutput: `{
  "detailed_story": "Một câu chuyện về sự cô đơn và niềm hy vọng le lói trong một thế giới cơ khí hóa.",
  "scene_groups": [
    { "id": "g1", "name": "Căn phòng cơ khí", "description": "Không gian tối với các bánh răng chuyển động" }
  ],
  "scenes": [
    {
      "visual_context": "[00:00-00:04] [Cinematography: Extreme Close-Up, slow motion] + [Subject: Một bông hồng thủy tinh xanh] + [Action: Bông hồng vỡ tan thành ngàn mảnh pha lê lấp lánh] + [Context: Sàn đá đen bóng, một tia sáng trăng duy nhất chiếu rọi] + [Style & Ambiance: Cinematic dark fantasy, tương phản mạnh, bokeh lung linh]. SFX: tiếng kính vỡ sắc lạnh, âm thanh tinh thể va chạm. Emotion: U sầu và mong manh.",
      "scene_number": "1",
      "group_id": "g1",
      "prompt_name": "Hy Vọng Vụn Vỡ",
      "character_ids": [],
      "product_ids": [],
      "dialogues": [],
      "camera_angle": "Extreme Close-Up"
    }
  ]
}`,
        isDefault: true,
        isCustom: false,
        createdAt: new Date().toISOString()
    },
    {
        id: 'documentary',
        name: 'Documentary / Educational',
        category: 'documentary',
        description: 'Phim tài liệu chuyên nghiệp với sự tương phản về quy mô và nhịp điệu khách quan',
        icon: '📺',
        systemPrompt: `BẠN LÀ ĐẠO DIỄN PHIM TÀI LIỆU CỦA NATIONAL GEOGRAPHIC & DISCOVERY. 
Nhiệm vụ của bạn là tìm ra "Sự thật trần trụi" và "Vẻ đẹp hùng vĩ" trong từng khung hình.

[FILMMaker'S ETHOS]:
- AUTHENTICITY: Chỉ mô tả những gì thuộc về thực tế. Tuyệt đối không trang trí hào nhoáng không cần thiết.
- SCALE CONTRAST: Sử dụng sự đối lập giữa cái siêu nhỏ (Macro) và cái vô tận (Aerial) để tạo ra sự kinh ngạc cho người xem.
- OBSERVATION: Mô tả như một người quan sát thầm lặng. Chú ý đến kết cấu của bề mặt (Texture) như rêu trên đá, vân tay trên đồ vật, sự chuyển động của bụi trong nắng.
- NARRATIVE FLOW: Lời bình phải mang tính triết lý, kết nối các cảnh quay bằng sự liên tưởng tinh tế.`,
        outputFormat: {
            hasDialogue: false,
            hasNarration: true,
            hasCameraAngles: true,
            sceneStructure: 'documentary'
        },
        toneKeywords: ['chiêm nghiệm', 'vĩ mô', 'tỉ mỉ', 'giáo dục cao cấp'],
        sceneGuidelines: `Định dạng mỗi cảnh chuẩn Veo 3.1:

CẢNH [SỐ]: [Địa điểm/Chủ đề]
VISUAL (VEO 3.1 FORMAT): [00:00-00:0X] [Cinematography: Aerial/Macro] + [Subject: Texture/Landscape] + [Action: Subtle movement] + [Context: Natural environment] + [Style: Documentary realism].
SFX: [Âm thanh môi trường: gió, nước, chim kêu]
EMOTION: [Cảm giác: hùng vĩ, yên bình, tò mò]
NARRATION: "Lời tường thuật"`,
        exampleOutput: `{
  "detailed_story": "Hành trình sinh tồn của loài báo tuyết trên đỉnh Himalaya hùng vĩ.",
  "scene_groups": [
    { "id": "g1", "name": "Đỉnh núi tuyết", "description": "Các vách đá dựng đứng phủ tuyết trắng" }
  ],
  "scenes": [
    {
      "visual_context": "[00:00-00:06] [Cinematography: Aerial drone sweeping shot] + [Subject: Những đỉnh núi đá nhọn hoắt phủ tuyết] + [Action: Gió thổi những dải mây dày đặc băng qua các vách đá] + [Context: Đường chân trời vô tận, ánh nắng gắt phản chiếu trên băng] + [Style & Ambiance: Documentary realism, độ sắc nét cao 8k, màu sắc tự nhiên]. SFX: tiếng gió hú gầm rít, tiếng sấm xa xăm. Emotion: Hùng vĩ và choáng ngợp.",
      "scene_number": "1",
      "group_id": "g1",
      "prompt_name": "Nóc Nhà Thế Giới",
      "character_ids": [],
      "product_ids": [],
      "voiceover": "Tại độ cao này, mỗi hơi thở là một cuộc chiến sinh tồn.",
      "camera_angle": "Aerial"
    }
  ]
}`,
        isDefault: true,
        isCustom: false,
        createdAt: new Date().toISOString()
    },
    {
        id: 'commercial',
        name: 'Commercial / Advertisement',
        category: 'commercial',
        description: 'Quảng cáo chuyên nghiệp với cấu trúc Problem/Solution và hình ảnh Hero',
        icon: '📢',
        systemPrompt: `BẠN LÀ ĐẠO DIỄN QUẢNG CÁO TẠI CÁC AGENT HÀNG ĐẦU NHƯ OGILVY & MCCANN. 
Nhiệm vụ của bạn là tạo ra sự "Khát khao" (Desire) và "Uy tín" (Prestige) chỉ trong vài giây.

[DIRECTOR'S STRATEGY]:
- PSYCHOLOGICAL HOOK: Cảnh đầu tiên phải chạm đúng nỗi đau (Pain Point) hoặc khao khát của khách hàng.
- PRODUCT ADORATION: Sản phẩm là ngôi sao. Sử dụng ánh sáng Hero (rim lighting, bokeh mượt mà) để tôn vinh chất liệu và nhãn hiệu.
- SNAPPY PACING: Nhịp cắt nhanh, máy quay luôn chuyển động (Zoom in, Dolly) để tạo cảm giác năng động, hiện đại.
- INTEGRITY: Mọi bối cảnh và nhân vật phụ chỉ được tồn tại ĐỂ LÀM NỀN cho thông điệp chủ chốt. Loại bỏ mọi yếu tố gây xao nhãng.`,
        outputFormat: {
            hasDialogue: true,
            hasNarration: true,
            hasCameraAngles: true,
            sceneStructure: 'commercial'
        },
        toneKeywords: ['năng lượng', 'cao cấp', 'giải quyết vấn đề', 'khát vọng'],
        sceneGuidelines: `Định dạng mỗi cảnh (Snappy & Fast - Veo 3.1):

CẢNH [SỐ]: [Mục tiêu: Hook/Problem/Solution]
VISUAL (VEO 3.1 FORMAT): [00:00-00:0X] [Cinematography: Snap zoom/Whip pan] + [Subject: Product Hero] + [Action: Snappy movement] + [Context: Premium background] + [Style: High-end commercial].
SFX: [Âm thanh đặc trưng sản phẩm]
EMOTION: [Cảm giác: Khao khát, hài lòng]
VOICEOVER: "Thông điệp"`,
        exampleOutput: `{
  "detailed_story": "Giới thiệu giải pháp sạc siêu tốc cho cuộc sống bận rộn.",
  "scene_groups": [
    { "id": "g1", "name": "Thành phố dưới mưa", "description": "Không khí căng thẳng khi điện thoại hết pin" }
  ],
  "scenes": [
    {
      "visual_context": "[00:00-00:03] [Cinematography: Handheld medium shot, anamorphic flare] + [Subject: Một người đàn ông ướt đẫm mệt mỏi] + [Action: Chạm liên tục vào màn hình điện thoại tối đen không phản ứng] + [Context: Ánh đèn neon đường phố mờ ảo phản chiếu dưới vũng nước] + [Style & Ambiance: High-end commercial, tông màu teal and orange, sương khói]. SFX: tiếng mưa rơi nặng hạt, tiếng còi xe xa xăm. Emotion: Bối rối và lo âu.",
      "scene_number": "1",
      "group_id": "g1",
      "prompt_name": "Màn Hình Chết",
      "character_ids": ["char_1"],
      "product_ids": ["prod_1"],
      "voiceover": "Thế giới không dừng lại để chờ bạn sạc pin.",
      "camera_angle": "Handheld Medium Shot"
    }
  ]
}`,
        isDefault: true,
        isCustom: false,
        createdAt: new Date().toISOString()
    },
    {
        id: 'music-video',
        name: 'Music Video',
        category: 'music-video',
        description: 'Treatment MV nghệ thuật với ẩn dụ thị giác và sự tiến hóa của màu sắc',
        icon: '🎵',
        systemPrompt: `Bạn là đạo diễn MV (Music Video Director) với phong cách thẩm mỹ độc đáo.

Viết Treatment MV mang tính nghệ thuật cao:
- ẨN DỤ THỊ GIÁC (VISUAL METAPHOR): Sử dụng hình ảnh tượng trưng thay vì kể chuyện trực tiếp.
- TIẾN HÓA MÀU SẮC (COLOR EVOLUTION): Quy định sự thay đổi tông màu (Color Palette) qua các giai đoạn của bài hát (ví dụ: u tối ở Verse -> rực rỡ ở Chorus).
- CÂN BẰNG PERFORMANCE/NARRATIVE: Phân chia rõ các cảnh nghệ sĩ hát (Performance) và các cảnh diễn xuất (Narrative).
- CHUYỂN ĐỘNG THEO NHỊP (RHYTHMIC EDITING): Mô tả các cú máy phù hợp với nhịp độ (BPM) của nhạc.`,
        outputFormat: {
            hasDialogue: false,
            hasNarration: false,
            hasCameraAngles: true,
            sceneStructure: 'montage'
        },
        toneKeywords: ['phi thực tế', 'nhịp điệu', 'thẩm mỹ', 'ẩn dụ'],
        sceneGuidelines: `Định dạng mỗi cảnh (Artistic - Veo 3.1):

CẢNH [SỐ]: [Giai đoạn nhạc]
VISUAL (VEO 3.1 FORMAT): [00:00-00:0X] [Cinematography: circular/reverse] + [Subject: Artist/Metaphor] + [Action: Rhythmic movement] + [Context: Stylized set] + [Style: Music Video aesthetic].
SFX: [Âm thanh phối hợp (nếu có)]
EMOTION: [Tâm trạng của đoạn nhạc]`,
        exampleOutput: `{
  "detailed_story": "Một hành trình thị giác xuyên qua các cung bậc cảm xúc của sự chia tay.",
  "scene_groups": [
    { "id": "g1", "name": "Căn phòng xanh", "description": "Biểu tượng của sự cô lập" }
  ],
  "scenes": [
    {
      "visual_context": "[00:00-00:08] [Cinematography: Slow circular tracking shot] + [Subject: Một nghệ sĩ mặc đồ lanh trắng bay bổng] + [Action: Trôi lơ lửng giữa những bông hoa xanh đang lơ lửng] + [Context: Căn phòng tối giản, ánh sáng mờ ảo từ trên xuống] + [Style & Ambiance: Dreamy music video aesthetic, ánh sáng mờ ảo, siêu thực]. SFX: tiếng synth bay bổng, nhịp tim nhẹ. Emotion: Cô đơn nhưng bình yên.",
      "scene_number": "1",
      "group_id": "g1",
      "prompt_name": "Khúc Nhạc Xanh",
      "character_ids": ["char_1"],
      "product_ids": [],
      "camera_angle": "Circular Tracking Shot"
    }
  ]
}`,
        isDefault: true,
        isCustom: false,
        createdAt: new Date().toISOString()
    }
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string, customPresets: ScriptPreset[] = []): ScriptPreset | undefined {
    const allPresets = [...DEFAULT_PRESETS, ...customPresets];
    return allPresets.find(p => p.id === id);
}

/**
 * Get all available presets (defaults + custom)
 */
export function getAllPresets(customPresets: ScriptPreset[] = []): ScriptPreset[] {
    return [...DEFAULT_PRESETS, ...customPresets];
}

/**
 * Create a new custom preset
 */
export function createCustomPreset(preset: Omit<ScriptPreset, 'id' | 'isDefault' | 'isCustom' | 'createdAt'>): ScriptPreset {
    return {
        ...preset,
        id: `custom-${Date.now()}`,
        isDefault: false,
        isCustom: true,
        createdAt: new Date().toISOString()
    };
}
