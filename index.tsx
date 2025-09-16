import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MemoryManager, OutputManager, cleanAiResponse, Persona } from "./managers.js";
import { FileManager } from "./fileManager.js";
import { initDatingModule } from "./dating.js";
import { dateProposalInstruction, commonSystemInstruction } from "./personas.js";
import { initStoryModule, invalidateStoryCache } from "./story.js";

declare var JSZip: any;

// --- API Configuration ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// --- DOM Elements ---
const personaSelectionView = document.getElementById('persona-selection-view')!;
const chatView = document.getElementById('chat-view')!;
const femalePersonaList = document.getElementById('female-persona-list')!;
const malePersonaList = document.getElementById('male-persona-list')!;
const backButton = document.getElementById('back-button')!;
const chatHeaderName = document.getElementById('chat-header-name')!;
const chatHeaderAvatarContainer = document.getElementById('chat-header-avatar-container')!;
const messageInput = document.getElementById('message-input') as HTMLInputElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const chatContainer = document.getElementById('chat-container')!;
const loadingIndicator = document.getElementById('loading-indicator')!;
const loadingText = document.getElementById('loading-text') as HTMLSpanElement;
const chatStatus = document.getElementById('chat-status')!;
const errorMessage = document.getElementById('error-message')!;
const avatarUploadInput = document.getElementById('avatar-upload-input') as HTMLInputElement;
const downloadChatBtn = document.getElementById('download-chat-btn') as HTMLButtonElement;
const downloadAllChatsBtn = document.getElementById('download-all-chats-btn') as HTMLButtonElement;
const downloadImagesBtn = document.getElementById('download-images-btn') as HTMLButtonElement;
const uploadZipBtn = document.getElementById('upload-zip-btn')!;
const zipUploadInput = document.getElementById('zip-upload-input') as HTMLInputElement;
const giftButton = document.getElementById('gift-button') as HTMLButtonElement;
const giftUploadInput = document.getElementById('gift-upload-input') as HTMLInputElement;
const giftPreviewContainer = document.getElementById('gift-preview-container')!;
const giftPreviewImage = document.getElementById('gift-preview-image') as HTMLImageElement;
const removeGiftBtn = document.getElementById('remove-gift-btn')!;
const createPersonaBtn = document.getElementById('create-persona-btn')!;
const clearChatBtn = document.getElementById('clear-chat-btn')!;

// Persona Creator Elements
const personaCreatorModal = document.getElementById('persona-creator-modal')!;
const closeCreatorModal = document.getElementById('close-creator-modal')!;
const randomizePersonaBtn = document.getElementById('randomize-persona-btn') as HTMLButtonElement;
const diceIcon = document.getElementById('dice-icon')!;
const diceLoadingIcon = document.getElementById('dice-loading-icon')!;
const creatorStep1 = document.getElementById('creator-step-1')!;
const creatorStep2 = document.getElementById('creator-step-2')!;
const personaNameInput = document.getElementById('persona-name') as HTMLInputElement;
const fictionalPersonaCheckbox = document.getElementById('fictional-persona-checkbox') as HTMLInputElement;
const clubSelectionContainer = document.getElementById('club-selection-container')!;
const personaClubSelect = document.getElementById('persona-club') as HTMLSelectElement;
const customClubContainer = document.getElementById('custom-club-container')!;
const personaCustomClubInput = document.getElementById('persona-custom-club') as HTMLInputElement;
const generatePersonaBtn = document.getElementById('generate-persona') as HTMLButtonElement;
const cancelCreatorBtn = document.getElementById('cancel-creator')!;
const backToStep1Btn = document.getElementById('back-to-step1')!;
const savePersonaBtn = document.getElementById('save-persona')!;
const generatedPersonaPreview = document.getElementById('generated-persona-preview')!;

// Avatar Prompt Editor Elements
const editAvatarPromptModal = document.getElementById('edit-avatar-prompt-modal')!;
const closePromptModal = document.getElementById('close-prompt-modal')!;
const avatarPromptEditor = document.getElementById('avatar-prompt-editor') as HTMLTextAreaElement;
const cancelPromptEdit = document.getElementById('cancel-prompt-edit')!;
const savePromptEdit = document.getElementById('save-prompt-edit') as HTMLButtonElement;

// Dating Module Elements
const dateBtn = document.getElementById('date-btn')!;

// AI Date Proposal Modal Elements
const dateProposalModal = document.getElementById('date-proposal-modal')!;
const dateProposalAvatar = document.getElementById('date-proposal-avatar')!;
const dateProposalName = document.getElementById('date-proposal-name')!;
const dateProposalText = document.getElementById('date-proposal-text')!;
const dateProposalLocation = document.getElementById('date-proposal-location')!;
const dateProposalDuration = document.getElementById('date-proposal-duration')!;
const declineDateBtn = document.getElementById('decline-date-btn')!;
const acceptDateBtn = document.getElementById('accept-date-btn')!;

// --- Managers ---
const memoryManager = new MemoryManager(ai);
const outputManager = new OutputManager({
    appendMessage,
    executePhotoGeneration,
    getPolicyViolationResponse,
    showDateProposal,
}, ai);

const fileManager = new FileManager(memoryManager, {
    downloadAllChatsBtn,
    downloadImagesBtn,
    onSingleChatRestored: (key, history) => {
        renderPersonaList();
        startChat(key, history);
    },
    onAllDataRestored: () => {
        renderPersonaList();
        alert("所有對話、角色與記憶資料已成功還原！");
        showSelectionView();
    }
});


// --- State ---
let currentPersona: any = null;
let currentPersonaKey: string | null = null;
let currentPersonaKeyForUpload: string | null = null;
let currentPersonaKeyForPromptEdit: string | null = null;
let generatedPersonaData: any = null;
let attachedGift: { file: File, dataUrl: string } | null = null;
let isDeletingPersona = false;
let currentProposal: { location: string, duration: number } | null = null;
let datingModule: any;


// --- Functions ---

