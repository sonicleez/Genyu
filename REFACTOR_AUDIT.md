# 🔍 AUDIT REPORT - App.tsx Refactoring

**Date:** 2025-12-15  
**File:** `Main/App.tsx`  
**Current Size:** 3,066 lines, 152KB  
**Total Components:** 94 functions/components

---

## 📊 **Current Structure Analysis**

### **1. UI Components (18 items)**
- ✅ `Header` (28 lines)
- ✅ `ProjectNameInput` (17 lines)
- ✅ `Modal` (12 lines)
- ✅ `ApiKeyModal` (79 lines)
- ✅ `GenyuTokenModal` (35 lines)
- ✅ `CoffeeModal` (9 lines)
- ✅ `CoffeeButton` (5 lines)
- ✅ `CharacterGeneratorModal` (278 lines) ⚠️ **TOO LARGE**
- ✅ `ScriptGeneratorModal` (57 lines)
- ✅ `ImageEditorModal` (104 lines)
- ✅ `SectionTitle` (4 lines)
- ✅ `SingleImageSlot` (61 lines)
- ✅ `CharacterCard` (119 lines) ⚠️ **TOO LARGE**
- ✅ `Tooltip` (6 lines)
- ✅ `ImageViewerModal` (94 lines)
- ✅ `SceneRow` (158 lines) ⚠️ **TOO LARGE**

**Issues:**
- 🔴 3 components > 100 lines (hard to maintain)
- 🔴 All in one file (hard to reuse)

---

### **2. Business Logic Functions (26 items)**

#### **State Management (7)**
- `updateStateAndRecord`
- `handleProjectNameChange`
- `handleStylePromptChange`
- `handleImageModelChange`
- `handleAspectRatioChange`
- `handleScriptLanguageChange`
- `handleSave`, `handleOpen`

#### **Character Management (5)**
- `updateCharacter`
- `pollCharacterWorkflows` (89 lines) ⚠️ **COMPLEX**
- `handleMasterImageUpload` (275 lines) 🔴 **CRITICAL - TOO LARGE**
- `handleCharGenSave`
- `setDefaultCharacter`

#### **Scene Management (4)**
- `addScene`
- `updateScene`
- `removeScene`
- `handleScriptUpload`

#### **Image Generation (5)**
- `performImageGeneration` (278 lines) 🔴 **CRITICAL - TOO LARGE**
- `generateVeoPrompt` (97 lines)
- `handleGenerateAllVeoPrompts`
- `handleGenerateAllImages`
- `handleDownloadAll`

#### **Video Generation (3)**
- `cleanToken`
- `checkVideoStatus` (89 lines)
- `handleGenerateAllVideos` (117 lines) ⚠️ **COMPLEX**

#### **Utilities (2)**
- `openEditor`
- `handleEditorSave`

**Issues:**
- 🔴 5 functions > 100 lines
- 🔴 `handleMasterImageUpload` & `performImageGeneration` are 275+ lines each!
- 🔴 No separation of concerns
- 🔴 Hard to test

---

### **3. Constants & Config (50 lines)**
- `GLOBAL_STYLES` (26 lines)
- `IMAGE_MODELS` (3 lines)
- `INITIAL_STATE` (18 lines)
- `ASPECT_RATIOS` (5 lines)
- `CHARACTER_STYLES` (8 lines)

---

### **4. Helper Functions (3)**
- `slugify`
- `generateId`
- `downloadImage`

---

## 🎯 **Refactor Plan**

### **Phase 1: Extract Services** (30 min)
**Goal:** Move API calls to dedicated service files

**Files to create:**
1. `services/geminiService.ts` (Gemini API calls)
2. `services/genyuService.ts` (Google Labs proxy calls)
3. `services/videoService.ts` (Video generation & polling)

**Functions to move:**
- `geminiService.ts`:
  - `performImageGeneration` logic
  - `generateVeoPrompt` logic
  - `handleGenerateScript` logic
  
- `genyuService.ts`:
  - `handleMasterImageUpload.callProxy`
  - Base64 image extraction logic
  
- `videoService.ts`:
  - `handleGenerateAllVideos`
  - `checkVideoStatus`
  - `cleanToken`

---

### **Phase 2: Extract Hooks** (30 min)
**Goal:** Create custom hooks for state & logic

