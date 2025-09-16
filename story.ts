// story.ts
import { GoogleGenAI } from "@google/genai";
import { MemoryManager, Persona } from "./managers.js";

// --- DOM Elements ---
const generateStoryBtn = document.getElementById('generate-story-btn')!;
const storyModal = document.getElementById('story-modal')!;
const closeStoryModal = document.getElementById('close-story-modal')!;
const storyLoading = document.getElementById('story-loading')!;
const storyText = document.getElementById('story-text')!;

// --- State ---
let ai: GoogleGenAI;
let memoryManager: MemoryManager;
let getCurrentPersona: () => Persona | null;
let getCurrentPersonaKey: () => string | null;

// Cache to store generated stories
const storyCache: { [key: string]: { story: string; historyLength: number } } = {};

const showStoryModal = () => storyModal.classList.remove('hidden');
const hideStoryModal = () => storyModal.classList.add('hidden');

/**
 * Invalidates the story cache for a specific persona.
 * Should be called when the chat history changes in a way that warrants a new story (e.g., clearing chat).
 * @param key The persona key.
 */
export function invalidateStoryCache(key: string) {
    if (storyCache[key]) {
        delete storyCache[key];
    }
}

async function generateStory() {
    const persona = getCurrentPersona();
    const personaKey = getCurrentPersonaKey();

    if (!persona || !personaKey) {
        alert("還沒有足夠的回憶可以生成故事喔！");
        return;
    }
    const memories = memoryManager.getKeyMemories(personaKey);
    const chatHistory = memoryManager.getChatHistory(personaKey);

    // Use cache if history hasn't changed
    if (storyCache[personaKey] && storyCache[personaKey].historyLength === chatHistory.length) {
        storyText.textContent = storyCache[personaKey].story;
        storyLoading.classList.add('hidden');
        showStoryModal();
        return;
    }

    if (chatHistory.length <= 1 && memories.length === 0) {
         alert("還沒有足夠的回憶可以生成故事喔！");
        return;
    }

    storyText.textContent = '';
    storyLoading.classList.remove('hidden');
    showStoryModal();

    try {
        const historyForStory = chatHistory.map(message => {
            const role = message.role === 'model' ? persona.name : '你';
            let textContent = '';
            if (message.content.text) {
                textContent = message.content.text;
            } else if (message.content.imageUrl) {
                textContent = `[${role}傳送了一張圖片]`;
            }
            return textContent ? `${role}: ${textContent}` : null;
        }).filter(Boolean).join('\n');

        const memoriesForStory = memories.join('; ');

        const prompt = `你是一位專業的戀愛小說家。請根據以下提供的「關鍵回憶」和「最近的對話紀錄」，為使用者和角色「${persona.name}」寫一篇約300-400字的校園戀愛風格短篇故事。

故事的核心應該圍繞「關鍵回憶」中描述的事件和情感。請將這些回憶點滴串連成一個有情節、有情感發展的完整故事。
「最近的對話紀錄」可以作為補充，用來豐富角色的語氣和互動細節，但不應是故事的主體。

---
[關鍵回憶]:
${memoriesForStory || "還沒有特別的共同回憶。"}
---
[最近的對話紀錄]:
${historyForStory}
---

請用第三人稱視角，將回憶和對話轉化為生動的故事場景和內心獨白，捕捉情感的發展和甜蜜的瞬間。
故事的主角是使用者(可以用「他」或「她」)和「${persona.name}」。
直接輸出故事內文，不要包含任何前言或標題。`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        storyText.textContent = response.text;

        // Save to cache
        storyCache[personaKey] = {
            story: response.text,
            historyLength: chatHistory.length
        };

    } catch (error) {
        console.error("故事生成錯誤:", error);
        storyText.textContent = `故事生成失敗了... 請稍後再試一次。\n\n錯誤訊息: ${error}`;
    } finally {
        storyLoading.classList.add('hidden');
    }
}


export function initStoryModule(
    aiInstance: GoogleGenAI,
    memManager: MemoryManager,
    getPersona: () => Persona | null,
    getPersonaKey: () => string | null
) {
    ai = aiInstance;
    memoryManager = memManager;
    getCurrentPersona = getPersona;
    getCurrentPersonaKey = getPersonaKey;
    
    generateStoryBtn.addEventListener('click', generateStory);
    closeStoryModal.addEventListener('click', hideStoryModal);
    storyModal.addEventListener('click', (e) => {
        if (e.target === storyModal) {
            hideStoryModal();
        }
    });
}