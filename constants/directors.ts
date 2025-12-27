export type DirectorCategory = 'cinema' | 'tvc' | 'documentary' | 'music_video';

export interface DirectorPreset {
    id: string;
    name: string;
    origin: 'Âu' | 'Á';
    description: string;
    dna: string;
    signatureCameraStyle?: string; // Director's signature camera techniques
    quote?: string;
    isCustom?: boolean;
}

export const DIRECTOR_CATEGORIES: { id: DirectorCategory; name: string; icon: string }[] = [
    { id: 'cinema', name: 'Cinema & Storytelling', icon: '🎬' },
    { id: 'tvc', name: 'TVC & Commercial', icon: '💎' },
    { id: 'documentary', name: 'Documentary', icon: '🌍' },
    { id: 'music_video', name: 'Music Video & Art', icon: '🎸' }
];

export const DIRECTOR_PRESETS: Record<DirectorCategory, DirectorPreset[]> = {
    cinema: [
        {
            id: 'wes_anderson',
            name: 'Wes Anderson',
            origin: 'Âu',
            description: 'Vua đối xứng: Khung hình cân đối tuyệt đối, màu pastel rực rỡ.',
            dna: 'Symmetry, Pastel colors (Pink/Yellow), Flat lighting, Planimetric staging.',
            signatureCameraStyle: 'Centered framing, Dolly push-in, Overhead top-down, Whip pan, Tracking shot parallel to subject',
            quote: 'I have a way of filming things that is certain.'
        },
        {
            id: 'wong_kar_wai',
            name: 'Wong Kar-wai',
            origin: 'Á',
            description: 'Kẻ mộng mơ: Phố thị hư ảo, Neon bão hòa, u sầu và lãng mạn.',
            dna: 'Step-printing, Neon lights, Low-key lighting, Red/Green tint, Motion blur.',
            signatureCameraStyle: 'Handheld shaky cam, Dutch angle, Slow motion, Extreme close-up on hands/faces, Reflections in mirrors',
            quote: 'All the memories are traced in tears.'
        },
        {
            id: 'christopher_nolan',
            name: 'Christopher Nolan',
            origin: 'Âu',
            description: 'Bậc thầy logic: Quy mô vĩ đại, thực tế, tông màu lạnh và sâu.',
            dna: 'IMAX 70mm, Cold color palette, Practical effects, Deep shadows, Realistic lighting.',
            signatureCameraStyle: 'IMAX extreme wide, Rotating camera rig, POV cockpit shots, Long unbroken takes, Practical stunt coverage',
            quote: 'I always try to push things in a more realistic direction.'
        },
        {
            id: 'akira_kurosawa',
            name: 'Akira Kurosawa',
            origin: 'Á',
            description: 'Bậc thầy sử thi: Dàn cảnh hoành tráng, bố cục chặt chẽ, tương phản mạnh.',
            dna: 'High contrast, Deep focus, Weather elements (Wind/Rain), Masterful staging.',
            signatureCameraStyle: 'Multi-camera coverage, Telephoto compression, Wipe transitions, Low angle hero shots, Axial cuts',
            quote: 'To be an artist means never to avert one\'s eyes.'
        },
        {
            id: 'bong_joon_ho',
            name: 'Bong Joon-ho',
            origin: 'Á',
            description: 'Sát thủ ẩn dụ: Tương phản xã hội kịch tính, ánh sáng kể chuyện.',
            dna: 'Dark humor aesthetic, Social contrast, Multi-layered scenes, Dynamic framing.',
            signatureCameraStyle: 'Split diopter shots, Vertical movement (stairs/levels), Voyeuristic framing, Long master shots, Slow reveal dolly',
            quote: 'Once you overcome the one-inch tall barrier of subtitles.'
        },
        {
            id: 'tim_burton',
            name: 'Tim Burton',
            origin: 'Âu',
            description: 'Phù thủy Gothic: Ma mị, đen tối, kỳ quái nhưng đầy cảm xúc.',
            dna: 'Gothic style, Pale faces, Blue/Black tones, Spooky silhouettes, Expressionist lighting.',
            signatureCameraStyle: 'Extreme wide establishing, Canted angles, Spiral staircase shots, Silhouette framing, Low-angle monster reveal',
            quote: 'One person\'s craziness is another person\'s reality.'
        },
        {
            id: 'hayao_miyazaki',
            name: 'Hayao Miyazaki',
            origin: 'Á',
            description: 'Hồn cốt Ghibli: Bình yên, kỳ ảo, gần gũi thiên nhiên.',
            dna: 'Hand-drawn aesthetic, Vibrant green, Fluffy clouds, Soft warm lighting.',
            signatureCameraStyle: 'Slow pan across landscapes, Flying POV sequences, Contemplative static shots, Wind-blown motion, Gentle zoom-in on details',
            quote: 'I do believe in the power of story.'
        },
        {
            id: 'denis_villeneuve',
            name: 'Denis Villeneuve',
            origin: 'Âu',
            description: 'Nhà thơ viễn tưởng: Tối giản, u trầm và đại cảnh khổng lồ.',
            dna: 'Minimalism, Monochromatic tones (Dust/Gray), Huge scale, Fog/Haze/Mist.',
            signatureCameraStyle: 'Extreme wide with tiny human figure, Slow crane ascending, Static locked-off frames, Shallow focus isolation, Anamorphic lens flares',
            quote: 'Cinema is a language of images.'
        }
    ],
    tvc: [
        {
            id: 'apple_style',
            name: 'Apple Style',
            origin: 'Âu',
            description: 'Tối giản tinh tế: Sạch sẽ, tập trung chi tiết trên nền đơn sắc.',
            dna: 'White/Gray background, Soft shadows, Macro product shots, Ultra-clean.',
            signatureCameraStyle: 'Rotating product shot on seamless, Macro detail reveal, Slow dolly around product, Clean white cyc, Floating product hero',
            quote: 'Simplicity is the ultimate sophistication.'
        },
        {
            id: 'japanese_zen',
            name: 'Japanese Zen',
            origin: 'Á',
            description: 'Sạch sẽ & Tĩnh lặng: Cực kỳ tối giản, ánh sáng mềm, cảm giác tự nhiên.',
            dna: 'Soft natural light, Wood textures, Quiet composition, Minimalist aesthetics.',
            signatureCameraStyle: 'Static locked frame, Gentle breathing room, Soft rack focus, Tabletop composition, Natural window light',
            quote: 'Beauty in silence.'
        },
        {
            id: 'michael_bay',
            name: 'Michael Bay',
            origin: 'Âu',
            description: 'Cinematic Action: Cháy nổ, rực rỡ và tràn đầy năng lượng.',
            dna: 'Lens flares, Circular tracking, Teal & Orange, High saturation, Epic scale.',
            signatureCameraStyle: '360-degree hero shot, Low angle with sunset, Slow-mo explosion reveal, Helicopter aerial, Spinning camera around subject',
            quote: 'I make movies for teenage boys. Oh, dear, what a crime.'
        },
        {
            id: 'cyber_seoul',
            name: 'Cyber Seoul',
            origin: 'Á',
            description: 'Công nghệ & Rực rỡ: Tinh thần hiện đại, màu sắc bão hòa, sành điệu.',
            dna: 'High saturation, Digital glow, Fast motion, Neon accents, K-Pop aesthetic.',
            signatureCameraStyle: 'Fast whip pan, Gimbal run-through, LED wall reflections, Quick-cut montage, Neon-lit beauty shot',
            quote: 'Future is now.'
        },
        {
            id: 'chanel_style',
            name: 'Chanel Style',
            origin: 'Âu',
            description: 'Sang trọng & Đẳng cấp: Ánh sáng mượt mà, tông màu vàng/đen quý phái.',
            dna: 'Golden glow, Slow motion, Shallow depth of field, Elegant composition.',
            signatureCameraStyle: 'Slow motion beauty close-up, Backlit silhouette, Soft focus glamour, Tracking on model walk, Intimate eye contact',
            quote: 'Luxury must be comfortable, otherwise it is not luxury.'
        },
        {
            id: 'muji_aesthetic',
            name: 'Muji Aesthetic',
            origin: 'Á',
            description: 'Hữu cơ & Mộc mạc: Tôn trọng vẻ đẹp thô mộc của vật liệu, tông màu ấm.',
            dna: 'Warm earthy tones, Unfiltered light, Static shots, Organic textures.',
            signatureCameraStyle: 'Flat lay overhead, Hands-in-frame craft shots, Static wide with negative space, Gentle push-in, Golden hour window light',
            quote: 'No brand, just quality.'
        },
        {
            id: 'nike_global',
            name: 'Nike Global',
            origin: 'Âu',
            description: 'Năng lượng & Động lực: Nhịp độ nhanh, ánh sáng kịch tính.',
            dna: 'High contrast, Motional blur, Gritty textures, Dynamic tracking shots.',
            signatureCameraStyle: 'Tracking alongside athlete, POV action cam, Slow-mo impact moment, Drone chase shot, Jump cut intensity',
            quote: 'Just do it.'
        },
        {
            id: 'suntory_style',
            name: 'Suntory Style',
            origin: 'Á',
            description: 'Nghệ thuật thưởng thức: Tinh tế, tập trung vào chất lỏng, ánh sáng lung linh.',
            dna: 'Liquid macro, Ambient glow, Sophisticated color grading, Slow-pour shots.',
            signatureCameraStyle: 'Macro liquid pour, Ice splash slow-mo, Backlit glass hero, Tabletop product beauty, Steam/mist atmosphere',
            quote: 'Art of liquid.'
        }
    ],
    documentary: [
        {
            id: 'nat_geo',
            name: 'National Geographic',
            origin: 'Âu',
            description: 'Hùng vĩ & Chân thực: Ánh sáng tự nhiên, đại cảnh hoành tráng.',
            dna: 'Wide landscapes, Natural light, High detail, Authentic textures.',
            signatureCameraStyle: 'Drone sweeping reveal, Time-lapse sequences, Telephoto wildlife, Golden hour landscapes, Underwater POV',
            quote: 'Inspiring people to care about the planet.'
        },
        {
            id: 'kore_eda',
            name: 'Kore-eda Hirokazu',
            origin: 'Á',
            description: 'Đời thường ấm áp: Ánh sáng tự nhiên nhẹ nhàng, nhịp điệu chậm.',
            dna: 'Soft daylight, Low angle, Human-centric focus, Naturalistic acting.',
            signatureCameraStyle: 'Child eye-level POV, Observational long takes, Dining table two-shot, Window-lit interiors, Gentle handheld follow',
            quote: 'I want my films to be like looking out a window.'
        },
        {
            id: 'werner_herzog',
            name: 'Werner Herzog',
            origin: 'Âu',
            description: 'Sâu sắc & Khắc nghiệt: Ánh sáng u tối, góc nhìn thực tế tàn nhẫn.',
            dna: 'Darker tones, Static long shots, Raw environment, Unfiltered reality.',
            signatureCameraStyle: 'Static contemplative wide, Extreme environment shots, Direct interview close-up, Walking POV in wilderness, Stark landscape isolation',
            quote: 'The world reveals itself to those who travel on foot.'
        },
        {
            id: 'asian_social_realism',
            name: 'Asian Social Realism',
            origin: 'Á',
            description: 'Thô mộc & Đường phố: Cảm giác thực tế từ đời sống bình dân Á Đông.',
            dna: 'Gritty, Handheld, Available light, Street aesthetic, Raw emotion.',
            signatureCameraStyle: 'Shaky handheld follow, Crowded street shoulder-cam, Available light interiors, Voyeuristic distance shots, Run-and-gun documentary',
            quote: 'Life as it is.'
        },
        {
            id: 'bbc_earth',
            name: 'BBC Earth',
            origin: 'Âu',
            description: 'Sự sống kỳ diệu: Tập trung vi mô (Macro) và khoảnh khắc tự nhiên hiếm có.',
            dna: 'Super macro, Slow motion (600fps), Vivid colors, Telephoto lenses.',
            signatureCameraStyle: 'Extreme macro insect, 1000fps slow motion, Animal eye-level POV, Hidden camera trap, Underwater macro',
            quote: 'The incredible story of our planet.'
        },
        {
            id: 'jia_zhangke',
            name: 'Jia Zhangke',
            origin: 'Á',
            description: 'Biến động đô thị: Sự thay đổi của con người và kiến trúc đương đại.',
            dna: 'Static long shots, Urban decay vs Modernity, Natural color palette.',
            signatureCameraStyle: 'Static wide of urban sprawl, Long take observation, Construction site frames, Train window passing shots, Factory floor depth',
            quote: 'The past is not a foreign country.'
        },
        {
            id: 'errol_morris',
            name: 'Errol Morris',
            origin: 'Âu',
            description: 'Giao tiếp trực diện: Ánh sáng studio sạch sẽ, tập trung mắt nhân vật.',
            dna: 'Interrotron style, Direct eye contact, Clean background, Dramatic lighting.',
            signatureCameraStyle: 'Interrotron direct-to-lens, Isolated subject on black, Slow zoom interview, Reenactment insert, Extreme close-up eyes',
            quote: 'The truth is not always what we want to believe.'
        },
        {
            id: 'kim_ki_duk',
            name: 'Kim Ki-duk',
            origin: 'Á',
            description: 'Bản năng thô bạo: Ánh sáng kịch tính, thô mộc, giàu tính biểu tượng.',
            dna: 'Raw texture, High contrast shadows, Symbolic objects, Silent storytelling.',
            signatureCameraStyle: 'Static symbolic tableau, Water reflection shots, Isolated figure in landscape, Overhead ritual view, Extreme shadow contrast',
            quote: 'I want to speak with images.'
        }
    ],
    music_video: [
        {
            id: 'a24_aesthetic',
            name: 'A24 Aesthetic',
            origin: 'Âu',
            description: 'Nghệ thuật đương đại: Ánh sáng mơ màng, hạt phim (Grain).',
            dna: 'Dreamy haze, Film grain, Cinematic 4:3, Earthy tones, Nostalgic feel.',
            signatureCameraStyle: 'Handheld intimacy, Natural light interiors, Static contemplative, 4:3 aspect ratio, Slow dolly emotional',
            quote: 'The studio for the modern age.'
        },
        {
            id: 'k_pop_visual',
            name: 'K-Pop Visual',
            origin: 'Á',
            description: 'Hoàn mỹ & Sắc sảo: Set quay cầu kỳ, ánh sáng studio hoàn hảo.',
            dna: 'Studio lighting, Saturated colors, Sharp focus, Precise choreography shots.',
            signatureCameraStyle: 'Dance formation wide, Beauty close-up with ring light, Quick-cut movement sync, Crane descending on group, Mirror room infinity',
            quote: 'Perfection in every frame.'
        },
        {
            id: 'park_chan_wook',
            name: 'Park Chan-wook',
            origin: 'Á',
            description: 'Bạo lực thẩm mỹ: Nghệ thuật thị giác cực mạnh, góc máy độc lạ.',
            dna: 'Extreme angles, Rich textures, Symbolic colors, Neo-noir aesthetic.',
            signatureCameraStyle: 'Extreme high angle, Split-screen parallel action, Slow-mo impact, 360 rotating fight, Voyeuristic through-window',
            quote: 'Violence is what people use to express what they feel.'
        },
        {
            id: 'michel_gondry',
            name: 'Michel Gondry',
            origin: 'Âu',
            description: 'Thủ công & Kỳ ảo: Những kỹ xảo mang tính sắp đặt thủ công.',
            dna: 'Surreal, In-camera tricks, Hand-crafted feel, Stop-motion elements.',
            signatureCameraStyle: 'Practical in-camera VFX, Stop-motion integration, Forced perspective, Seamless reality morph, Handmade set reveals',
            quote: 'I don\'t use CGI. I use my brain.'
        },
        {
            id: 'david_lachapelle',
            name: 'David LaChapelle',
            origin: 'Âu',
            description: 'Siêu thực kịch tính: Màu sắc rực rỡ quá mức, bố cục tôn giáo.',
            dna: 'Hyper-reality, Surreal colors, High fashion aesthetic, Baroque composition.',
            signatureCameraStyle: 'Baroque tableau wide, Hyper-color beauty portrait, Religious iconography framing, Underwater fantasy, Elaborate set reveal crane',
            quote: 'I\'m a storyteller, not a photographer.'
        },
        {
            id: 'satoshi_kon',
            name: 'Satoshi Kon Style',
            origin: 'Á',
            description: 'Nhòe mờ thực tại: Sự chuyển giao mượt mà giữa giấc mơ và đời thực.',
            dna: 'Match cuts, Surreal transitions, Color saturation, Blurring reality lines.',
            signatureCameraStyle: 'Match cut reality shift, Seamless dream transition, POV identity swap, Rotating reality, Time-skip match action',
            quote: 'Dreams and reality are the same thing.'
        },
        {
            id: 'gesaffelstein',
            name: 'Gesaffelstein Style',
            origin: 'Âu',
            description: 'Công nghiệp & Brutalism: Tối giản, đen trắng hoặc màu sắc cực lạnh.',
            dna: 'High contrast B&W, Industrial textures, Minimal motion, Futuristic dark.',
            signatureCameraStyle: 'Static brutalist wide, High contrast B&W close-up, Mechanical motion, Industrial environment, Slow strobing',
            quote: 'Sound of obsession.'
        },
        {
            id: 'j_pop_psychedelic',
            name: 'J-Pop Psychedelic',
            origin: 'Á',
            description: 'Rực rỡ tương lai: Màu sắc Glitch, tương lai, kỹ xảo vui nhộn.',
            dna: 'Glitch art, Psychedelic colors, Future aesthetic, High-energy editing.',
            signatureCameraStyle: 'Glitch transition cuts, Kaleidoscope effect, Speed ramping, Pop art zoom, Digital distortion overlay',
            quote: 'Vibrant chaos.'
        }
    ]
};
