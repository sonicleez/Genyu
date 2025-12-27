# Scene Director (Genyu AI) 🎬

**Scene Director** is an advanced AI-powered storyboarding and script visualization tool designed to bridge the gap between creative writing and visual production. Powered by **Google Gemini 1.5 Pro**, it enables directors, creators, and marketers to generate consistent, cinematic storyboards from simple ideas.

![Scene Director UI](https://github.com/sonicleez/Genyu_/raw/token-pool-v8/uploaded_image_1765916268998.png)

## 🚀 Key Features

### 🧠 Intelligent Scripting
- **AI-Synthesized Narrative**: Generates a sequence of visual scenes first, then synthesizes a coherent "Detailed Story" novelization strictly based on the visual flow.
- **Strict Logic Mode**: Ensures selected **Characters** and **Products** appear meaningfully in the script.
- **Visual Continuity**: Automatically enforces lighting and environmental consistency for cutaway/insert shots.
- **Custom Genres**: Create your own script presets (Music Video, TVC, Movie) with custom system prompts and tone keywords.

### 🎥 Pro Cinematography Control
- **Global Settings**: Define default Camera Body (Alexa 35, Sony Venice), Lens, and Lighting style.
- **Per-Scene Overrides**:
    - **Shot Type**: Wide, Close-up, POV, or **Custom** (e.g., "Dutch Angle from below").
    - **Lens**: 24mm, 85mm, Macro, or **Custom**.
    - **Transition**: Cut, Dissolve, Match Cut, or **Custom**.

### 🎨 Character & Product Consistency
- **Face ID & Object Consistency**: Keeps characters looking the same across scenes using reference images.
- **Strict Usage**: Logic ensures products are highlighted when mentioned.

### 🛠️ Utilities
- **Clean All**: One-click wipe to start a fresh project.
- **Download All**: Exports a structured ZIP file containing `Scenes/` (numbered sequences) and `Assets/` (Characters/Products).

## 📦 Installation & Running

This project is a React (Vite) application with a Node.js backend proxy.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/sonicleez/Genyu_.git
    cd Genyu_
    ```

2.  **Navigate to the project directory**:
    ```bash
    cd "Main"
    ```

3.  **Install Dependencies**:
    ```bash
    npm install
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The app will open at `http://localhost:5173`.

## 🔄 Recent Updates (v8)
- **Custom Cinematography**: Added free-text input for Shot Type, Lens, and Transitions per scene.
- **Logic Refinement**: "Strict Mode" for Character/Product appearance and Environmental Consistency.
- **UI UX**: Added "Clean All" button and improved "Detailed Script" visibility.
