import {
  readDir,
  readTextFile,
  writeTextFile,
  remove,
  mkdir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

const FORM_SUBDIR = "form_definitions";
let isInitialized = false;

/**
 * Ensures the form definitions directory exists.
 * Should be called once, ideally at app startup or before the first FS operation.
 * It's designed to be safe to call multiple times due to the isInitialized flag.
 * @returns {Promise<boolean>} True if initialization was successful (or already done), false on error.
 */
async function initializeFormStore() {
  if (isInitialized) {
    return true; // Already initialized successfully
  }

  try {
    // Check if the subdirectory exists within the AppLocalData directory
    // Note: `exists` options use `dir` not `baseDir` according to some examples, double-check specific plugin version docs if issues arise. Let's stick to `baseDir` for consistency unless proven otherwise.
    const dirExists = await exists(FORM_SUBDIR, {
      baseDir: BaseDirectory.AppLocalData,
    });
    if (!dirExists) {
      console.log(
        `[formStore] Creating forms directory: ${FORM_SUBDIR} in AppLocalData`,
      );
      // Create the directory using mkdir, recursively if needed
      // Use baseDir option here
      await mkdir(FORM_SUBDIR, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
      });
      console.log(`[formStore] Forms directory created successfully.`);
    } else {
      // console.log(`[formStore] Forms directory already exists: ${FORM_SUBDIR} in AppLocalData`);
    }
    isInitialized = true; // Mark as initialized successfully
    return true;
  } catch (error) {
    console.error(
      "[formStore] Fatal Error: Could not initialize forms directory.",
      error,
    );
    // Check for permission errors specifically
    if (error.message?.includes("path not allowed")) {
      console.error(
        "[formStore] Permission denied during initialization. Check capabilities (fs:allow-exists, fs:allow-mkdir, fs:scope).",
      );
    }
    // Prevent further operations if initialization fails
    isInitialized = false; // Ensure it stays false on error
    // In a real app, show a user-facing error here
    // throw new Error("Failed to initialize forms storage directory."); // Or return false
    return false;
  }
}

/**
 * Lists available form definitions by reading the forms directory.
 * Reads each JSON file to extract the form name.
 * @returns {Promise<Array<{id: string, name: string}>>} A list of form identifiers and names.
 */
export async function listForms() {
  // Ensure the directory is ready before listing
  await initializeFormStore();

  console.log(`[formStore] Listing forms in ${FORM_SUBDIR} (AppLocalData)`);
  try {
    // Read the directory relative to AppLocalData
    const entries = await readDir(FORM_SUBDIR, {
      baseDir: BaseDirectory.AppLocalData,
      recursive: false,
    }); // recursive: false is default

    // Filter for files ending in .json
    const formFiles = entries.filter(
      (entry) => entry.name?.endsWith(".json") && !entry.children, // entry.children is null/undefined for files
    );

    // Read each file to get the actual name property
    const forms = await Promise.all(
      formFiles.map(async (fileEntry) => {
        const formId = fileEntry.name.replace(".json", "");
        try {
          // Construct the relative path for reading
          const relativePath = `${FORM_SUBDIR}/${fileEntry.name}`;
          // Read the file relative to AppLocalData
          const content = await readTextFile(relativePath, {
            baseDir: BaseDirectory.AppLocalData,
          });
          const jsonData = JSON.parse(content);
          // Use name from JSON content, fallback to ID if missing/invalid
          return {
            id: formId,
            name: jsonData?.name || formId,
          };
        } catch (readError) {
          console.error(
            `[formStore] Error reading or parsing form file ${fileEntry.name}:`,
            readError,
          );
          // Return a placeholder indicating the file exists but is problematic
          return { id: formId, name: `${formId} (Error Reading)` };
        }
      }),
    );

    return forms;
  } catch (error) {
    // Handle potential errors like directory not found if initializeFormStore failed or permission denied
    if (error.message?.includes("path not allowed")) {
      console.error(
        `[formStore] Permission denied error listing forms in ${FORM_SUBDIR}. Check capabilities.`,
        error,
      );
    } else {
      console.error(
        `[formStore] Error listing forms in ${FORM_SUBDIR}:`,
        error,
      );
    }
    return []; // Return empty array on error
  }
}

