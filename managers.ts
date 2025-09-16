// managers.ts
import { personas as initialPersonas } from "./personas.js";
import { GoogleGenAI, Type } from "@google/genai";

// --- Constants ---


/**
 * Cleans raw text output from the AI by removing thought processes and other immersion-breaking artifacts.
 * @param rawText The raw string from the AI.
 * @param personaName Optional persona name to remove conversational prefixes.
 * @returns A cleaned string ready for display.
 */
export function cleanAiResponse(rawText: string | null | undefined, personaName?: string): string {
    if (!rawText) {
        return '';
    }
    
    let processedText = rawText;

    // First, remove stage directions in parentheses, which often contain meta-commentary like "recalling the date".
    // This handles both full-width and half-width parentheses.
    processedText = processedText.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');

    // Filter out entire lines that consist of thought processes or meta-commentary.
    let cleanedText = processedText
        .split('\n')
        .filter(line => {
            const trimmedLine = line.trim();
            const lowerLine = trimmedLine.toLowerCase();

            // Filter for "思緒:" (thought process)
            if (lowerLine.startsWith('思緒：') || lowerLine.startsWith('thought:')) {
                return false;
            }
            
            // Filter specific meta-commentary patterns based on user feedback.
            // Catches: "我會將這些細節融入回應中..."
            if (trimmedLine.startsWith('我會將') && trimmedLine.includes('融入回應')) {
                return false;
            }

            // Catches: "...以符合燄喜的設定。"
            if (trimmedLine.includes('以符合') && trimmedLine.includes('的設定')) {
                return false;
            }
            
            // Catches: "這是一個純文字回應，不是拍照，所以不需JSON。"
            if (trimmedLine.includes('純文字回應') || (trimmedLine.includes('不是拍照') && trimmedLine.includes('不需JSON'))) {
                return false;
            }
            
            // Catches things like "表達我的主動、誘惑和對親密的渴望"
            if (trimmedLine.startsWith('表達我的')) {
                return false;
            }
            
            // If after removing parentheses, the line is empty, filter it out.
            if (trimmedLine === '') {
                return false;
            }

            return true;
        })
        .join('\n')
        .trim();
    
    // Remove novel-style persona name prefixes, if a name is provided
    if (personaName) {
        const namePrefixRegex = new RegExp(`^\\s*${personaName}\\s*[:：]\\s*`);
        cleanedText = cleanedText.replace(namePrefixRegex, '').trim();
    }

    // Replace phrases that break immersion
    const memoryErrorPatterns = [
        /you generated a photo/gi, /the photo you generated/gi,
        /I generated for you/gi, /photo I generated/gi,
        /the generated photo/gi,
    ];
    for (const pattern of memoryErrorPatterns) {
        cleanedText = cleanedText.replace(pattern, "那張照片");
    }

    return cleanedText;
}


// --- Type Definitions ---
export interface Content {
    text?: string;
    imageUrl?: string;
}

export interface ChatMessage {
    role: 'user' | 'model' | 'system';
    content: Content;
}

export interface Persona {
    name: string;
    emoji: string;
    gender: "male" | "female";
    description: string;
    prompt: string;
    greeting: string;
    avatarPrompt: string;
    avatarUrl: string | null;
}

export interface AllData {
    chatHistories?: { [key: string]: ChatMessage[] };
    customPersonas?: { [key: string]: Persona };
}

interface UIActions {
    appendMessage: (content: Content, sender: 'user' | 'bot') => void;
    executePhotoGeneration: (photoPrompt: string) => Promise<void>;
    getPolicyViolationResponse: (persona: Persona) => string;
    showDateProposal: (proposal: { response_text: string, location: string, duration: number }) => void;
}

// --- Memory Manager ---
/**
 * Manages all application state including personas and chat histories.
 * Handles persistence to localStorage.
 */
export class MemoryManager {
    private ai: GoogleGenAI;
    private personas: { [key: string]: Persona };
    private chatHistories: { [key: string]: ChatMessage[] } = {};
    private customPersonaCounter: number = 0;

