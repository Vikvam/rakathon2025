import {
    readTextFile,
    writeTextFile,
    exists,
    BaseDirectory,
} from "@tauri-apps/plugin-fs";

// Helper to detect environment
const isTauri = () => {
    return window.__TAURI__ !== undefined;
};

// Read file abstraction that works in both Tauri and web
export async function readFsFile(path, options) {
    if (isTauri()) {
        try {
            const content = await readTextFile(path, options);
            return content;
        } catch (error) {
            console.error("Failed to read file in Tauri:", error);
            throw error;
        }
    } else {
        // Web implementation using localStorage
        try {
            const content = localStorage.getItem(path);
            return content || '';
        } catch (error) {
            console.error("Failed to read from localStorage:", error);
            throw error;
        }
    }
}

// Write file abstraction that works in both Tauri and web
export async function writeFsFile(path, content, options) {
    if (isTauri()) {
        try {
            await writeTextFile(path, content, options);
            return true;
        } catch (error) {
            console.error("Failed to write file in Tauri:", error);
            throw error;
        }
    } else {
        // Web implementation using localStorage
        try {
            localStorage.setItem(path, content);
            return true;
        } catch (error) {
            console.error("Failed to write to localStorage:", error);
            throw error;
        }
    }
}

// Check if file exists abstraction
export async function existsFsFile(path, options) {
    if (isTauri()) {
        try {
            return await exists(path, options);
        } catch (error) {
            console.error("Failed to check if file exists in Tauri:", error);
            throw error;
        }
    } else {
        // Web implementation
        return localStorage.getItem(path) !== null;
    }
}


