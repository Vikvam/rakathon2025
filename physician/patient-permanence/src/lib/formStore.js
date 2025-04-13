
import {
  readDir,
  readTextFile,
  writeTextFile,
  remove,
  mkdir,
  exists,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

const FORM_SUBDIR = "assignedForms";
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
 * Retrieves the content of all form definition files as JSON strings.
 * Reads the forms directory, filters for .json files, and reads their content.
 * Skips files that cannot be read or parsed, logging an error for each.
 * @returns {Promise<Array<Object>>} A list of form JSON contents. Returns empty array on directory read error.
 */
export async function getForms() {
  // Ensure the directory is ready before listing/reading
  // Assuming initializeFormStore handles the isInitialized flag internally
  const initialized = await initializeFormStore();
  if (!initialized) {
    console.error("[formStore:getForms] Store not initialized. Aborting.");
    return []; // Cannot proceed if store isn't ready
  }

  console.log(`[formStore:getForms] Reading all forms from ${FORM_SUBDIR}`);
  try {
    // 1. Read the directory
    const entries = await readDir(FORM_SUBDIR, {
      baseDir: BaseDirectory.AppLocalData,
      recursive: false, // Usually false for a flat list of forms
    });

    // 2. Filter for .json files
    const formFileEntries = entries.filter(
        (entry) => entry.name?.endsWith(".json") && !entry.children,
    );

    // 3. Read content of each file concurrently
    const formContentPromises = formFileEntries.map(async (fileEntry) => {
      const formId = fileEntry.name.replace(".json", ""); // For logging purposes
      const relativePath = `${FORM_SUBDIR}/${fileEntry.name}`;
      try {
        // Read file content
        const content = await readTextFile(relativePath, {
          baseDir: BaseDirectory.AppLocalData,
        });
        // Optional: Basic validation that content is valid JSON
        return JSON.parse(content).formTemplate;
      } catch (readError) {
        console.error(
            `[formStore:getForms] Error reading form file "${fileEntry.name}":`,
            readError,
        );
        // Return null for files that couldn't be read/parsed
        // These will be filtered out later
        return null;
      }
    });

    // Wait for all read attempts to complete
    const allContents = await Promise.all(formContentPromises);

    // 4. Filter out null results (files that failed to read)
    const validFormContents = allContents.filter(
        (content) => content !== null,
    );

    console.log(
        `[formStore:getForms] Successfully read ${validFormContents.length} out of ${formFileEntries.length} potential form files.`,
    );
    return validFormContents; // Return array of JSON strings
  } catch (dirError) {
    // Handle errors reading the directory itself (e.g., permissions)
    if (dirError.message?.includes("path not allowed")) {
      console.error(
          `[formStore:getForms] Permission denied reading directory ${FORM_SUBDIR}. Check capabilities.`,
          dirError,
      );
    } else {
      console.error(
          `[formStore:getForms] Error reading forms directory ${FORM_SUBDIR}:`,
          dirError,
      );
    }
    return []; // Return empty array on directory read error
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
 * Saves answers to a form definition file.
 * @param {string} formId - The identifier (filename without extension) for the form.
 * @param {Object} answers - The answers to save.
 * @returns {Promise<boolean>} True on success, false on failure.
 */
export async function formSaveAnswers(formId, answers) {
  if (!formId || !answers) return false;

  console.log(answers);

  const data = await getForm(formId);
  if (!data) return false;
  const form = JSON.parse(data);
  
  // create a new form to which we will push the new questions with answers
  let new_form = JSON.parse(JSON.stringify(form));
  new_form.formTemplate.questions = [];
  
  for (const [questionKey, answer] of Object.entries(answers)) {
    const question = form.formTemplate.questions.find(q => q.key === questionKey);
    if (!question) continue;
    const new_question = JSON.parse(JSON.stringify(question));

    if (!new_question.answers) new_question.answers = [];
    
    new_question.answers.push({
      timestamp: new Date().toISOString(),
      value: answer,
    });

    new_form.formTemplate.questions.push(new_question);
  }

  return await saveForm(formId, JSON.stringify(new_form));
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
    .replace(/\s+/g, "_") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove invalid characters
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens
}