const showPersonaCreator = () => {
    personaCreatorModal.classList.remove('hidden');
    creatorStep1.classList.remove('hidden');
    creatorStep2.classList.add('hidden');

    personaNameInput.value = '';
    fictionalPersonaCheckbox.checked = false;
    clubSelectionContainer.classList.remove('hidden');
    personaClubSelect.value = '健身社'; // Default to first option
    customClubContainer.classList.add('hidden');
    personaCustomClubInput.value = '';
    (document.querySelector('input[name="persona-gender"][value="female"]') as HTMLInputElement).checked = true;
    generatedPersonaData = null;
};

const hidePersonaCreator = () => {
    personaCreatorModal.classList.add('hidden');
};

const randomizePersonaInputs = async () => {
    // Set loading state
    randomizePersonaBtn.disabled = true;
    diceIcon.classList.add('hidden');
    diceLoadingIcon.classList.remove('hidden');
    personaNameInput.disabled = true;
    personaClubSelect.disabled = true;
    personaCustomClubInput.disabled = true;

    try {
        const prompt = `請為一個戀愛聊天應用程式，生成一個富有創意且獨特的角色概念。
        請提供以下資訊：
        1.  **name**: 一個常見的兩個字的台灣名字，不用姓氏。例如："若薇" 或 "子軒"。
        2.  **club**: 一個學校社團名稱。可以是常見的（例如："籃球社"），也可以是創意的（例如："都市傳說研究社"）。
        3.  **gender**: 'male' 或 'female'。

        請嚴格遵循以下的 JSON 格式，直接輸出純文字的JSON物件，不要包含任何Markdown的程式碼區塊標記（例如 \`\`\`json ... \`\`\`）。`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                club: { type: Type.STRING },
                gender: { type: Type.STRING },
            },
            required: ["name", "club", "gender"],
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const jsonStr = response.text.trim();
        const parsed = JSON.parse(jsonStr);

        // Populate fields
        personaNameInput.value = parsed.name;

        // Populate club select/input
        const clubOptions = Array.from(personaClubSelect.options).map(opt => opt.value);
        if (clubOptions.includes(parsed.club)) {
            personaClubSelect.value = parsed.club;
            customClubContainer.classList.add('hidden');
            personaCustomClubInput.value = '';
        } else {
            personaClubSelect.value = 'other';
            customClubContainer.classList.remove('hidden');
            personaCustomClubInput.value = parsed.club;
        }

        // Set gender
        const genderRadio = document.querySelector(`input[name="persona-gender"][value="${parsed.gender}"]`) as HTMLInputElement;
        if (genderRadio) {
            genderRadio.checked = true;
        }

    } catch (error) {
        console.error('隨機角色生成錯誤:', error);
        alert(`隨機角色生成失敗: ${error}`);
    } finally {
        // Unset loading state
        randomizePersonaBtn.disabled = false;
        diceIcon.classList.remove('hidden');
        diceLoadingIcon.classList.add('hidden');
        personaNameInput.disabled = false;
        personaClubSelect.disabled = false;
        personaCustomClubInput.disabled = false;
    }
};