/**
 * Retrieves the content of a specific form definition file.
 * @param {string} formId - The identifier (filename without extension) of the form.
 * @returns {Promise<string|null>} The JSON content of the form as a string, or null if not found/error.
 */
export async function getForm(formId) {
  if (!formId) return null; // Handle empty ID case

  // No need to get dir path, just use relative path and baseDir
  try {
    const relativePath = `${FORM_SUBDIR}/${formId}.json`;
    console.log(
      `[formStore] Getting form "${formId}" from ${relativePath} (AppLocalData)`,
    );
    // Read the file relative to AppLocalData
    const content = await readTextFile(relativePath, {
      baseDir: BaseDirectory.AppLocalData,
    });
    return content;
  } catch (error) {
    // Log the error but return null as expected by the calling code
    // Check for common errors like Not Found or Permission Denied
    if (
      error.message?.includes("os error 2") ||
      error.message?.includes("NotFound")
    ) {
      console.warn(`[formStore] Form "${formId}" not found.`);
    } else if (error.message?.includes("path not allowed")) {
      console.error(
        `[formStore] Permission denied getting form "${formId}". Check capabilities.`,
        error,
      );
    } else {
      console.error(`[formStore] Error getting form "${formId}":`, error);
    }
    return null;
  }
}

/**
 * Saves (creates or updates) a form definition file.
 * @param {string} formId - The identifier (filename without extension) for the form.
 * @param {string} formJsonContent - The JSON content of the form as a string.
 * @returns {Promise<boolean>} True on success, false on failure.
 */
export async function saveForm(formId, formJsonContent) {
  if (!formId || !formJsonContent) return false;

  // Ensure the directory is ready before saving
  await initializeFormStore();

  try {
    // Basic validation before writing
    JSON.parse(formJsonContent);

    const relativePath = `${FORM_SUBDIR}/${formId}.json`;
    console.log(
      `[formStore] Saving form "${formId}" to ${relativePath} (AppLocalData)`,
    );
    // Write the file relative to AppLocalData
    await writeTextFile(relativePath, formJsonContent, {
      baseDir: BaseDirectory.AppLocalData,
    });
    console.log(`[formStore] Successfully saved ${relativePath}`);
    return true;
  } catch (error) {
    if (error.message?.includes("path not allowed")) {
      console.error(
        `[formStore] Permission denied saving form "${formId}". Check capabilities.`,
        error,
      );
    } else {
      console.error(`[formStore] Error saving form "${formId}":`, error);
    }
    return false;
  }
}

/**
 * Deletes a form definition file.
 * @param {string} formId - The identifier (filename without extension) of the form.
 * @returns {Promise<boolean>} True on success, false on failure.
 */
export async function deleteForm(formId) {
  if (!formId) return false;

  // No need to ensure dir exists for deletion, but doesn't hurt
  // await initializeFormStore();

  try {
    const relativePath = `${FORM_SUBDIR}/${formId}.json`;
    console.log(
      `[formStore] Deleting form "${formId}" from ${relativePath} (AppLocalData)`,
    );
    // Remove the file relative to AppLocalData
    await remove(relativePath, { baseDir: BaseDirectory.AppLocalData });
    console.log(`[formStore] Successfully deleted ${relativePath}`);
    return true;
  } catch (error) {
    // If the file didn't exist, remove might error. Treat as success? Depends.
    // Current Tauri remove might not error if file doesn't exist, but check specific version behavior.
    if (
      error.message?.includes("os error 2") ||
      error.message?.includes("NotFound")
    ) {
      console.warn(
        `[formStore] Attempted to delete non-existent form "${formId}".`,
      );
      return true; // Or false depending on desired behavior for non-existent file deletion
    } else if (error.message?.includes("path not allowed")) {
      console.error(
        `[formStore] Permission denied deleting form "${formId}". Check capabilities.`,
        error,
      );
    } else {
      console.error(`[formStore] Error deleting form "${formId}":`, error);
    }
    return false;
  }
}

/**
 * Basic utility to generate a simple ID from a name (replace with more robust solution if needed).
 * Remains unchanged as it doesn't interact with the filesystem.
 * @param {string} name
 * @returns {string}
 */
export function generateFormIdFromName(name) {
  if (!name) return `form-${Date.now()}`;
  return name
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove invalid characters
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens
}
