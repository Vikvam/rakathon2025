<script>
    import { onMount } from "svelte";
    import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
    import { resolveResource } from "@tauri-apps/api/path";
    // import { saveForm, generateFormIdFromName } from "$lib/formStore.js"; // Not used currently
    import { goto } from "$app/navigation";
    import { browser } from "$app/environment"; // Import browser check

    // --- State Management (Svelte 5 Runes) ---
    // Removed configName and configDescription state variables
    let errorMessage = $state("");
    let successMessage = $state("");
    let isLoading = $state(true);
    let isProcessing = $state(false); // Used for loading and generation
    let categoriesData = $state([]);
    let generatedJsonOutput = $state(""); // State to hold the generated JSON string

    // --- Constants ---
    const frequencyOptions = [
        { value: "daily", label: "Denně" },
        { value: "weekly", label: "Týdně" },
        { value: "biweekly", label: "Dvoutýdně" },
        { value: "monthly", label: "Měsíčně" },
    ];
    const SESSION_STORAGE_KEY = "pendingConfigJson"; // Key for sessionStorage

    // --- Lifecycle Hook: Load data when component mounts ---
    onMount(async () => {
        isLoading = true;
        errorMessage = "";
        let loadedCategories = [];

        try {
            if (window.__TAURI__) {
                // --- Tauri Logic ---
                const formDirPath = await resolveResource("static/forms");
                const entries = await readDir(formDirPath);
                for (const entry of entries) {
                    if (entry.name === "manifest.json") continue;
                    if (entry.path.endsWith(".json") && !entry.children) {
                        try {
                            const fileContent = await readTextFile(entry.path);
                            const jsonData = JSON.parse(fileContent);
                            // Basic validation: Check if formTemplate and questions exist
                            if (
                                !jsonData ||
                                !jsonData.formTemplate ||
                                !jsonData.formTemplate.questions
                            ) {
                                console.warn(
                                    `Skipping invalid JSON file (Tauri): ${entry.name}`,
                                );
                                continue; // Skip this file
                            }
                            // Map the valid JSON data to our category structure
                            const category = mapJsonToCategory(
                                jsonData.formTemplate,
                                entry.name,
                            );
                            loadedCategories.push(category);
                        } catch (readError) {
                            // Log error reading/parsing specific file
                            console.error(
                                `Error reading/parsing file ${entry.name} (Tauri):`,
                                readError,
                            );
                            // Set a user-friendly error message (optional, could accumulate errors)
                            errorMessage = `Chyba při čtení souboru ${entry.name}.`;
                        }
                    }
                }
            } else {
                // --- Web Fetch Logic ---
                // Fetch the manifest file listing all form JSON files
                const manifestResponse = await fetch("/forms/manifest.json");
                if (!manifestResponse.ok) {
                    // Throw error if manifest can't be fetched
                    throw new Error(
                        `Could not fetch manifest.json: ${manifestResponse.statusText}`,
                    );
                }
                // Parse the manifest JSON
                const formFiles = await manifestResponse.json();
                // Validate manifest format
                if (!Array.isArray(formFiles)) {
                    throw new Error("Invalid manifest.json format");
                }
                // Fetch each form file listed in the manifest
                for (const filename of formFiles) {
                    if (!filename.endsWith(".json")) continue; // Skip non-JSON files
                    try {
                        // Fetch individual form JSON file
                        const formResponse = await fetch(`/forms/${filename}`);
                        if (!formResponse.ok) {
                            // Warn if a specific form file fails to fetch
                            console.warn(
                                `Could not fetch form ${filename}: ${formResponse.statusText}`,
                            );
                            continue; // Skip this file
                        }
                        // Parse the form JSON data
                        const jsonData = await formResponse.json();
                        // Basic validation: Check if formTemplate and questions exist
                        if (
                            !jsonData ||
                            !jsonData.formTemplate ||
                            !jsonData.formTemplate.questions
                        ) {
                            console.warn(
                                `Skipping invalid JSON data (Web): ${filename}`,
                            );
                            continue; // Skip this file
                        }
                        // Map the valid JSON data to our category structure
                        const category = mapJsonToCategory(
                            jsonData.formTemplate,
                            filename,
                        );
                        loadedCategories.push(category);
                    } catch (fetchError) {
                        // Log error fetching/parsing specific file
                        console.error(
                            `Error fetching or parsing file ${filename} (Web):`,
                            fetchError,
                        );
                        // Set a user-friendly error message (optional)
                        errorMessage = `Chyba při načítání souboru ${filename}.`;
                    }
                }
            }

            // Update the state with the loaded categories
            categoriesData = loadedCategories;

            // Set error message if no categories were loaded successfully
            if (loadedCategories.length === 0 && !errorMessage) {
                errorMessage = "Nebyly nalezeny nebo načteny žádné formuláře.";
                // Add environment-specific hints
                if (window.__TAURI__) {
                    errorMessage +=
                        " Zkontrolujte obsah adresáře 'static/forms' a tauri.conf.json.";
                } else {
                    errorMessage +=
                        " Zkontrolujte soubor '/forms/manifest.json' a obsah adresáře 'static/forms/'.";
                }
            }
        } catch (error) {
            // Catch general errors during the loading process (e.g., manifest fetch error)
            console.error("Error loading form categories:", error);
            errorMessage =
                error.message || "Nepodařilo se načíst kategorie formulářů.";
            // Provide specific error messages for common issues
            if (
                error.message &&
                error.message.includes("path not found") &&
                window.__TAURI__
            ) {
                errorMessage =
                    "Adresář 'static/forms' nebyl nalezen nebo není přístupný v Tauri zdrojích.";
            } else if (
                error.message &&
                error.message.includes("fetch") &&
                !window.__TAURI__
            ) {
                errorMessage =
                    "Chyba při komunikaci se serverem pro načtení formulářů (manifest nebo JSON).";
            }
        } finally {
            // Ensure loading state is set to false regardless of success or failure
            isLoading = false;
        }
    });

    // --- Helper Functions ---

    /**
     * Maps a schedule ID string (e.g., "SCHED_DAILY_MORNING") to a simplified frequency string (e.g., "daily").
     * @param {string | undefined} scheduleId - The schedule ID from the JSON data.
     * @returns {string} The simplified frequency ('daily', 'weekly', 'biweekly', 'monthly'). Defaults to 'daily'.
     */
    function mapScheduleIdToFrequency(scheduleId) {
        if (!scheduleId) return "daily"; // Default if undefined
        const lowerId = scheduleId.toLowerCase();
        // Check for keywords in the ID
        if (lowerId.includes("daily")) return "daily";
        if (lowerId.includes("biweekly")) return "biweekly"; // Check biweekly before weekly
        if (lowerId.includes("weekly")) return "weekly";
        if (lowerId.includes("monthly")) return "monthly";
        return "daily"; // Fallback default
    }

    /**
     * Maps a simplified frequency string (e.g., "daily") back to a predefined Schedule ID string.
     * Used when generating the final JSON output.
     * @param {string} frequency - The simplified frequency selected in the UI.
     * @returns {string} The corresponding Schedule ID string.
     */
    function mapFrequencyToScheduleId(frequency) {
        switch (frequency) {
            case "daily":
                return "SCHED_DAILY_MORNING"; // Example ID
            case "weekly":
                return "SCHED_WEEKLY_MONDAY"; // Example ID
            case "biweekly":
                return "SCHED_BIWEEKLY_MONDAY"; // Example ID
            case "monthly":
                return "SCHED_MONTHLY"; // Example ID
            default:
                // Generate a fallback ID if frequency is unknown
                return `SCHED_UNKNOWN_${(frequency || "DEFAULT").toUpperCase()}`;
        }
    }

    /**
     * Transforms the raw form template JSON into the structure needed for the UI state.
     * @param {object} template - The formTemplate object from the loaded JSON.
     * @param {string} fileName - The original filename (used to derive category ID).
     * @returns {object} An object representing the category and its questions for the UI.
     */
    function mapJsonToCategory(template, fileName) {
        // Generate category ID from filename
        const categoryId = fileName.replace(".json", "");
        // Determine default frequency for the category (based on first question or default schedules)
        let defaultCategoryFreq = "daily";
        if (template.questions && template.questions.length > 0) {
            // Use frequency from the first question if available
            defaultCategoryFreq = mapScheduleIdToFrequency(
                template.questions[0]?.timeParameterization?.scheduleId,
            );
        } else if (
            template.defaultSchedules &&
            template.defaultSchedules.length > 0
        ) {
            // Otherwise, try to use frequency from the first default schedule
            const firstSchedFreq = template.defaultSchedules[0]?.frequency;
            // Validate if the schedule frequency matches our UI options
            if (
                firstSchedFreq &&
                frequencyOptions.some((opt) => opt.value === firstSchedFreq)
            ) {
                defaultCategoryFreq = firstSchedFreq;
            }
        }

        // Return the structured category object for the UI state
        return {
            id: categoryId,
            name: template.name || categoryId, // Use name from JSON or fallback to ID
            description: template.description || "", // Use description or empty string
            enabled: true, // Default to enabled
            defaultFreq: defaultCategoryFreq, // The determined default frequency
            defaultSchedules: template.defaultSchedules || [], // Store original schedules
            // Map each question from the JSON to the UI question structure
            questions: (template.questions || []).map((q) => ({
                key: q.key, // Original key
                id: q.key, // Use key also as svelte #each key for reactivity
                name: q.text, // Question text
                enabled: true, // Default to enabled
                frequency: mapScheduleIdToFrequency(
                    q.timeParameterization?.scheduleId,
                ), // Map schedule ID to UI frequency
                // Store original detailed properties needed for JSON generation later
                dataType: q.dataType,
                options: q.options,
                defaultValue: q.defaultValue,
                problematicValues: q.problematicValues,
                criticalValues: q.criticalValues,
                // scheduleId: q.timeParameterization?.scheduleId, // Optionally store original ID
            })),
        };
    }

    // --- Event Handlers ---

    /** Handles changes to the category enable/disable checkbox. */
    function handleCategoryCheckboxChange(event, categoryIndex) {
        const isEnabled = event.target.checked;
        // Update the enabled state of the specific category
        categoriesData[categoryIndex].enabled = isEnabled;
        // Note: We might want to disable/enable child questions here too,
        // but current logic handles that via UI disabling based on parent state.
    }

    /** Handles changes to individual question enable/disable checkboxes. */
    function handleQuestionCheckboxChange(event, categoryIndex, questionIndex) {
        // Update the enabled state of the specific question within its category
        categoriesData[categoryIndex].questions[questionIndex].enabled =
            event.target.checked;
    }

    /** Handles changes to individual question frequency selection. */
    function handleQuestionFrequencyChange(
        newFrequency,
        categoryIndex,
        questionIndex,
    ) {
        // Update the frequency state of the specific question
        categoriesData[categoryIndex].questions[questionIndex].frequency =
            newFrequency;
    }

    /** Handles changes to the category-level frequency selection (applies to all questions in the category). */
    function handleCategoryFrequencyChange(newFrequency, categoryIndex) {
        // Update the default frequency for the category
        categoriesData[categoryIndex].defaultFreq = newFrequency;
        // Apply the new frequency to all questions within that category
        categoriesData[categoryIndex].questions.forEach((q) => {
            q.frequency = newFrequency;
        });
    }

    // --- JSON Generation Function ---
    /** Generates the final JSON output based on the current UI state. */
    function generateFormJson() {
        isProcessing = true; // Indicate processing started
        // Reset messages
        errorMessage = "";
        successMessage = "";
        generatedJsonOutput = ""; // Clear previous output

        // Removed validation for configName

        // Generate a template ID using a timestamp for uniqueness
        const templateId = `FORM_CUSTOM_${Date.now()}`;

        // Initialize the structure for the output JSON
        const formTemplate = {
            templateId: templateId,
            name: "Vlastní Konfigurace", // Assign a default name
            description: "Vygenerováno z konfiguračního nástroje", // Assign a default description
            // Include predefined default schedules (as per original example structure)
            defaultSchedules: [
                {
                    scheduleId: "SCHED_DAILY_MORNING",
                    frequency: "daily",
                    dayOfWeek: null,
                    timeOfDay: "09:00",
                },
                {
                    scheduleId: "SCHED_WEEKLY_MONDAY",
                    frequency: "weekly",
                    dayOfWeek: "Monday",
                    timeOfDay: "10:00",
                },
                {
                    scheduleId: "SCHED_BIWEEKLY_MONDAY",
                    frequency: "biweekly",
                    dayOfWeek: "Tuesday",
                    timeOfDay: "11:00",
                },
                {
                    scheduleId: "SCHED_MONTHLY",
                    frequency: "monthly",
                    dayOfMonth: 13,
                    timeOfDay: "14:00",
                },
            ],
            questions: [], // Initialize empty questions array
        };

        // Iterate through UI state (categories and questions) to build the questions array
        categoriesData.forEach((category) => {
            // Only include questions from enabled categories
            if (category.enabled) {
                category.questions.forEach((question) => {
                    // Only include enabled questions
                    if (question.enabled) {
                        // Construct the question object for the output JSON
                        // using the detailed properties stored during initial mapping
                        const questionObject = {
                            key: question.key,
                            text: question.name, // Use 'name' from UI state as 'text'
                            dataType: question.dataType,
                            // Conditionally include optional fields only if they exist
                            ...(question.options && {
                                options: question.options,
                            }),
                            ...(question.defaultValue !== undefined && {
                                defaultValue: question.defaultValue,
                            }),
                            ...(question.problematicValues && {
                                problematicValues: question.problematicValues,
                            }),
                            ...(question.criticalValues && {
                                criticalValues: question.criticalValues,
                            }),
                            // Reconstruct the timeParameterization object
                            timeParameterization: {
                                scheduleId: mapFrequencyToScheduleId(
                                    question.frequency, // Map UI frequency back to schedule ID
                                ),
                                timestamp: null, // Templates typically have null timestamp
                            },
                        };
                        // Add the constructed question object to the array
                        formTemplate.questions.push(questionObject);
                    }
                });
            }
        });

        // Wrap the formTemplate in the final structure
        const finalJson = { formTemplate: formTemplate };
        // Convert the final object to a pretty-printed JSON string
        const jsonString = JSON.stringify(finalJson, null, 2);

        // Update state to display the generated JSON
        console.log("Generated Form JSON:", finalJson);
        generatedJsonOutput = jsonString;
        successMessage =
            "JSON úspěšně vygenerován a zobrazen níže (také v konzoli).";

        isProcessing = false; // Indicate processing finished
        showFeedbackMessage(successMessage, null); // Show success feedback
    }

    // --- Navigation Function ---
    /** Stores the generated JSON in sessionStorage and navigates to the form-send page. */
    function sendConfiguration() {
        // Check if JSON has been generated
        if (!generatedJsonOutput) {
            errorMessage = "Nejprve vygenerujte JSON konfiguraci.";
            showFeedbackMessage(null, errorMessage);
            return;
        }
        // Ensure this runs only in the browser environment
        if (!browser) return;

        try {
            // Validate the generated JSON before storing (redundant if generateFormJson works, but safe)
            JSON.parse(generatedJsonOutput);
            // Store the JSON string in sessionStorage
            sessionStorage.setItem(SESSION_STORAGE_KEY, generatedJsonOutput);
            console.log(
                "Configuration stored in sessionStorage, navigating...",
            );
            // Navigate to the form-send page
            goto("/form-send");
        } catch (e) {
            // Handle potential errors during JSON parsing or storage
            errorMessage = `Vygenerovaný JSON není platný: ${e.message}`;
            showFeedbackMessage(null, errorMessage);
            console.error("Error storing invalid JSON:", e);
        }
    }

    // --- Feedback Message Helper ---
    /** Displays success or error messages in a dedicated message box. */
    function showFeedbackMessage(successMsg, errorMsg) {
        // Get the message box element
        const msgBox = document.getElementById("generationMessageBox");
        const success = !!successMsg; // Determine if it's a success message
        if (msgBox) {
            // Set the text content
            msgBox.textContent = success ? successMsg : errorMsg;
            // Make the message box visible
            msgBox.classList.remove("hidden");
            // Apply appropriate styling based on success/error
            if (success) {
                msgBox.classList.remove("bg-red-900", "text-red-200");
                msgBox.classList.add("bg-green-900", "text-green-200");
            } else {
                msgBox.classList.remove("bg-green-900", "text-green-200");
                msgBox.classList.add("bg-red-900", "text-red-200");
            }
            // Set a timeout to hide the message box automatically
            // Keep message visible longer for errors or if JSON output is shown
            const timeout = success && !generatedJsonOutput ? 3000 : 8000;
            setTimeout(() => {
                // Check if the message content is still the same before hiding
                // (prevents hiding if a new message was shown quickly)
                if (msgBox.textContent === (success ? successMsg : errorMsg)) {
                    msgBox.classList.add("hidden");
                }
            }, timeout);
        }
    }