const generatePersonaFromAI = async () => {
    const name = personaNameInput.value.trim();
    const gender = (document.querySelector('input[name="persona-gender"]:checked') as HTMLInputElement)?.value;
    const isFictional = fictionalPersonaCheckbox.checked;

    if (!name || !gender) {
        alert('請填寫角色名稱和性別');
        return;
    }

    generatePersonaBtn.disabled = true;
    generatePersonaBtn.textContent = '生成中...';

    try {
        let prompt: string;
        let schema: any;

        if (isFictional) {
            prompt = `請為一個戀愛聊天應用程式，根據以下提供的角色名稱，創建一個完整、詳細的角色設定。

**角色名稱：** ${name}
**角色性別：** ${gender === 'female' ? '女性' : '男性'}

**任務與規則：**
1.  **辨識與改編**：如果「角色名稱」是一個知名的真實歷史人物、神話角色或虛構作品人物（例如：德川家康、雅典娜），請以該人物的性格與背景為基礎，將其重新想像成一名現代校園的學長或學姊。若非知名人物，則自由發揮創意。
2.  **創造社團 (club)**：為這個角色創造一個最符合其人物特質的、獨一無二的「學校社團名稱」。
3.  **生成人設 (prompt)**：根據角色原型和新創造的社團，擴展成一個詳細、約200字的創意角色扮演設定。此內容**僅包含**角色的自稱方式、語氣、個性、說話習慣、對親密互動的詳細描述。**絕不包含**任何系統指令，如拍照能力、禁止使用刪節號或Markdown等。
4.  **生成其他欄位**：
    *   \`emoji\`: 一個最能代表角色的 emoji。
    *   \`description\`: 一句15字以內的特色描述，格式為「[你創造的社團]的[形容詞]學長/姊」。
    *   \`greeting\`: 一句約50字、符合角色個性的招呼語。
    *   \`avatarPrompt\`: 一段用於AI繪圖的英文角色外觀描述，營造「RAW檔照片」的真實感。必須嚴格遵循以下風格：以「RAW photo,」開頭，接著是人物描述，然後是場景。最後是相機設定，例如「Sony A7R V + 85mm f/1.4, shallow DOF, natural lighting, photojournalistic style.」，並加入強調真實感的詞彙，例如「Visible skin texture and pores, authentic candid moment, film grain, high ISO.」。絕不能使用「hyperrealistic」或「cinematic」等詞彙。
5.  **純文字輸出**：所有輸出的文字內容都必須是純文字，絕不包含任何 Markdown 語法（例如 \`**\` 或 \`*\`）。

請直接輸出純文字的JSON物件，不要包含任何Markdown的程式碼區塊標記（例如 \`\`\`json ... \`\`\`）。`;

            schema = {
                type: Type.OBJECT,
                properties: {
                    club: { type: Type.STRING },
                    emoji: { type: Type.STRING },
                    description: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    greeting: { type: Type.STRING },
                    avatarPrompt: { type: Type.STRING },
                },
                required: ["club", "emoji", "description", "prompt", "greeting", "avatarPrompt"]
            };

        } else {
            let club = personaClubSelect.value;
            if (club === 'other') {
                club = personaCustomClubInput.value.trim();
            }
             if (!club) {
                alert('請選擇或輸入社團');
                generatePersonaBtn.disabled = false;
                generatePersonaBtn.textContent = '生成角色';
                return;
            }

            prompt = `請為以下角色創建詳細的人格設定，嚴格遵守「男女朋友」的框架：

角色名稱：${name}
所屬社團：${club}
角色性別：${gender === 'female' ? '女性' : '男性'}

請嚴格遵循以下規則與格式，生成JSON物件：
1. **生成人設 (prompt)**：根據社團特色，擴展成一個詳細、約200字的創意角色扮演設定。此內容**僅包含**角色的自稱方式、語氣、個性、說話習慣、對親密互動的詳細描述。**絕不包含**任何系統指令，如拍照能力、禁止使用刪節號或Markdown等。
2. **生成其他欄位**：
    * \`emoji\`: 一個最能代表角色的 emoji。
    * \`description\`: 一句15字以內的特色描述，格式為「[社團]的[形容詞]學長/姊」。
    * \`greeting\`: 一句約50字、符合角色個性的招呼語。
    * \`avatarPrompt\`: 一段用於AI繪圖的英文角色外觀描述，營造「RAW檔照片」的真實感。必須嚴格遵循以下風格：以「RAW photo,」開頭，接著是人物描述，然後是場景。最後是相機設定，例如「Sony A7R V + 85mm f/1.4, shallow DOF, natural lighting, photojournalistic style.」，並加入強調真實感的詞彙，例如「Visible skin texture and pores, authentic candid moment, film grain, high ISO.」。絕不能使用「hyperrealistic」或「cinematic」等詞彙。
3. **純文字輸出**：所有輸出的文字內容都必須是純文字，絕不包含任何 Markdown 語法（例如 \`**\` 或 \`*\`）。

請直接輸出純文字的JSON物件，不要包含任何Markdown的程式碼區塊標記（例如 \`\`\`json ... \`\`\`）。`;

            schema = {
                type: Type.OBJECT,
                properties: {
                    emoji: { type: Type.STRING },
                    description: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    greeting: { type: Type.STRING },
                    avatarPrompt: { type: Type.STRING },
                },
                required: ["emoji", "description", "prompt", "greeting", "avatarPrompt"]
            };
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const jsonStr = response.text.trim();
        generatedPersonaData = JSON.parse(jsonStr);
        
        // Store the creative-only part of the prompt for the editor
        generatedPersonaData.creativePrompt = generatedPersonaData.prompt;

        generatedPersonaData.name = name;
        generatedPersonaData.gender = gender;

        showPersonaPreview();

    } catch (error) {
        console.error('角色生成錯誤:', error);
        alert(`角色生成失敗: ${error}`);
    } finally {
        generatePersonaBtn.disabled = false;
        generatePersonaBtn.textContent = '生成角色';
    }
};


const showPersonaPreview = () => {
    if (!generatedPersonaData) return;

    creatorStep1.classList.add('hidden');
    creatorStep2.classList.remove('hidden');

    generatedPersonaPreview.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center space-x-3">
                <div class="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-2xl">${generatedPersonaData.emoji}</div>
                <div>
                    <h4 class="font-bold text-lg text-white">${generatedPersonaData.name}</h4>
                    <p class="text-sm text-gray-400">${generatedPersonaData.description}</p>
                    <p class="text-xs text-gray-500 mt-1">性別: ${generatedPersonaData.gender === 'female' ? '女性' : '男性'}</p>
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">角色設定 (僅顯示創意部分)</label>
                <textarea id="edit-prompt" class="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400 h-32">${generatedPersonaData.creativePrompt}</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">招呼語</label>
                <textarea id="edit-greeting" class="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400 h-20">${generatedPersonaData.greeting}</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">頭像描述 (英文)</label>
                <textarea id="edit-avatar-prompt" class="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400 h-20">${generatedPersonaData.avatarPrompt}</textarea>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Emoji</label>
                <input type="text" id="edit-emoji" class="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400" value="${generatedPersonaData.emoji}" maxlength="2">
            </div>
             ${generatedPersonaData.club ? `
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">所屬社團</label>
                <input type="text" id="edit-club" class="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400" value="${generatedPersonaData.club}" disabled>
            </div>` : ''}
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">角色描述</label>
                <input type="text" id="edit-description" class="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400" value="${generatedPersonaData.description}">
            </div>
        </div>
    `;
};


const saveCustomPersona = () => {
    if (!generatedPersonaData) return;

    const editedCreativePrompt = (document.getElementById('edit-prompt') as HTMLTextAreaElement).value;
    
    // Re-attach the common system instructions to the user-edited creative prompt
    generatedPersonaData.prompt = `${editedCreativePrompt} ${commonSystemInstruction}`;
    
    generatedPersonaData.greeting = (document.getElementById('edit-greeting') as HTMLTextAreaElement).value;
    generatedPersonaData.avatarPrompt = (document.getElementById('edit-avatar-prompt') as HTMLTextAreaElement).value;
    generatedPersonaData.emoji = (document.getElementById('edit-emoji') as HTMLInputElement).value;
    generatedPersonaData.description = (document.getElementById('edit-description') as HTMLInputElement).value;

    memoryManager.saveCustomPersona(generatedPersonaData);

    renderPersonaList();
    hidePersonaCreator();

    alert('角色創建成功！');
};

const deleteCustomPersona = (key: string) => {
    if (isDeletingPersona) return;
    if (!key.startsWith('custom_')) return;

    isDeletingPersona = true;

    try {
        if (memoryManager.deleteCustomPersona(key)) {
            renderPersonaList();
        }
    } finally {
        isDeletingPersona = false;
    }
};

function getPolicyViolationResponse(persona: any) {
    return "嗯…你說的話好像有點太直接了，我不知道該怎麼回應…可以換個方式說嗎？";
};

const getSystemPhotoFailResponse = (persona: any, action: string | null) => {
    const actionText = action ? `要我${action}嗎…？` : '';
    return `${actionText}奇怪…相機好像怪怪的…請、請給我一點時間…！`;
};

const getSystemErrorResponse = (persona: any) => {
    return "啊…我的腦袋突然一片空白…請、請給我一點時間…我馬上就好…！";
};

const renderPersonaList = () => {
    femalePersonaList.innerHTML = '';
    malePersonaList.innerHTML = '';
    const personas = memoryManager.getAllPersonas();

    for (const key in personas) {
        const persona = personas[key];
        const card = document.createElement('div');
        card.className = 'persona-card group rounded-lg shadow-lg relative';
        card.dataset.key = key;

        card.innerHTML = `
            <div id="avatar-container-${key}" class="avatar-container persona-avatar rounded-t-lg">
                <div id="avatar-${key}" class="w-full h-full object-cover flex items-center justify-center text-gray-400 ${persona.avatarUrl ? '' : 'emoji-avatar'}">
                    ${persona.avatarUrl ? `<img src="${persona.avatarUrl}" alt="${persona.name}" class="w-full h-full rounded-t-lg object-cover">` : `<span class="text-6xl">${persona.emoji}</span>`}
                </div>
                <div id="avatar-loading-${key}" class="avatar-loading-overlay hidden">
                    <svg class="animate-spin h-8 w-8 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
            </div>
            <div class="p-3 bg-black/25 rounded-b-lg">
                <h3 class="font-bold text-md text-gray-100 truncate">${persona.name}</h3>
                <p class="text-sm text-gray-400 truncate">${persona.description}</p>
            </div>
            <div class="card-buttons">
                <button title="生成頭像" class="generate-avatar-btn p-2 rounded-full" data-key="${key}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-white"><path fill-rule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-3.69l-2.78-2.78a.75.75 0 00-1.06 0L12 10.94l-1.72-1.72a.75.75 0 00-1.06 0L6 12.44l-1.72-1.72a.75.75 0 00-1.06 0L2.5 11.06zM15 6.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" clip-rule="evenodd" /></svg></button>
                <button title="編輯提示詞" class="edit-prompt-btn p-2 rounded-full" data-key="${key}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-white"><path d="M10.362 2.285a.75.75 0 00-1.06-1.06l-7.5 7.5a.75.75 0 000 1.06l7.5 7.5a.75.75 0 001.06-1.06L3.872 10l6.49-6.655a.75.75 0 000-1.06z" /><path d="M14.112 2.285a.75.75 0 00-1.06-1.06l-7.5 7.5a.75.75 0 000 1.06l7.5 7.5a.75.75 0 001.06-1.06L7.622 10l6.49-6.655a.75.75 0 000-1.06z" /></svg></button>
                <button title="上傳頭像" class="upload-avatar-btn p-2 rounded-full" data-key="${key}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-white"><path fill-rule="evenodd" d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.158 2.158a.75.75 0 001.06-1.06l-3.5-3.5a.75.75 0 00-1.06 0l-3.5 3.5a.75.75 0 101.06 1.06L9.25 4.636v8.614z" clip-rule="evenodd" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg></button>
                 ${key.startsWith('custom_') ? `<button title="刪除" class="delete-persona-btn p-2 rounded-full" data-key="${key}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 text-white"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25-.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" /></svg></button>` : ''}
            </div>
        `;

        if (persona.gender === 'female') {
            femalePersonaList.appendChild(card);
        } else {
            malePersonaList.appendChild(card);
        }
    }

    document.querySelectorAll('.persona-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const key = (e.currentTarget as HTMLElement).dataset.key!;
            startChat(key);
        });
    });

    document.querySelectorAll('.generate-avatar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = (e.currentTarget as HTMLElement).dataset.key!;
            generateAvatar(key);
        });
    });

    document.querySelectorAll('.upload-avatar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = (e.currentTarget as HTMLElement).dataset.key!;
            currentPersonaKeyForUpload = key;
            avatarUploadInput.click();
        });
    });

    document.querySelectorAll('.edit-prompt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = (e.currentTarget as HTMLElement).dataset.key!;
            showAvatarPromptEditor(key);
        });
    });

    document.querySelectorAll('.delete-persona-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const key = (e.currentTarget as HTMLElement).dataset.key!;

            setTimeout(() => {
                deleteCustomPersona(key);
            }, 0);
        });
    });
};

function startChat(key: string, restoredHistory: any[] | null = null) {
    currentPersonaKey = key;
    currentPersona = memoryManager.getPersona(key);
    if (!currentPersona) {
        console.error("Persona not found for key:", key);
        return;
    }

    personaSelectionView.classList.add('hidden');
    chatView.classList.remove('hidden');
    chatView.classList.add('flex');

    chatHeaderName.textContent = currentPersona.name;

    while (chatHeaderAvatarContainer.firstChild) {
        chatHeaderAvatarContainer.removeChild(chatHeaderAvatarContainer.firstChild);
    }

    if (currentPersona.avatarUrl) {
        const img = document.createElement('img');
        img.src = currentPersona.avatarUrl;
        img.alt = 'avatar';
        img.className = 'w-12 h-12 rounded-full object-cover';
        chatHeaderAvatarContainer.appendChild(img);
    } else {
        const emojiDiv = document.createElement('div');
        emojiDiv.className = 'w-12 h-12 rounded-full bg-gray-700 text-2xl flex items-center justify-center text-gray-300';
        emojiDiv.textContent = currentPersona.emoji;
        chatHeaderAvatarContainer.appendChild(emojiDiv);
    }

    chatContainer.innerHTML = '';

    if (restoredHistory) {
        memoryManager.setChatHistory(key, restoredHistory);
    }

    const chatHistory = memoryManager.getChatHistory(key);

    chatHistory.forEach(msg => {
        if (msg.role === 'system') return; // Do not render system messages
        const sender = msg.role === 'model' ? 'bot' : 'user';
        appendMessage(msg.content, sender);
    });
};

const showSelectionView = () => {
    chatView.classList.add('hidden');
    chatView.classList.remove('flex');
    personaSelectionView.classList.remove('hidden');
    currentPersona = null;
    currentPersonaKey = null;
};

const clearChat = () => {
    if (!currentPersonaKey) return;
    memoryManager.clearChatHistory(currentPersonaKey);
    invalidateStoryCache(currentPersonaKey);
    startChat(currentPersonaKey);
};

const generateAvatar = async (personaKey: string) => {
    const persona = memoryManager.getPersona(personaKey);
    if (!persona) return;

    const loadingOverlay = document.getElementById(`avatar-loading-${personaKey}`)!;
    loadingOverlay.classList.remove('hidden');

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: persona.avatarPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64Data = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/png;base64,${base64Data}`;
            
            memoryManager.updatePersona(personaKey, { avatarUrl: imageUrl });

            const avatarElement = document.getElementById(`avatar-${personaKey}`)!;
            avatarElement.innerHTML = `<img src="${imageUrl}" alt="${persona.name}" class="w-full h-full rounded-t-lg object-cover">`;
            avatarElement.classList.remove('emoji-avatar');
        } else {
            throw new Error('API 回應中未找到圖片資料');
        }

    } catch (error) {
        console.error("頭像生成錯誤:", error);
        alert(`頭像生成失敗：${error}`);
    } finally {
        loadingOverlay.classList.add('hidden');
    }
};

const handleAvatarUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !currentPersonaKeyForUpload) return;
    const personaKey = currentPersonaKeyForUpload;
    const persona = memoryManager.getPersona(personaKey);
    if (!persona) return;


    const reader = new FileReader();
    reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        memoryManager.updatePersona(personaKey, { avatarUrl: imageUrl });
        const avatarElement = document.getElementById(`avatar-${personaKey}`)!;
        avatarElement.innerHTML = `<img src="${imageUrl}" alt="${persona.name}" class="w-full h-full rounded-t-lg object-cover">`;
        avatarElement.classList.remove('emoji-avatar');
        currentPersonaKeyForUpload = null;
    };
    reader.readAsDataURL(file);
    target.value = '';
};

const handleGiftSelection = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        attachedGift = { file, dataUrl };
        giftPreviewImage.src = dataUrl;
        giftPreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
    target.value = '';
};

const removeGift = () => {
    attachedGift = null;
    giftPreviewContainer.classList.add('hidden');
    giftPreviewImage.src = '';
};

const sendMessage = async () => {
    const message = messageInput.value.trim();
    if ((!message && !attachedGift) || !currentPersona || !currentPersonaKey) return;

    const currentKey = currentPersonaKey;

    if (loadingText) loadingText.textContent = '思考中...';
    showLoading(true);

    try {
        if (attachedGift) {
            const giftDataUrl = attachedGift.dataUrl;
            const giftToSend = attachedGift;
            removeGift();

            const giftContent = { imageUrl: giftDataUrl };
            appendMessage(giftContent, 'user');
            memoryManager.addMessage(currentKey, 'user', giftContent);

            if (message) {
                const textContent = { text: message };
                appendMessage(textContent, 'user');
                memoryManager.addMessage(currentKey, 'user', textContent);
            }
            messageInput.value = '';

            const imagePart = base64ToPart(giftToSend.dataUrl);
            const textPrompt = `我送了這件禮物給你。${message ? `我還說了：「${message}」` : ''}
請先對這份禮物發表感謝與評論。
接著，請判斷禮物的類型，並想像一個你會如何跟這個禮物互動並拍照的情境，為此生成一個用於AI繪圖的英文描述。
最後，請嚴格依照以下的 JSON 格式回應，不要有任何其他文字：
{
  "comment": "(你對禮物的評論)",
  "gift_type": "('clothing', 'accessory', 'object' 三選一)",
  "photo_prompt": "(一個簡短、安全、用於AI繪圖的英文**動作描述**，描述你和禮物的互動，例如：'wearing this new shirt and smiling', 'holding the teddy bear close to her chest', 'putting on the necklace')"
}`;

            const schema = {
                type: Type.OBJECT,
                properties: {
                    comment: { type: Type.STRING, description: "The persona's comment on the gift." },
                    gift_type: { type: Type.STRING, description: "The type of gift. Must be one of: 'clothing', 'accessory', 'object'." },
                    photo_prompt: { type: Type.STRING, description: "A short, SFW English prompt for an AI image generator describing the interaction with the gift." },
                },
                required: ["comment", "gift_type", "photo_prompt"]
            };

            let parsed;
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [imagePart, { text: textPrompt }] },
                    config: {
                        systemInstruction: currentPersona.prompt,
                        responseMimeType: "application/json",
                        responseSchema: schema,
                    }
                });

                const jsonStr = response.text;
                if (!jsonStr) {
                    throw new Error("API response was empty or blocked.");
                }
                parsed = JSON.parse(jsonStr.trim());

            } catch (apiError) {
                console.error("Failed to get gift comment/prompt:", apiError);
                const errorContent = { text: getSystemErrorResponse(currentPersona) };
                appendMessage(errorContent, 'bot');
                memoryManager.addMessage(currentKey, 'model', errorContent);
                showLoading(false);
                return;
            }


            if (parsed.comment) {
                const commentContent = { text: parsed.comment };
                appendMessage(commentContent, 'bot');
                memoryManager.addMessage(currentKey, 'model', commentContent);
            }

            if (parsed.photo_prompt && parsed.gift_type) {
                await executeGiftPhotoGeneration(parsed.photo_prompt, parsed.gift_type, giftToSend);
            }

        } else {
            const userContent = { text: message };
            appendMessage(userContent, 'user');
            memoryManager.addMessage(currentKey, 'user', userContent);
            messageInput.value = '';

            const apiChatHistory = memoryManager.getChatHistory(currentKey)
                .map(item => {
                    // System messages are handled in systemInstruction, not chat history
                    if (item.role === 'system') return null;

                    const role = item.role === 'model' ? 'model' : 'user';
                    if (item.content.text) {
                        return { role, parts: [{ text: item.content.text }] };
                    }
                    // Ignore images for general chat history to save tokens
                    return null;
                })
                .filter(Boolean);
            
            let systemInstruction = `${currentPersona.prompt}`;
            
            // Add recent memories to system instruction for context
            const recentMemories = memoryManager.getKeyMemories(currentKey).slice(-5); // Get last 5 memories
            if (recentMemories.length > 0) {
                const memoryContext = recentMemories.map(mem => `- ${mem.replace('[約會回憶] ', '')}`).join('\n');
                systemInstruction += `\n\n請在對話中自然地融入或參考以下我們最近的共同回憶，這會讓你的回應更貼心：\n${memoryContext}`;
            }

            // Conditionally add date proposal ability
            if(memoryManager.canProposeDate(currentKey)) {
                systemInstruction += dateProposalInstruction;
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: apiChatHistory as any,
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            let rawText;
            try {
                rawText = response.text;
            } catch (e) {
                console.warn("Could not access response.text, likely due to safety settings.", e);
                rawText = null;
            }

            if (rawText) {
                await outputManager.process(rawText, currentPersona, currentKey, memoryManager);
            } else {
                console.error("API returned empty or blocked response.");
                // Since this is a non-exception failure, we still need to show a response
                const errorContent = { text: getPolicyViolationResponse(currentPersona) };
                appendMessage(errorContent, 'bot');
                memoryManager.addMessage(currentKey, 'model', errorContent);
            }
        }
        showError(null);
    } catch (error) {
        console.error('API 呼叫錯誤:', error);
        showError(`發生錯誤: ${error}`);
        const errorContent = { text: getSystemErrorResponse(currentPersona) };
        appendMessage(errorContent, 'bot');
        if (currentPersonaKey) {
            memoryManager.addMessage(currentPersonaKey, 'model', errorContent);
        }
    } finally {
        showLoading(false);
    }
};