**Files to create:**
1. `hooks/useProjectState.ts`
   - State management
   - Save/Load project
   - Undo/Redo history

2. `hooks/useCharacters.ts`
   - `updateCharacter`
   - `setDefaultCharacter`
   - `handleMasterImageUpload` (orchestration)
   - `pollCharacterWorkflows`

3. `hooks/useScenes.ts`
   - `addScene`, `updateScene`, `removeScene`
   - `handleScriptUpload`

4. `hooks/useImageGeneration.ts`
   - `handleGenerateAllImages`
   - Concurrency control

---

### **Phase 3: Extract Components** (40 min)
**Goal:** Separate UI components into individual files

**Files to create:**
1. `components/Header.tsx`
2. `components/ProjectNameInput.tsx`
3. `components/CharacterCard.tsx`
4. `components/SceneRow.tsx`
5. `components/ImageSlot.tsx`

**Modals folder:**
6. `components/modals/ApiKeyModal.tsx`
7. `components/modals/GenyuTokenModal.tsx`
8. `components/modals/CharacterGeneratorModal.tsx`
9. `components/modals/ScriptGeneratorModal.tsx`
10. `components/modals/ImageEditorModal.tsx`
11. `components/modals/ImageViewerModal.tsx`

---

### **Phase 4: Extract Constants** (10 min)
**Goal:** Centralize configuration

**File to create:**
- `utils/constants.ts`
  - `GLOBAL_STYLES`
  - `IMAGE_MODELS`
  - `INITIAL_STATE`
  - `ASPECT_RATIOS`
  - `CHARACTER_STYLES`

---

### **Phase 5: Extract Utils** (10 min)
**Goal:** Reusable utility functions

**File to create:**
- `utils/imageUtils.ts`
  - `downloadImage`
  - `base64ToBlob`
  - Image conversion helpers

**Existing:**
- `utils/fileUtils.ts` (already exists)

---

## ✅ **Expected Results**

### **Before:**
```
App.tsx: 3,066 lines
```

### **After:**
```
App.tsx: ~250 lines (main orchestration only)

services/
  geminiService.ts: ~200 lines
  genyuService.ts: ~150 lines
  videoService.ts: ~180 lines

hooks/
  useProjectState.ts: ~120 lines
  useCharacters.ts: ~200 lines
  useScenes.ts: ~80 lines
  useImageGeneration.ts: ~100 lines

components/
  Header.tsx: ~30 lines
  ProjectNameInput.tsx: ~20 lines
  CharacterCard.tsx: ~130 lines
  SceneRow.tsx: ~170 lines
  ImageSlot.tsx: ~70 lines
  
  modals/
    ApiKeyModal.tsx: ~80 lines
    GenyuTokenModal.tsx: ~40 lines
    CharacterGeneratorModal.tsx: ~290 lines
    ScriptGeneratorModal.tsx: ~60 lines
    ImageEditorModal.tsx: ~110 lines
    ImageViewerModal.tsx: ~100 lines

utils/
  constants.ts: ~60 lines
  imageUtils.ts: ~30 lines
  fileUtils.ts: ~50 lines (existing)
```

**Total files:** 22 files  
**Avg. file size:** ~100 lines (maintainable!)

---

## 🚨 **Risk Assessment**

### **Low Risk** ✅
- Constants extraction
- Utility functions

### **Medium Risk** ⚠️
- Component extraction (might break JSX structure)
- Hooks extraction (state dependencies)

### **High Risk** 🔴
- Services extraction (API calls, error handling)
- `handleMasterImageUpload` refactor (very complex)

---

## 📋 **Testing Checklist**

After refactoring, test:
- [ ] Character generation (AI direct)
- [ ] Character generation (from master image)
- [ ] Scene image generation
- [ ] Video generation
- [ ] Script upload (Excel)
- [ ] Script generation (AI)
- [ ] Save/Load project
- [ ] Image editing
- [ ] Download all images
- [ ] Hotkeys (Cmd+S, etc.)
- [ ] API key validation
- [ ] Genyu token handling

---

## 🎯 **Ready to Proceed?**

**Estimated Time:** 2 hours total  
**Commit Strategy:** After each phase  
**Rollback Plan:** Git reset to current commit

**Current Commit:** `c219737 ✅ Working: Character gen with Google Labs`