</script>

<div
    class="container mx-auto max-w-4xl bg-gray-900 p-5 md:p-6 rounded-lg shadow-md"
>
    <h1 class="text-xl md:text-2xl font-bold mb-4 text-center text-gray-200">
        Konfigurace Šablon Formulářů
    </h1>

    {#if isLoading}
        <p class="text-center text-gray-400 my-6">Načítání kategorií...</p>
    {/if}

    {#if errorMessage && !isLoading}
        <div
            id="errorMessageBox"
            class="mb-4 p-3 rounded-md text-sm bg-red-900 text-red-200"
            role="alert"
        >
            {errorMessage}
        </div>
    {/if}

    {#if !isLoading}
        <div>
            <h2 class="text-lg font-semibold mb-3 text-gray-200 pt-4">
                Načtené Kategorie a Otázky
            </h2>
            <p class="text-xs text-gray-400 mb-4">
                Zaškrtněte kategorie/otázky a nastavte frekvenci pro zahrnutí do
                generovaného JSON.
            </p>

            {#if categoriesData.length === 0 && !errorMessage && !isLoading}
                <p class="text-center text-gray-500 my-6">
                    Nebyly nalezeny žádné JSON soubory formulářů v adresáři
                    'static/forms/' nebo v manifestu.
                </p>
            {:else if categoriesData.length > 0}
                <div id="categoriesContainer" class="space-y-3">
                    {#each categoriesData as category, catIndex (category.id)}
                        <details class="block" bind:open={category.enabled}>
                            <summary
                                class="border border-gray-700 bg-gray-800 hover:bg-gray-700"
                                class:open-summary={category.enabled}
                            >
                                <div class="summary-main">
                                    <input
                                        type="checkbox"
                                        id="cat_cb_{category.id}"
                                        bind:checked={category.enabled}
                                        on:change={(e) =>
                                            handleCategoryCheckboxChange(
                                                e,
                                                catIndex,
                                            )}
                                        class="category-checkbox"
                                        data-category-id={category.id}
                                        disabled={isProcessing}
                                        on:click|stopPropagation
                                    />
                                    <label
                                        for="cat_cb_{category.id}"
                                        class="category-label text-gray-100"
                                    >
                                        {category.name}
                                        {#if category.description}
                                            <span
                                                class="text-xs text-gray-400 font-normal block ml-0"
                                                >({category.description})</span
                                            >
                                        {/if}
                                    </label>
                                </div>
                                <div
                                    class="freq-button-group category-freq-group"
                                    class:disabled={!category.enabled ||
                                        isProcessing}
                                    role="group"
                                    aria-label="Hromadná frekvence pro {category.name}"
                                >
                                    {#each frequencyOptions as opt (opt.value)}
                                        <button
                                            type="button"
                                            data-frequency={opt.value}
                                            class:selected={opt.value ===
                                                category.defaultFreq}
                                            disabled={!category.enabled ||
                                                isProcessing}
                                            on:click|stopPropagation={() =>
                                                handleCategoryFrequencyChange(
                                                    opt.value,
                                                    catIndex,
                                                )}
                                            class="freq-button"
                                        >
                                            {opt.label}
                                        </button>
                                    {/each}
                                </div>
                            </summary>

                            <div
                                class="details-content border border-gray-700 border-t-0 bg-gray-800"
                            >
                                {#if category.questions.length === 0}
                                    <p
                                        class="text-sm text-gray-500 italic px-2 py-1"
                                    >
                                        Tato kategorie neobsahuje žádné otázky.
                                    </p>
                                {:else}
                                    {#each category.questions as question, qIndex (question.id)}
                                        <div
                                            class="question-row border-b border-gray-700"
                                            class:disabled={!category.enabled ||
                                                isProcessing}
                                        >
                                            <input
                                                type="checkbox"
                                                id="q_cb_{category.id}_{question.id}"
                                                bind:checked={question.enabled}
                                                on:change={(e) =>
                                                    handleQuestionCheckboxChange(
                                                        e,
                                                        catIndex,
                                                        qIndex,
                                                    )}
                                                class="question-checkbox"
                                                disabled={!category.enabled ||
                                                    isProcessing}
                                                data-category-id={category.id}
                                                data-question-id={question.id}
                                            />
                                            <label
                                                for="q_cb_{category.id}_{question.id}"
                                                class="question-label text-gray-300"
                                            >
                                                {question.name}
                                                <span
                                                    class="text-xs text-gray-500 font-normal"
                                                >
                                                    ({question.dataType})</span
                                                >
                                            </label>
                                            <div
                                                class="freq-button-group question-freq-group"
                                                role="group"
                                                aria-label="Frekvence pro {question.name}"
                                            >
                                                {#each frequencyOptions as opt (opt.value)}
                                                    <button
                                                        type="button"
                                                        data-frequency={opt.value}
                                                        class:selected={opt.value ===
                                                            question.frequency}
                                                        disabled={!category.enabled ||
                                                            !question.enabled ||
                                                            isProcessing}
                                                        on:click={() =>
                                                            handleQuestionFrequencyChange(
                                                                opt.value,
                                                                catIndex,
                                                                qIndex,
                                                            )}
                                                        class="freq-button"
                                                    >
                                                        {opt.label}
                                                    </button>
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </details>
                    {/each}
                </div>
            {/if}

            <div class="mt-6 pt-4 border-t border-gray-700 text-center">
                <div
                    id="generationMessageBox"
                    class="mb-3 p-2 rounded-md text-sm hidden"
                    role="alert"
                ></div>

                <button
                    type="button"
                    on:click={generateFormJson}
                    disabled={isProcessing || categoriesData.length === 0}
                    class="inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 mr-3"
                >
                    {#if isProcessing}
                        Generování...
                    {:else}
                        Vygenerovat JSON Formuláře
                    {/if}
                </button>

                <button
                    type="button"
                    on:click={sendConfiguration}
                    disabled={isProcessing || !generatedJsonOutput}
                    class="inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:bg-gray-500"
                    title={!generatedJsonOutput
                        ? "Nejprve vygenerujte JSON"
                        : "Odeslat konfiguraci"}
                >
                    Odeslat Konfiguraci
                </button>

                {#if generatedJsonOutput}
                    <div class="mt-4 text-left">
                        <h3 class="text-md font-semibold text-gray-300 mb-2">
                            Vygenerovaný JSON:
                        </h3>
                        <pre
                            class="bg-gray-800 border border-gray-700 rounded-md p-3 text-xs text-gray-200 overflow-x-auto whitespace-pre-wrap break-words">{generatedJsonOutput}</pre>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style lang="postcss">
    /* Import global styles and Tailwind */
    @reference '../../app.css'; /* Adjust path if needed */
    @reference tailwindcss;

    /* Styles for <details> and <summary> elements */
    details > summary {
        list-style: none; /* Remove default marker */
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem; /* rounded-md */
        transition: background-color 0.2s;
        gap: 0.75rem; /* space-x-3 */
    }
    /* Remove bottom radius when details is open */
    details[open] > summary {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom: none;
    }
    /* Custom disclosure triangle */
    details > summary::before {
        content: "►";
        margin-right: 0.5rem; /* mr-2 */
        font-size: 0.7em;
        transition: transform 0.2s ease-in-out;
        flex-shrink: 0;
        @apply text-gray-400; /* Tailwind color */
    }
    /* Rotate triangle when open */
    details[open] > summary::before {
        transform: rotate(90deg);
    }
    /* Container for checkbox and label in summary */
    .summary-main {
        display: flex;
        align-items: flex-start; /* Align checkbox to top */
        flex-grow: 1;
        min-width: 0; /* Prevent overflow issues */
    }
    /* Category label styling */
    .category-label {
        margin-left: 0.5rem; /* ml-2 */
        font-weight: 600; /* font-semibold */
        cursor: pointer;
        overflow-wrap: break-word; /* Wrap long words */
        word-break: break-word;
        hyphens: auto;
    }
    /* Content area within <details> */
    .details-content {
        padding: 1rem; /* p-4 */
        border-top: none;
        border-bottom-left-radius: 0.375rem; /* rounded-b-md */
        border-bottom-right-radius: 0.375rem;
    }
    /* Styling for each question row */
    .question-row {
        display: flex;
        flex-wrap: wrap; /* Allow wrapping on small screens */
        align-items: center;
        padding: 0.5rem 0; /* py-2 */
        gap: 0.5rem; /* gap-2 */
    }
    /* Remove bottom border for the last question in a category */
    .question-row:last-child {
        border-bottom: none !important;
    }
    /* Question label styling */
    .question-label {
        flex-grow: 1; /* Take available space */
        margin-left: 0.75rem; /* ml-3 */
        margin-right: 1rem; /* mr-4 */
        font-size: 0.875rem; /* text-sm */
        cursor: pointer;
        line-height: 1.4;
        overflow-wrap: break-word;
        word-break: break-word;
        hyphens: auto;
        min-width: 100px; /* Ensure some minimum width */
    }
    /* Container for frequency buttons */
    .freq-button-group {
        display: inline-flex;
        flex-wrap: wrap; /* Allow buttons to wrap */
        gap: 0.25rem; /* gap-1 */
        flex-shrink: 0; /* Prevent shrinking */
    }
    /* Align category frequency buttons to the right */
    .category-freq-group {
        margin-left: auto;
        align-self: center; /* Vertically center */
    }
    /* Ensure category buttons are clickable */
    .category-freq-group button {
        pointer-events: auto;
    }
    /* Style disabled category frequency group */
    .category-freq-group.disabled {
        opacity: 0.6;
        pointer-events: none; /* Disable clicks on the group */
    }
    .category-freq-group.disabled button {
        pointer-events: none; /* Disable clicks on buttons inside */
    }

    /* Base styling for frequency buttons */
    .freq-button-group button {
        @apply transition duration-200 ease-in-out border px-2 py-1 text-xs rounded-md;
    }
    /* Styling for selected frequency button */
    .freq-button-group button.selected {
        @apply bg-blue-500 text-white border-blue-500;
    }
    /* Styling for unselected frequency button */
    .freq-button-group button:not(.selected) {
        @apply bg-gray-700 text-gray-200 border-gray-500;
    }
    /* Hover state for unselected frequency button */
    .freq-button-group button:not(.selected):hover {
        @apply bg-gray-600;
    }
    /* Styling for disabled frequency button */
    .freq-button-group button:disabled {
        @apply opacity-50 cursor-not-allowed bg-gray-800 border-gray-600 text-gray-400;
    }

    /* Align question frequency buttons to the right */
    .question-row .freq-button-group {
        margin-left: auto;
        /* Responsive layout for question frequency buttons */
        @media (max-width: 640px) {
            margin-left: 0; /* Stack below on small screens */
            width: 100%;
            justify-content: flex-end; /* Align to right */
            padding-left: 2.15rem; /* Align with checkbox + label margin */
        }
    }
    /* Style disabled question row */
    .question-row.disabled {
        opacity: 0.6;
    }
    /* Ensure labels/inputs/buttons in disabled row are not interactive */
    .question-row.disabled label,
    .question-row.disabled input,
    .question-row.disabled button {
        cursor: not-allowed;
        pointer-events: none;
    }

    /* Styling for checkboxes */
    .category-checkbox,
    .question-checkbox {
        height: 1.15rem;
        width: 1.15rem;
        flex-shrink: 0;
        margin-top: 0.125rem; /* Align better with text */
        /* Tailwind classes for checkbox appearance */
        @apply border-gray-600 bg-gray-700 rounded text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-800 checked:bg-blue-600 checked:border-blue-600;
        cursor: pointer;
    }
    /* Style disabled checkboxes */
    .category-checkbox:disabled,
    .question-checkbox:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    /* Dark theme adjustments for details/summary */
    details > summary {
        @apply border-gray-700 bg-gray-800 hover:bg-gray-700;
    }
    details[open] > summary {
        @apply bg-gray-700; /* Slightly lighter when open */
    }
    .details-content {
        @apply border-gray-700 bg-gray-800; /* Match summary background */
    }
    .question-row {
        @apply border-gray-700; /* Border color for question rows */
    }

    summary.open-summary {
        /* Add specific styles for when the details element is open if needed */
    }

    /* Style for the JSON output area */
    pre {
        max-height: 300px; /* Limit height and make scrollable */
        tab-size: 2; /* Set tab width for formatting */
    }
</style>