const ensureBase64Avatar = async (avatarUrl: string): Promise<string> => {
    if (avatarUrl.startsWith('data:image')) {
        return avatarUrl;
    }
    try {
        const response = await fetch(avatarUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Failed to convert avatar URL to base64:", error);
        throw new Error("Could not load persona's default avatar.");
    }
};


const executeGiftPhotoGeneration = async (photoPrompt: string, giftType: string, gift: { file: File, dataUrl: string }) => {
    if (loadingText) loadingText.textContent = '拍攝中...';
    if (!currentPersonaKey) return;
    const currentKey = currentPersonaKey;

    try {
        let imageUrl: string;

        if (currentPersona.avatarUrl) {
            const personaAvatarBase64 = await ensureBase64Avatar(currentPersona.avatarUrl);
            const personaImagePart = base64ToPart(personaAvatarBase64);
            const giftImagePart = base64ToPart(gift.dataUrl);

            let editText;
            if (giftType === 'clothing') {
                editText = `You are a virtual try-on expert. Your task is to transfer clothing from one person to another. The first image contains the target person whose identity, face, and hair must be perfectly preserved. The second image contains the clothing item you need to transfer. Ignore the person wearing the clothes in the second image; focus only on the clothing itself. Realistically place this clothing onto the person from the first image, replacing their original outfit. The final image must be a seamless, photorealistic photograph maintaining the original style and the target person's identity.`;
            } else { // 'accessory' or 'object'
                editText = `You are an expert photo editor. Edit the first image (the person) to show them interacting with the second image (the gift object) as described here: "${photoPrompt}". The final result must be a realistic photograph that seamlessly blends the person and the object. You must preserve the person's exact facial features, identity, and the original photo's realistic style. Do not produce anime, cartoons, or drawings.`;
            }
            const textPart = { text: editText };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [personaImagePart, giftImagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (imagePartFromResponse?.inlineData) {
                imageUrl = `data:${imagePartFromResponse.inlineData.mimeType};base64,${imagePartFromResponse.inlineData.data}`;
            } else {
                throw new Error("API did not return an edited image for the gift interaction.");
            }
        } else {
            // This case handles personas without any avatar. It generates a new image based on the prompt.
            const finalImagePrompt = `${currentPersona.avatarPrompt.replace(/[^\w\s,.-]/g, '')}, interaction: ${photoPrompt}. The final image must be a photograph in a realistic, RAW photo style, not anime or a drawing.`;
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: finalImagePrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                imageUrl = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
            } else {
                throw new Error("API did not return an image for the gift interaction.");
            }
        }

        const imageContent = { imageUrl: imageUrl };
        appendMessage(imageContent, 'bot');
        memoryManager.addMessage(currentKey, 'model', imageContent);

    } catch (error) {
        console.error("Gift photo generation execution error:", error);
        const failContent = { text: getSystemPhotoFailResponse(currentPersona, '與禮物合照') };
        appendMessage(failContent, 'bot');
        memoryManager.addMessage(currentKey, 'model', failContent);
    }
};

async function executePhotoGeneration(photoPrompt: string) {
    if (loadingText) loadingText.textContent = '拍攝中...';
    if (!currentPersonaKey) return;
    const currentKey = currentPersonaKey;

    try {
        let imageUrl: string;

        if (currentPersona.avatarUrl) {
            const personaAvatarBase64 = await ensureBase64Avatar(currentPersona.avatarUrl);
            const imagePart = base64ToPart(personaAvatarBase64);
            const textPart = { text: `You are an expert at creating new photos from an existing one. Use the provided image as a reference for the person's identity (face, hair, features), which you must preserve perfectly. Your task is to generate a completely new photograph of this person based on the following instructions: "${photoPrompt}". Feel free to significantly change the pose, expression, clothing, and the background to create a dynamic and interesting new image that matches the prompt. The final result must be a realistic photograph in the same style as the original, not an anime or drawing.` };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (imagePartFromResponse?.inlineData) {
                imageUrl = `data:${imagePartFromResponse.inlineData.mimeType};base64,${imagePartFromResponse.inlineData.data}`;
            } else {
                throw new Error("API did not return an edited image.");
            }
        } else {
            const finalImagePrompt = `${currentPersona.avatarPrompt.replace(/[^\w\s,.-]/g, '')}, with expression: ${photoPrompt}. The final image must be a photograph in a realistic, RAW photo style, not anime or a drawing.`;
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: finalImagePrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/png',
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                imageUrl = `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
            } else {
                throw new Error("API 未返回圖片");
            }
        }

        const imageContent = { imageUrl: imageUrl };
        appendMessage(imageContent, 'bot');
        memoryManager.addMessage(currentKey, 'model', imageContent);

    } catch (error) {
        console.error("照片生成執行錯誤:", error);
        const failContent = { text: getSystemPhotoFailResponse(currentPersona, null) };
        appendMessage(failContent, 'bot');
        memoryManager.addMessage(currentKey, 'model', failContent);
    }
};

const base64ToPart = (base64Data: string) => {
    const match = base64Data.match(/^data:(image\/.+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid base64 data URL");
    }
    return {
        inlineData: {
            mimeType: match[1],
            data: match[2]
        }
    };
};

function appendMessage(content: { text?: string; imageUrl?: string }, sender: 'user' | 'bot') {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('flex', 'items-end', 'gap-2', sender === 'user' ? 'flex-row-reverse' : 'flex-row');

    if (sender === 'bot') {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'w-8 h-8 rounded-full flex-shrink-0 bg-gray-700';
        if (currentPersona.avatarUrl) {
            avatarDiv.innerHTML = `<img src="${currentPersona.avatarUrl}" class="w-full h-full rounded-full object-cover">`;
        } else {
            avatarDiv.classList.add('flex', 'items-center', 'justify-center', 'text-lg');
            avatarDiv.textContent = currentPersona.emoji;
        }
        messageWrapper.appendChild(avatarDiv);
    }

    const messageBubble = document.createElement('div');
    messageBubble.classList.add('chat-bubble', 'rounded-lg', 'shadow-sm');

    if (content.imageUrl) {
        messageBubble.classList.add('p-0');
        messageBubble.style.backgroundColor = 'transparent';
        const image = document.createElement('img');
        image.src = content.imageUrl;
        image.className = 'chat-image';
        messageBubble.appendChild(image);
    } else if (content.text) {
        messageBubble.classList.add('p-3', sender === 'user' ? 'user-bubble' : 'bot-bubble');
        const formattedMessage = document.createElement('span');
        formattedMessage.innerText = content.text;
        messageBubble.appendChild(formattedMessage);
    } else {
        return;
    }

    messageWrapper.appendChild(messageBubble);
    chatContainer.appendChild(messageWrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};


const showLoading = (isLoading: boolean) => {
    loadingIndicator.classList.toggle('hidden', !isLoading);
    chatStatus.textContent = isLoading ? '輸入中...' : '在線';
    chatStatus.classList.toggle('text-yellow-300', isLoading);
    chatStatus.classList.toggle('text-green-300', !isLoading);
    sendButton.disabled = isLoading;
    messageInput.disabled = isLoading;
    if (!isLoading) messageInput.focus();
};

const showError = (message: string | null) => {
    errorMessage.textContent = message || '';
    errorMessage.classList.toggle('hidden', !message);
};

const showAvatarPromptEditor = (key: string) => {
    currentPersonaKeyForPromptEdit = key;
    const persona = memoryManager.getPersona(key);
    if (!persona) return;

    avatarPromptEditor.value = persona.avatarPrompt;
    editAvatarPromptModal.classList.remove('hidden');
};

const hideAvatarPromptEditor = () => {
    editAvatarPromptModal.classList.add('hidden');
    currentPersonaKeyForPromptEdit = null;
};

const saveAvatarPrompt = () => {
    if (!currentPersonaKeyForPromptEdit) return;

    const newPrompt = avatarPromptEditor.value.trim();
    if (newPrompt) {
        memoryManager.updatePersona(currentPersonaKeyForPromptEdit, { avatarPrompt: newPrompt });
        hideAvatarPromptEditor();
    } else {
        alert('提示詞不能為空');
    }
};

// --- AI Date Proposal Functions ---
function showDateProposal(proposal: { response_text: string, location: string, duration: number }) {
    if (!currentPersona) return;

    dateProposalAvatar.innerHTML = '';
     if (currentPersona.avatarUrl) {
        const img = document.createElement('img');
        img.src = currentPersona.avatarUrl;
        img.alt = 'avatar';
        img.className = 'w-full h-full rounded-full object-cover';
        dateProposalAvatar.appendChild(img);
    } else {
        dateProposalAvatar.classList.add('flex', 'items-center', 'justify-center', 'text-4xl');
        dateProposalAvatar.textContent = currentPersona.emoji;
    }

    dateProposalName.textContent = `${currentPersona.name} 向你發出約會邀請！`;
    dateProposalText.textContent = `「${proposal.response_text}」`;
    dateProposalLocation.textContent = proposal.location;
    dateProposalDuration.textContent = `${proposal.duration}`;

    currentProposal = { location: proposal.location, duration: proposal.duration };

    dateProposalModal.classList.remove('hidden');
}

function hideDateProposal() {
    dateProposalModal.classList.add('hidden');
    currentProposal = null;
}


// --- Event Listeners ---
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});
backButton.addEventListener('click', showSelectionView);
avatarUploadInput.addEventListener('change', handleAvatarUpload);

// File Manager Event Listeners
downloadChatBtn.addEventListener('click', () => {
    if (currentPersonaKey && currentPersona) {
        fileManager.saveCurrentChat(currentPersonaKey, currentPersona.name);
    } else {
        alert("沒有對話可以儲存！");
    }
});
downloadAllChatsBtn.addEventListener('click', () => fileManager.saveAllChats());
downloadImagesBtn.addEventListener('click', () => {
     if (currentPersonaKey && currentPersona) {
        fileManager.downloadImages(currentPersonaKey, currentPersona.name);
    } else {
        alert("對話中沒有圖片可以下載！");
    }
});
uploadZipBtn.addEventListener('click', () => zipUploadInput.click());
zipUploadInput.addEventListener('change', (e) => fileManager.handleZipUpload(e));


giftButton.addEventListener('click', () => giftUploadInput.click());
giftUploadInput.addEventListener('change', handleGiftSelection);
removeGiftBtn.addEventListener('click', removeGift);
createPersonaBtn.addEventListener('click', showPersonaCreator);
clearChatBtn.addEventListener('click', clearChat);


// Persona Creator Event Listeners
closeCreatorModal.addEventListener('click', hidePersonaCreator);
randomizePersonaBtn.addEventListener('click', randomizePersonaInputs);
cancelCreatorBtn.addEventListener('click', hidePersonaCreator);
generatePersonaBtn.addEventListener('click', generatePersonaFromAI);
backToStep1Btn.addEventListener('click', () => {
    creatorStep2.classList.add('hidden');
    creatorStep1.classList.remove('hidden');
});
savePersonaBtn.addEventListener('click', saveCustomPersona);
personaCreatorModal.addEventListener('click', (e) => {
    if (e.target === personaCreatorModal) {
        hidePersonaCreator();
    }
});
fictionalPersonaCheckbox.addEventListener('change', () => {
    clubSelectionContainer.classList.toggle('hidden', fictionalPersonaCheckbox.checked);
});
personaClubSelect.addEventListener('change', () => {
    if (personaClubSelect.value === 'other') {
        customClubContainer.classList.remove('hidden');
    } else {
        customClubContainer.classList.add('hidden');
    }
});


// Edit Avatar Prompt Modal Listeners
closePromptModal.addEventListener('click', hideAvatarPromptEditor);
cancelPromptEdit.addEventListener('click', hideAvatarPromptEditor);
savePromptEdit.addEventListener('click', saveAvatarPrompt);
editAvatarPromptModal.addEventListener('click', (e) => {
    if (e.target === editAvatarPromptModal) {
        hideAvatarPromptEditor();
    }
});

// Date Proposal Modal Listeners
declineDateBtn.addEventListener('click', async () => {
    if (currentProposal && currentPersonaKey && currentPersona) {
        const proposalToDecline = { ...currentProposal };
        const key = currentPersonaKey;
        const persona = currentPersona;
        hideDateProposal();

        const userDeclineText = "下次再說";
        const userContent = { text: userDeclineText };
        appendMessage(userContent, 'user');
        memoryManager.addMessage(key, 'user', userContent);
        
        showLoading(true);

        try {
            const disappointedPrompt = `使用者剛剛拒絕了你去「${proposalToDecline.location}」約會的提議，並說「下次再說」。請用符合你個性的方式，回覆一句簡短、有點失落但表示理解的回應。`;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: disappointedPrompt,
                config: { systemInstruction: persona.prompt }
            });
            
            const disappointedText = cleanAiResponse(response.text, persona.name);
            if (disappointedText) {
                const botContent = { text: disappointedText };
                appendMessage(botContent, 'bot');
                memoryManager.addMessage(key, 'model', botContent);
            }
        } catch (error) {
             console.error('約會拒絕流程錯誤:', error);
             const errorContent = { text: getSystemErrorResponse(persona) };
             appendMessage(errorContent, 'bot');
             memoryManager.addMessage(key, 'model', errorContent);
        } finally {
            showLoading(false);
        }
    } else {
        hideDateProposal();
    }
});

acceptDateBtn.addEventListener('click', async () => {
    if (currentProposal && datingModule && currentPersonaKey && currentPersona) {
        const proposalToAccept = { ...currentProposal };
        const key = currentPersonaKey;
        const persona = currentPersona;
        hideDateProposal();

        const userAcceptanceText = "好啊，走吧！";
        const userContent = { text: userAcceptanceText };
        appendMessage(userContent, 'user');
        memoryManager.addMessage(key, 'user', userContent);
        
        showLoading(true);
        loadingText.textContent = '太棒了！準備出發...';

        try {
            const enthusiasticPrompt = `使用者剛剛答應了你去「${proposalToAccept.location}」約會的提議。請說一句簡短、開心、充滿期待的回應。`;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: enthusiasticPrompt,
                config: { systemInstruction: persona.prompt }
            });
            
            const enthusiasticText = cleanAiResponse(response.text, persona.name);
            if (enthusiasticText) {
                const botContent = { text: enthusiasticText };
                appendMessage(botContent, 'bot');
                memoryManager.addMessage(key, 'model', botContent);
            }
            
            loadingText.textContent = '規劃約會中...';
            await datingModule.generateDateMemoriesFromProposal(proposalToAccept.location, proposalToAccept.duration);

        } catch (error) {
             console.error('約會接受流程錯誤:', error);
             const errorContent = { text: getSystemErrorResponse(persona) };
             appendMessage(errorContent, 'bot');
             memoryManager.addMessage(key, 'model', errorContent);
        } finally {
            showLoading(false);
        }
    }
});


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    renderPersonaList();
    
    initStoryModule(
        ai,
        memoryManager,
        () => currentPersona,
        () => currentPersonaKey
    );

    datingModule = initDatingModule(
        ai, 
        memoryManager, 
        () => currentPersona, 
        () => currentPersonaKey,
        (content, sender) => appendMessage(content, sender)
    );
    dateBtn.addEventListener('click', () => {
        if (currentPersona && currentPersonaKey) {
            datingModule.show();
        }
    });
});