    constructor(ai: GoogleGenAI) {
        this.ai = ai;
        this.personas = { ...initialPersonas };
        this.loadCustomPersonas();
    }
    
    // --- Persistence Methods ---

    private loadCustomPersonas() {
        try {
            const saved = localStorage.getItem('customPersonas');
            if (saved) {
                const customPersonas = JSON.parse(saved);
                Object.assign(this.personas, customPersonas);

                const customKeys = Object.keys(customPersonas).filter(key => key.startsWith('custom_'));
                if (customKeys.length > 0) {
                    const maxCounter = Math.max(...customKeys.map(key => {
                        const match = key.match(/custom_(\d+)_/);
                        return match ? parseInt(match[1]) : 0;
                    }));
                    this.customPersonaCounter = maxCounter;
                }
            }
        } catch (error) {
            console.error('Failed to load custom personas:', error);
        }
    }

    private persistCustomPersonas() {
        try {
            localStorage.setItem('customPersonas', JSON.stringify(this.getCustomPersonas()));
        } catch (error) {
            console.error('Failed to save custom personas:', error);
        }
    }
    
    loadAllData(data: AllData) {
        if (data.customPersonas) {
            Object.assign(this.personas, data.customPersonas);
            this.persistCustomPersonas();
        }
        if (data.chatHistories) {
            Object.assign(this.chatHistories, data.chatHistories);
        }
    }

    // --- Persona Methods ---

    getCustomPersonas(): { [key: string]: Persona } {
        const customs: { [key: string]: Persona } = {};
        for (const [key, persona] of Object.entries(this.personas)) {
            if (key.startsWith('custom_')) {
                customs[key] = persona;
            }
        }
        return customs;
    }

    getAllPersonas(): { [key: string]: Persona } {
        return this.personas;
    }

    getPersona(key: string): Persona | undefined {
        return this.personas[key];
    }

    saveCustomPersona(personaData: any): string {
        this.customPersonaCounter++;
        const personaKey = `custom_${this.customPersonaCounter}_${Date.now()}`;

        this.personas[personaKey] = {
            name: personaData.name,
            emoji: personaData.emoji,
            description: personaData.description,
            prompt: personaData.prompt,
            greeting: personaData.greeting,
            avatarPrompt: personaData.avatarPrompt,
            gender: personaData.gender,
            avatarUrl: null
        };
        this.persistCustomPersonas();
        return personaKey;
    }

    updatePersona(key: string, data: Partial<Persona>) {
        if (this.personas[key]) {
            Object.assign(this.personas[key], data);
            if (key.startsWith('custom_')) {
                this.persistCustomPersonas();
            }
        }
    }
    
    updatePersonaWithCustomData(key: string, personaData: any) {
        if (key.startsWith('custom_')) {
            this.personas[key] = personaData;
            this.persistCustomPersonas();
        }
    }

    deleteCustomPersona(key: string): boolean {
        if (key.startsWith('custom_') && this.personas[key]) {
            delete this.personas[key];
            this.persistCustomPersonas();
            return true;
        }
        return false;
    }

    // --- Chat History Methods ---

    getChatHistory(key: string): ChatMessage[] {
        if (!this.chatHistories[key] || this.chatHistories[key].length === 0) {
            const persona = this.getPersona(key);
            this.chatHistories[key] = persona
                ? [{ role: 'model', content: { text: persona.greeting } }]
                : [];
        }
        return this.chatHistories[key];
    }
    
    setChatHistory(key: string, history: ChatMessage[]) {
        this.chatHistories[key] = history;
    }

    getAllChatHistories(): { [key: string]: ChatMessage[] } {
        return this.chatHistories;
    }

    addMessage(key: string, role: 'user' | 'model' | 'system', content: Content) {
        if (!this.chatHistories[key]) {
            this.getChatHistory(key); // Initialize if it doesn't exist
        }
        this.chatHistories[key].push({ role, content });
    }

