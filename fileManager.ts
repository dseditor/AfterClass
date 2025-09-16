// fileManager.ts
import { MemoryManager, ChatMessage } from './managers.js';

declare var JSZip: any;

interface FileManagerCallbacks {
    onSingleChatRestored: (key: string, history: ChatMessage[]) => void;
    onAllDataRestored: () => void;
}

interface UIElements {
    downloadAllChatsBtn: HTMLButtonElement;
    downloadImagesBtn: HTMLButtonElement;
}

/**
 * Manages all file-related operations like saving, loading, and downloading.
 */
export class FileManager {
    private memoryManager: MemoryManager;
    private callbacks: FileManagerCallbacks;
    private ui: UIElements;

    constructor(memoryManager: MemoryManager, uiAndCallbacks: UIElements & FileManagerCallbacks) {
        this.memoryManager = memoryManager;
        this.ui = {
            downloadAllChatsBtn: uiAndCallbacks.downloadAllChatsBtn,
            downloadImagesBtn: uiAndCallbacks.downloadImagesBtn
        };
        this.callbacks = {
            onSingleChatRestored: uiAndCallbacks.onSingleChatRestored,
            onAllDataRestored: uiAndCallbacks.onAllDataRestored,
        };
    }

    async saveCurrentChat(personaKey: string, personaName: string) {
        const chatHistory = this.memoryManager.getChatHistory(personaKey);
        const persona = this.memoryManager.getPersona(personaKey);
        if (!persona || chatHistory.length === 0) {
            alert("沒有對話可以儲存！");
            return;
        }

        const zip = new JSZip();
        const saveData: { [key: string]: any } = {
            personaKey: personaKey,
            history: chatHistory
        };

        if (personaKey.startsWith('custom_')) {
            saveData.personaData = persona;
        }

        zip.file("history.json", JSON.stringify(saveData, null, 2));

        const avatarUrl = persona.avatarUrl;
        if (avatarUrl && avatarUrl.startsWith('data:image')) {
            const response = await fetch(avatarUrl);
            const blob = await response.blob();
            zip.file("avatar.png", blob);
        }

        zip.generateAsync({ type: "blob" }).then((content: Blob) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            const timestamp = new Date().getTime();
            link.download = `${personaName}_${timestamp}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    async saveAllChats() {
        const allChatHistories = this.memoryManager.getAllChatHistories();
        const customPersonas = this.memoryManager.getCustomPersonas();

        if (Object.keys(allChatHistories).length === 0 && Object.keys(customPersonas).length === 0) {
            alert("沒有任何對話或自訂角色可以儲存！");
            return;
        }

        const originalText = this.ui.downloadAllChatsBtn.textContent;
        this.ui.downloadAllChatsBtn.disabled = true;
        this.ui.downloadAllChatsBtn.textContent = '打包中...';

        try {
            const zip = new JSZip();

            const saveData = {
                chatHistories: allChatHistories,
                customPersonas: customPersonas,
            };

            zip.file("all_data.json", JSON.stringify(saveData, null, 2));

            const avatarFolder = zip.folder("avatars");
            if (avatarFolder) {
                const avatarPromises = [];
                const allPersonas = this.memoryManager.getAllPersonas();
                for (const key in allPersonas) {
                    const persona = allPersonas[key];
                    if (persona.avatarUrl && persona.avatarUrl.startsWith('data:image')) {
                        const promise = fetch(persona.avatarUrl)
                            .then(res => res.blob())
                            .then(blob => {
                                const extension = blob.type.split('/')[1] || 'png';
                                avatarFolder.file(`${key}.${extension}`, blob);
                            });
                        avatarPromises.push(promise);
                    }
                }
                await Promise.all(avatarPromises);
            }

            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            const timestamp = new Date().getTime();
            link.download = `all_chats_${timestamp}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("儲存所有對話錯誤:", error);
            alert(`儲存失敗: ${error}`);
        } finally {
            this.ui.downloadAllChatsBtn.disabled = false;
            this.ui.downloadAllChatsBtn.textContent = originalText;
        }
    }

