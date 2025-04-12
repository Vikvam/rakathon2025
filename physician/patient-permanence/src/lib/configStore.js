// src/lib/configStore.js (or wherever you keep your stores)

import {
    readTextFile,
    writeTextFile,
    exists, // Keep exists if you want to explicitly check, though try/catch on read is also effective
    BaseDirectory,
    // mkdir is only needed if you decide to use a subdirectory
} from "@tauri-apps/plugin-fs";

// Define the name for the configuration file
const CONFIG_FILENAME = "user_config.json";
// Optional: Define a subdirectory if you prefer organization
// const CONFIG_SUBDIR = "config";
// const CONFIG_FILE_PATH = `${CONFIG_SUBDIR}/${CONFIG_FILENAME}`; // Use this if using a subdir

// Define the default configuration structure.
// This is returned if the file doesn't exist or is corrupted.
const DEFAULT_CONFIG = {
    user: "Unknown user",
};

let isInitialized = false; // <-- Initialization flag

/**
 * Ensures the configuration storage is ready.
 * Checks if the config file path is accessible. Should be called once at app startup.
 * Safe to call multiple times due to the isInitialized flag.
 * @returns {Promise<boolean>} True if initialization was successful or already done, false on error.
 */
export async function initializeConfigStore() {
    if (isInitialized) {
        return true;
    }

    try {
        // If using a subdirectory, check and create it here:
        /*
        const dirExists = await exists(CONFIG_SUBDIR, { baseDir: BaseDirectory.AppLocalData });
        if (!dirExists) {
          console.log(`[configStore] Creating config directory: ${CONFIG_SUBDIR}`);
          await mkdir(CONFIG_SUBDIR, { baseDir: BaseDirectory.AppLocalData, recursive: true });
          console.log(`[configStore] Config directory created.`);
        }
        */

        // Check if the config file itself is accessible (optional but good for early permission check)
        // We use exists() primarily to test access permissions early.
        const fileExists = await exists(CONFIG_FILENAME, {
            baseDir: BaseDirectory.AppLocalData,
        });
        if (fileExists) {
            console.log(
                `[configStore] Config file ${CONFIG_FILENAME} exists and is accessible.`,
            );
        } else {
            console.log(
                `[configStore] Config file ${CONFIG_FILENAME} does not exist yet. Path is accessible.`,
            );
            saveConfig(DEFAULT_CONFIG)
        }

        isInitialized = true;
        console.log("[configStore] Initialized successfully.");
        return true;
    } catch (error) {
        console.error("[configStore] Initialization failed.", error);
        if (error.message?.includes("path not allowed")) {
            console.error(
                `[configStore] Permission denied during initialization. Check tauri.conf.json > allowlist > fs > scope includes "$APPLOCALDATA/${CONFIG_FILENAME}" (and potentially parent dir access).`,
            );
        }
        isInitialized = false; // Ensure it stays false on error
        // Potentially throw or display a user-facing error preventing app usage
        return false;
    }
}

/**
 * Retrieves the user configuration object from AppLocalData.
 * If the file doesn't exist or contains invalid JSON, it returns the DEFAULT_CONFIG.
 *
 * @returns {Promise<object>} The user configuration object.
 */
export async function getConfig() {
    // If using a subdirectory, you might want an initialization check here
    // similar to initializeFormStore to ensure the subdir exists.

    await initializeConfigStore();

    try {
        // Use CONFIG_FILE_PATH if using a subdirectory
        const filePath = CONFIG_FILENAME;
        console.log(`[configStore] Reading config from ${filePath} (AppLocalData)`);

        const content = await readTextFile(filePath, {
            baseDir: BaseDirectory.AppLocalData,
        });

        try {
            const config = JSON.parse(content);
            // Return the loaded config, potentially merged with defaults
            // to ensure all keys exist, or just as is. Let's merge:
            return { ...DEFAULT_CONFIG, ...config };
        } catch (parseError) {
            console.error(
                `[configStore] Error parsing ${filePath}. Returning default config.`,
                parseError,
            );
            // Return a copy of the default config if JSON is corrupt
            return { ...DEFAULT_CONFIG };
        }
    } catch (error) {
        // Handle errors, especially file not found
        // Tauri's readTextFile throws an error if the file doesn't exist.
        // The error message might vary slightly across platforms/versions.
        if (
            error.message?.includes("os error 2") || // Common on Linux/macOS
            error.message?.includes("The system cannot find the file specified") || // Windows
            error.message?.includes("NotFound")
        ) {
            console.log(
                `[configStore] ${CONFIG_FILENAME} not found. Returning default config.`,
            );
        } else if (error.message?.includes("path not allowed")) {
            // Crucial check for Tauri capabilities
            console.error(
                `[configStore] Permission denied reading ${CONFIG_FILENAME}. Check tauri.conf.json > allowlist > fs > scope.`,
                error,
            );
        } else {
            // Log other unexpected errors
            console.error(
                `[configStore] Error reading ${CONFIG_FILENAME}. Returning default config.`,
                error,
            );
        }
        // Return a copy of the default config on any read error
        return { ...DEFAULT_CONFIG };
    }
}

/**
 * Saves the provided configuration object to AppLocalData.
 * Overwrites the existing configuration file.
 *
 * @param {object} configObject - The configuration object to save.
 * @returns {Promise<boolean>} True if saving was successful, false otherwise.
 */
export async function saveConfig(configObject) {
    if (!configObject || typeof configObject !== "object") {
        console.error(
            "[configStore] Invalid config object provided for saving. Must be an object.",
        );
        return false;
    }

    // If using a subdirectory, ensure it's initialized here too.

    try {
        // Use CONFIG_FILE_PATH if using a subdirectory
        const filePath = CONFIG_FILENAME;
        console.log(`[configStore] Saving config to ${filePath} (AppLocalData)`);

        // Convert the object to a pretty-printed JSON string
        const configString = JSON.stringify(configObject, null, 2); // null, 2 for indentation

        await writeTextFile(filePath, configString, {
            baseDir: BaseDirectory.AppLocalData,
        });

        console.log(`[configStore] Successfully saved ${filePath}`);
        return true;
    } catch (error) {
        if (error.message?.includes("path not allowed")) {
            // Crucial check for Tauri capabilities
            console.error(
                `[configStore] Permission denied saving ${CONFIG_FILENAME}. Check tauri.conf.json > allowlist > fs > scope.`,
                error,
            );
        } else {
            console.error(`[configStore] Error saving ${CONFIG_FILENAME}:`, error);
        }
        return false;
    }
}
