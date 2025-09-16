// dating.tsx
import { GoogleGenAI, Type } from "@google/genai";
import { MemoryManager, Persona, cleanAiResponse } from "./managers.js";

const datingModal = document.getElementById('dating-modal')!;
const closeDatingModalBtn = document.getElementById('close-dating-modal')!;
const locationOptionsContainer = document.getElementById('location-options')!;
const customLocationInput = document.getElementById('custom-location-input') as HTMLInputElement;
const randomLocationBtn = document.getElementById('random-location-btn')!;
const dateDurationInput = document.getElementById('date-duration') as HTMLInputElement;
const cancelDatingBtn = document.getElementById('cancel-dating')!;
const startDateBtn = document.getElementById('start-date-btn') as HTMLButtonElement;
const startDateText = document.getElementById('start-date-text')!;
const startDateLoading = document.getElementById('start-date-loading')!;

let ai: GoogleGenAI;
let memoryManager: MemoryManager;
let getCurrentPersona: () => Persona | null;
let getCurrentPersonaKey: () => string | null;
let appendMessage: (content: any, sender: 'user' | 'bot') => void;
let selectedLocation: string | null = null;

const locations = [
    { name: '電影院', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 4.5a.5.5 0 01.5-.5h14a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-14a.5.5 0 01-.5-.5v-2zM3 7.5h14v8a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-8z" /><path d="M4.5 10a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-2zM4.5 13a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-2zM8 10.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-1zM8 13.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-1zM12 10a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-2zM12 13a.5.5 0 00-.5.5v1a.5.5 0 00.5.5h2a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-2z" /></svg>' },
    { name: '咖啡廳', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a.75.75 0 01.75.75v2.522a2.25 2.25 0 01-3.5 1.948L6.42 7.55A.75.75 0 017.5 7h5a.75.75 0 010 1.5h-3.17l1.03 1.03a.75.75 0 11-1.06 1.06L8.25 9.53v2.72a.75.75 0 01-1.5 0V4.5A1.5 1.5 0 018.25 3h1.75z" /><path d="M3 5.5A2.5 2.5 0 015.5 3H10a.75.75 0 010 1.5H5.5A1 1 0 004.5 6v8A1 1 0 005.5 15H15a.5.5 0 01.5.5v1a.5.5 0 01-.5.5H5.5A2.5 2.5 0 013 14.5v-9z" /></svg>' },
    { name: '公園散步', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M14.78 6.47a.75.75 0 00-1.06 0L10 10.19l-3.72-3.72a.75.75 0 00-1.06 1.06L8.94 11.25l-3.72 3.72a.75.75 0 101.06 1.06L10 12.31l3.72 3.72a.75.75 0 101.06-1.06L11.06 11.25l3.72-3.72a.75.75 0 000-1.06z" /><path d="M16.5 5A4.5 4.5 0 117.5 5a4.5 4.5 0 019 0zM15 5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>' },
    { name: '水族館', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M11.95 1.625a4.25 4.25 0 015.426 5.82l-1.453 1.817a.25.25 0 00.198.406h2.203a.75.75 0 010 1.5H16.27l-1.328 1.66a.25.25 0 00.198.407h3.11a.75.75 0 010 1.5h-3.21a.25.25 0 00-.198.406l1.328 1.661h.302a.75.75 0 010 1.5h-4.25a.75.75 0 01-.735-.901L12.5 14.25v-2.5a.75.75 0 00-1.5 0v2.5l1.215 2.127a.75.75 0 01-.735.901h-4.25a.75.75 0 010-1.5h3.332l1.328-1.66a.25.25 0 00-.198-.407H8.75a.75.75 0 010-1.5h1.22l1.452-1.817a.25.25 0 00-.198-.406H8.75a.75.75 0 010-1.5h2.553a.25.25 0 00.198-.406L10.05 3.375a4.25 4.25 0 011.9-1.75z" /></svg>' },
    { name: '逛街購物', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22a.75.75 0 000-1.06l-3.182-3.182a.75.75 0 00-1.06 0l-7.22 7.22a.75.75 0 000 1.06l3.182 3.182zM6.66 4.66a.75.75 0 011.06 0l3.182 3.182a.75.75 0 010 1.06l-3.182 3.182a.75.75 0 11-1.06-1.06l2.652-2.652a.25.25 0 000-.354L6.66 5.72a.75.75 0 010-1.06z" clip-rule="evenodd" /><path d="M12.25 10.25a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" /><path d="M4.25 10.25a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" /></svg>' },
    { name: '看夜景', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 3zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM4.636 4.636a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061L4.636 5.697a.75.75 0 010-1.06zm9.192 9.192a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM15.364 4.636a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zm-9.192 9.192a.75.75 0 010 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061a.75.75 0 011.061 0zM2.5 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zm13.25.75a.75.75 0 000-1.5h-1.5a.75.75 0 000 1.5h1.5zM10 7a3 3 0 100 6 3 3 0 000-6z" clip-rule="evenodd" /></svg>' },
    { name: '圖書館', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.5A2.5 2.5 0 014.5 2h11A2.5 2.5 0 0118 4.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 15.5v-11zM4.5 4a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h11a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-11z" /><path d="M10.5 13.5a.75.75 0 01-.75.75H5.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 01.75-.75h4.25a.75.75 0 01.75.75v2.5z" /></svg>' },
    { name: '在家放鬆', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 2.75a.75.75 0 00-1.5 0v14.5a.75.75 0 001.5 0v-4.392l1.657-.348a6.44 6.44 0 016.37.243l.53.265a8 8 0 006.11-1.285l.178-.089a.75.75 0 00-.5-1.4l-.178.09a6.5 6.5 0 01-5.02 1.045l-.53-.265a7.94 7.94 0 00-7.86-.302L3.5 12.142V2.75z" /></svg>' },
    { name: '海邊', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.84 6.136a.75.75 0 011.06 0l2.25 2.25a.75.75 0 01-1.06 1.06L7.16 7.525a.75.75 0 010-1.06l-.32-.329zM12.47 7.525a.75.75 0 011.06 0l.33.33a.75.75 0 010 1.06l-1.94 1.94a.75.75 0 11-1.06-1.06l1.61-1.61z" clip-rule="evenodd" /><path d="M13.53 11.47a.75.75 0 010 1.06l-.97.97a.75.75 0 01-1.06 0l-.97-.97a.75.75 0 111.06-1.06l.44.44.44-.44a.75.75 0 011.06 0z" /></svg>' },
    { name: '遊樂園', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.958-3.958l1.745 1.745a.75.75 0 101.06-1.06l-14.5-14.5zM8.25 7.5a.75.75 0 01.75.75v3.19l-3.19-3.19H8.25zM10 2a.75.75 0 01.75.75v3.19l-3.19-3.19H10zM12.5 7.5a.75.75 0 01.75.75v3.19l-3.19-3.19H12.5z" /></svg>' },
];

function renderLocations() {
    locationOptionsContainer.innerHTML = '';
    locations.forEach(location => {
        const option = document.createElement('div');
        option.className = 'location-option';
        option.dataset.location = location.name;
        option.innerHTML = `${location.icon}<span>${location.name}</span>`;
        option.addEventListener('click', () => {
            selectLocation(location.name);
        });
        locationOptionsContainer.appendChild(option);
    });
}

function selectLocation(locationName: string | null) {
    selectedLocation = locationName;
    document.querySelectorAll('.location-option').forEach(opt => {
        const optEl = opt as HTMLElement;
        optEl.classList.toggle('selected', optEl.dataset.location === locationName);
    });
    if (locationName) {
        customLocationInput.value = ''; // Clear custom input if a preset is chosen
    }
}

function randomizeLocation() {
    const randomIndex = Math.floor(Math.random() * locations.length);
    selectLocation(locations[randomIndex].name);
}

function show() {
    renderLocations();
    selectLocation(null);
    customLocationInput.value = '';
    dateDurationInput.value = '3';
    datingModal.classList.remove('hidden');
}

function hide() {
    datingModal.classList.add('hidden');
}

async function generateDateMemories(location: string, duration: number) {
    const persona = getCurrentPersona();
    const personaKey = getCurrentPersonaKey();

    if (!persona || !personaKey) {
        alert("錯誤：找不到目前的角色。");
        return;
    }

    startDateBtn.disabled = true;
    startDateText.classList.add('hidden');
    startDateLoading.classList.remove('hidden');

    try {
        let movieDetails = "";
        if (location === '電影院') {
            try {
                const moviePrompt = `Generate a fictional but realistic-sounding romantic comedy movie title for a date. Provide a very short, one-sentence plot summary. Output in JSON format: {"title": "...", "plot": "..."}.`;
                const movieSchema = {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        plot: { type: Type.STRING },
                    },
                    required: ["title", "plot"]
                };
                const movieResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: moviePrompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: movieSchema,
                    },
                });
                const movieJson = JSON.parse(movieResponse.text.trim());
                movieDetails = `我們正在看的電影是「${movieJson.title}」，劇情是關於「${movieJson.plot}」。`;
            } catch (e) {
                console.error("Movie title generation failed, using a generic description.", e);
                movieDetails = "我們正在看一部有趣的浪漫喜劇電影。";
            }
        }

        const existingMemories = memoryManager.getKeyMemories(personaKey).join('; ');
        const memoryPrompt = existingMemories 
            ? `我們之間已經有以下這些回憶：\n${existingMemories}\n請在生成新回憶時參考這些內容，讓故事更有連續性。`
            : "我們之間還沒有太多共同回憶，這次約會是創造美好回憶的好機會。";

        const prompt = `你是一個戀愛故事生成AI。請為使用者和你策劃一場約會。

**約會設定：**
*   **地點：** ${location}
*   **時長：** ${duration} 小時
*   **額外情境：** ${movieDetails || "無"}

**你的任務：**
根據你的角色個性和我們過去的回憶，生成 ${duration} 條簡短、甜蜜、用第三人稱描述的「關鍵回憶」。每一條回憶代表約會中的一小時所發生的事情。
${memoryPrompt}

**輸出要求：**
*   必須嚴格生成 ${duration} 條回憶。
*   每條回憶都應該是一個完整的句子，描述一個具體的互動、場景、或情感瞬間。
*   回憶的內容需要符合你的個性和約會場景，並包含你的名字「${persona.name}」。
*   除了甜蜜的時刻，請在其中一條回憶中加入一個溫馨的、意想不到的小插曲（例如：突然下起小雨，兩人共用一把傘；遇到一隻親人的小貓；或是一個無傷大雅的有趣出糗時刻），讓約會更加難忘。
*   直接輸出 JSON 格式，不要有任何其他文字或Markdown標記。

**JSON 格式範例:**
{
  "memories": [
    "在電影院裡，${persona.name}看到緊張的片段時，不自覺地抓住了你的手。",
    "電影結束後突然下起小雨，你們笑著跑進附近的咖啡廳，分享著剛才電影的心得。",
    "夕陽下，${persona.name}輕輕地靠在你的肩膀上，享受著片刻的寧靜。"
  ]
}`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                memories: {
                    type: Type.ARRAY,
                    description: `A list of exactly ${duration} memories from the date.`,
                    items: { type: Type.STRING }
                }
            },
            required: ["memories"]
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: persona.prompt,
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        if (!response.text) {
            throw new Error("AI未能生成約會回憶，可能是因為安全設定，請再試一次。");
        }
        
        const jsonStr = response.text.trim();
        const parsed = JSON.parse(jsonStr);

        if (parsed.memories && Array.isArray(parsed.memories)) {
            parsed.memories.forEach((memory: string) => {
                if (memory) {
                    // Add as a hidden system message
                    memoryManager.addMessage(personaKey, 'system', { text: `[約會回憶] ${memory}` });
                }
            });
            memoryManager.recordDateCompletion(personaKey);

            // Generate a concluding message instead of an alert
            const concludingPrompt = `你剛和使用者在「${location}」進行了一場 ${duration} 小時的約會，并創造了以下的美好回憶：\n- ${parsed.memories.join('\n- ')}\n\n請根據這些回憶，寫一句簡短、甜蜜的約會結束語，表達你有多開心。直接輸出這句話，不要包含任何前言。`;
            const concludingResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: concludingPrompt,
                config: {
                    systemInstruction: persona.prompt,
                }
            });
            
            const concludingMessage = cleanAiResponse(concludingResponse.text, persona.name);
            if (concludingMessage) {
                const botContent = { text: concludingMessage };
                appendMessage(botContent, 'bot');
                memoryManager.addMessage(personaKey, 'model', botContent);
            }
            
            hide();
        } else {
            throw new Error("AI回傳的格式不正確。");
        }

    } catch (error) {
        console.error("約會回憶生成失敗:", error);
        alert(`約會計畫失敗了... 請稍後再試一次。\n\n錯誤訊息: ${error}`);
    } finally {
        startDateBtn.disabled = false;
        startDateText.classList.remove('hidden');
        startDateLoading.classList.add('hidden');
    }
}

async function handleStartDateForm() {
    const location = customLocationInput.value.trim() || selectedLocation;
    const duration = parseInt(dateDurationInput.value, 10);

    if (!location) {
        alert("請選擇或輸入一個約會地點！");
        return;
    }
    if (isNaN(duration) || duration < 1 || duration > 6) {
        alert("請輸入有效的約會時長 (1-6 小時)。");
        return;
    }

    await generateDateMemories(location, duration);
}

export function initDatingModule(
    aiInstance: GoogleGenAI,
    memManager: MemoryManager,
    getPersona: () => Persona | null,
    getPersonaKey: () => string | null,
    appendMessageCallback: (content: any, sender: 'user' | 'bot') => void
) {
    ai = aiInstance;
    memoryManager = memManager;
    getCurrentPersona = getPersona;
    getCurrentPersonaKey = getPersonaKey;
    appendMessage = appendMessageCallback;

    closeDatingModalBtn.addEventListener('click', hide);
    cancelDatingBtn.addEventListener('click', hide);
    datingModal.addEventListener('click', (e) => {
        if (e.target === datingModal) {
            hide();
        }
    });
    randomLocationBtn.addEventListener('click', randomizeLocation);
    startDateBtn.addEventListener('click', handleStartDateForm);

    customLocationInput.addEventListener('input', () => {
        if (customLocationInput.value.trim() !== '') {
            selectLocation(null); // Deselect preset if user types a custom location
        }
    });
    
    return {
        show,
        hide,
        generateDateMemoriesFromProposal: generateDateMemories
    };
}