    async downloadImages(personaKey: string, personaName: string) {
        const chatHistory = this.memoryManager.getChatHistory(personaKey);
        const imageMessages = chatHistory.filter(msg => msg.content.imageUrl);

        if (imageMessages.length === 0) {
            alert("對話中沒有圖片可以下載！");
            return;
        }

        const originalText = this.ui.downloadImagesBtn.textContent;
        this.ui.downloadImagesBtn.disabled = true;
        this.ui.downloadImagesBtn.textContent = '打包中...';

        try {
            const zip = new JSZip();

            await Promise.all(imageMessages.map(async (msg, index) => {
                const imageUrl = msg.content.imageUrl!;
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const extension = blob.type.split('/')[1] || 'png';
                zip.file(`image_${index + 1}.${extension}`, blob);
            }));

            zip.generateAsync({ type: "blob" }).then((content: Blob) => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                const timestamp = new Date().getTime();
                link.download = `${personaName}_images_${timestamp}.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        } catch (error) {
            console.error("圖片下載錯誤:", error);
            alert(`圖片打包失敗: ${error}`);
        } finally {
            this.ui.downloadImagesBtn.disabled = false;
            this.ui.downloadImagesBtn.textContent = originalText;
        }
    }

    async handleZipUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const zip = await JSZip.loadAsync(file);
            
            // Prefer the new "all data" format
            const allDataFile = zip.file("all_data.json");
            if (allDataFile) {
                const allDataString = await allDataFile.async("string");
                const allData = JSON.parse(allDataString);
                
                this.memoryManager.loadAllData(allData);

                const avatarFolder = zip.folder("avatars");
                if (avatarFolder) {
                    const avatarPromises: Promise<void>[] = [];
                    avatarFolder.forEach((relativePath, fileEntry) => {
                        const key = relativePath.split('.')[0];
                        if (this.memoryManager.getPersona(key) && !fileEntry.dir) {
                            const promise = fileEntry.async("base64").then(base64 => {
                                const mimeType = fileEntry.name.endsWith('png') ? 'image/png' : 'image/jpeg';
                                this.memoryManager.updatePersona(key, { avatarUrl: `data:${mimeType};base64,${base64}` });
                            });
                            avatarPromises.push(promise);
                        }
                    });
                    await Promise.all(avatarPromises);
                }
                
                this.callbacks.onAllDataRestored();
                return;
            }

            // Fallback to old single chat format
            const historyFile = zip.file("history.json");
            if (historyFile) {
                const historyString = await historyFile.async("string");
                if (!historyString.trim()) throw new Error("history.json 檔案是空的");

                const historyData = JSON.parse(historyString);
                const { personaKey, history, personaData } = historyData;
                
                // Load all data from the single file backup, ignoring legacy keyMemories
                const dataToLoad = {
                    customPersonas: personaData ? { [personaKey]: personaData } : {},
                    chatHistories: { [personaKey]: history },
                };
                this.memoryManager.loadAllData(dataToLoad);

                if (!personaKey || !this.memoryManager.getPersona(personaKey)) throw new Error("無效的角色鍵值或角色資料遺失");
                if (!Array.isArray(history)) throw new Error("對話歷史格式錯誤");

                const avatarFile = zip.file("avatar.png");
                if (avatarFile) {
                    const base64 = await avatarFile.async("base64");
                    this.memoryManager.updatePersona(personaKey, { avatarUrl: `data:image/png;base64,${base64}` });
                }

                this.callbacks.onSingleChatRestored(personaKey, history);
                return;
            }

            throw new Error("ZIP 檔案中找不到有效的對話紀錄檔 (all_data.json 或 history.json)");

        } catch (error) {
            alert(`讀取檔案失敗: ${error}`);
            console.error("ZIP 上傳錯誤:", error);
        } finally {
            (event.target as HTMLInputElement).value = '';
        }
    }
}