    clearChatHistory(key: string) {
        const persona = this.getPersona(key);
        if (persona) {
            // Retain system messages (date memories) when clearing chat
            const systemMessages = this.chatHistories[key]?.filter(msg => msg.role === 'system') || [];
            this.chatHistories[key] = [
                ...systemMessages,
                { role: 'model', content: { text: persona.greeting } }
            ];
        }
    }

    // --- Key Memory Methods (Re-implemented to read from chat history) ---

    /**
     * Extracts memories from hidden system messages in the chat history.
     * Used for story generation and dating context.
     * @param key The persona key.
     * @returns An array of memory strings.
     */
    getKeyMemories(key: string): string[] {
        if (!this.chatHistories[key]) {
            return [];
        }
        return this.chatHistories[key]
            .filter(msg => msg.role === 'system' && msg.content.text?.startsWith('[約會回憶]'))
            .map(msg => msg.content.text!.replace('[約會回憶] ', ''));
    }

    // --- Dating Cooldown Methods ---

    recordDateCompletion(key: string) {
        // This function is kept for compatibility with the dating module,
        // but the cooldown logic has been removed per user request.
    }

    canProposeDate(key: string): boolean {
        // Cooldown removed per user request. AI can always propose a date.
        return true;
    }
}


// --- Output Manager ---
/**
 * Processes raw output from the AI model, parses it for actions,
 * and triggers the appropriate UI actions.
 */
export class OutputManager {
    private uiActions: UIActions;
    private ai: GoogleGenAI;

    constructor(uiActions: UIActions, ai: GoogleGenAI) {
        this.uiActions = uiActions;
        this.ai = ai;
    }

    async process(rawText: string | null, persona: Persona, historyKey: string, memoryManager: MemoryManager) {
        if (!rawText) {
            const policyViolationContent = { text: this.uiActions.getPolicyViolationResponse(persona) };
            this.uiActions.appendMessage(policyViolationContent, 'bot');
            memoryManager.addMessage(historyKey, 'model', policyViolationContent);
            return;
        }

        let isActionHandled = false;
        const jsonStartIndex = rawText.indexOf('{');
        const jsonEndIndex = rawText.lastIndexOf('}');

        if (jsonStartIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            const potentialJsonStr = rawText.substring(jsonStartIndex, jsonEndIndex + 1);
            try {
                const parsedJson = JSON.parse(potentialJsonStr);
                const actionText = parsedJson.response_text || rawText.substring(0, jsonStartIndex).trim();
                
                if (actionText) {
                    const textContent = { text: actionText };
                    this.uiActions.appendMessage(textContent, 'bot');
                    memoryManager.addMessage(historyKey, 'model', textContent);
                }

                if (parsedJson.action === 'generate_photo' && parsedJson.photo_prompt) {
                    await this.uiActions.executePhotoGeneration(parsedJson.photo_prompt);
                    isActionHandled = true;
                } else if (parsedJson.action === 'propose_date' && parsedJson.location && parsedJson.duration) {
                    this.uiActions.showDateProposal(parsedJson);
                    isActionHandled = true;
                } else {
                    // It had JSON but wasn't a valid action, so we clear the partial message
                    // and fall through to process the whole thing as text.
                    // This can happen if the AI generates JSON for other reasons.
                     memoryManager.getChatHistory(historyKey).pop(); // remove the prematurely added message
                     const chatContainer = document.getElementById('chat-container')!;
                     if(chatContainer.lastChild) chatContainer.removeChild(chatContainer.lastChild);
                }

            } catch (error) {
                // Not a valid JSON or not the action we are looking for, fall through to treat as plain text.
            }
        }

        if (!isActionHandled) {
            const cleanedText = cleanAiResponse(rawText, persona.name);
            const botContent = { text: cleanedText || this.uiActions.getPolicyViolationResponse(persona) };
            
            this.uiActions.appendMessage(botContent, 'bot');
            memoryManager.addMessage(historyKey, 'model', botContent);
        }
    }
}