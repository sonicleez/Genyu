
import type { ProjectState, Character, Scene } from '../types';

export const saveProject = (state: ProjectState, filename: string): void => {
  try {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to save project:", error);
    alert("Không thể lưu dự án.");
  }
};

const migrateCharacter = (char: any): Character => {
  // Logic chuyển đổi dữ liệu cũ sang mới
  if (Array.isArray(char.images)) {
    // Nếu là file cũ, lấy ảnh đầu tiên làm Face, ảnh thứ 2 làm Body
    const faceImage = char.images[0] || null;
    const bodyImage = char.images[1] || null;
    // Các ảnh còn lại coi như là props nhưng chưa có tên
    const props = char.images.slice(2).map((img: string, idx: number) => ({
        id: `prop_${Date.now()}_${idx}`,
        name: `Prop ${idx + 1}`,
        image: img
    }));
    
    // Fill cho đủ 3 props rỗng nếu thiếu
    while (props.length < 3) {
        props.push({
            id: `prop_${Date.now()}_${props.length}`,
            name: '',
            image: null
        });
    }

    return {
        ...char,
        masterImage: null, // New field
        faceImage,
        bodyImage,
        props: props.slice(0, 3), // Giới hạn 3 props
    };
  }
  // Nếu đã là cấu trúc mới nhưng thiếu masterImage (do update version)
  if (char.masterImage === undefined) {
      return { ...char, masterImage: null };
  }
  return char as Character;
};

const migrateScene = (scene: any): Scene => {
    return {
        ...scene,
        veoPrompt: scene.veoPrompt || '' // Default empty string if missing
    };
};

export const openProject = (onLoad: (state: ProjectState) => void): void => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          if (e.target && typeof e.target.result === 'string') {
            const rawData = JSON.parse(e.target.result);
            
            // Migrate characters
            const migratedCharacters = Array.isArray(rawData.characters) 
                ? rawData.characters.map(migrateCharacter)
                : [];
            
            // Migrate scenes
            const migratedScenes = Array.isArray(rawData.scenes)
                ? rawData.scenes.map(migrateScene)
                : [];

            const loadedState: ProjectState = {
                ...rawData,
                stylePrompt: rawData.stylePrompt || 'cinematic-realistic',
                imageModel: rawData.imageModel || 'gemini-2.5-flash-image',
                aspectRatio: rawData.aspectRatio || "16:9", 
                scriptLanguage: rawData.scriptLanguage || 'vietnamese',
                characters: migratedCharacters,
                scenes: migratedScenes
            };

            // Basic validation
            if (
                typeof loadedState.projectName !== 'string' ||
                !Array.isArray(loadedState.characters) ||
                !Array.isArray(loadedState.scenes)
            ) {
                throw new Error("Invalid project file format.");
            }
            onLoad(loadedState);
          }
        } catch (error) {
          console.error("Failed to open or parse project file:", error);
          alert("Tệp dự án không hợp lệ hoặc bị hỏng.");
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
};
