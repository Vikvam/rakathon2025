<script>
    import { onMount } from "svelte";
    import { readDir, readTextFile } from "@tauri-apps/plugin-fs"; // Assuming Tauri might be used
    import { resolveResource } from "@tauri-apps/api/path"; // Assuming Tauri might be used
    import { goto } from "$app/navigation";
    import { browser } from "$app/environment";
    import { getConfig } from "$lib/configStore.js"; // Import browser check

    // --- State Management (Svelte 5 Runes) ---
    let errorMessage = $state("");
    let successMessage = $state(""); // Kept for potential future use, but not set in current flow
    let isLoading = $state(true);
    let isProcessing = $state(false); // Used for loading and the combined action
    let categoriesData = $state([]);
    let generatedJsonOutput = $state(""); // State to hold the generated JSON string internally

    let formName = $state("");
    let formDescription = $state(
        "Dotazník o zdravotním stavu mezi návštěvami abulance",
    );

    // --- Constants ---
    const frequencyOptions = [
        { value: "daily", label: "Denně" },
        { value: "weekly", label: "Týdně" },
        { value: "biweekly", label: "Dvoutýdně" },
        { value: "monthly", label: "Měsíčně" },
    ];
    const SESSION_STORAGE_KEY = "pendingConfigJson"; // Key for sessionStorage

    // --- Design Language Colors (Applied via Tailwind) ---
    // Primary: blue-600 (#2563EB - close to #4A90E2)
    // Background: bg-gray-50 (#F9FAFB - close to #F8F9FA) or bg-white
    // Text: text-gray-800 (#1F2937 - close to #343A40), text-gray-600 (#4B5563 - close to #6C757D)
    // Success: green-600 (#16A34A - close to #28A745)
    // Error: red-600 (#DC2626 - close to #DC3545)
    // Warning: yellow-500 (#EAB308 - close to #FFC107)
    // Borders: border-gray-300 (#D1D5DB)

    // --- Lifecycle Hook: Load data when component mounts ---
    onMount(async () => {
        isLoading = true;
        errorMessage = "";
        let loadedCategories = [];

        try {
            // Check if running in Tauri environment
            if (typeof window !== "undefined" && window.__TAURI__) {
                // --- Tauri Logic ---
                const formDirPath = await resolveResource("static/forms");
                const entries = await readDir(formDirPath);
                for (const entry of entries) {
                    if (entry.name === "manifest.json") continue;
                    if (entry.path.endsWith(".json") && !entry.children) {
                        try {
                            const fileContent = await readTextFile(entry.path);
                            const jsonData = JSON.parse(fileContent);
                            // Basic validation
                            if (!jsonData?.formTemplate?.questions) {
                                console.warn(
                                    `Skipping invalid JSON file (Tauri): ${entry.name}`,
                                );
                                continue; // Skip this file
                            }
                            // Map the valid JSON data
                            const category = mapJsonToCategory(
                                jsonData.formTemplate,
                                entry.name,
                            );
                            loadedCategories.push(category);
                        } catch (readError) {
                            console.error(
                                `Error reading/parsing file ${entry.name} (Tauri):`,
                                readError,
                            );
                            errorMessage = `Chyba při čtení souboru ${entry.name}.`; // Show specific error
                        }
                    }
                }
            } else {
                // --- Web Fetch Logic ---
                const manifestResponse = await fetch("/forms/manifest.json");
                if (!manifestResponse.ok) {
                    throw new Error(
                        `Could not fetch manifest.json: ${manifestResponse.statusText}`,
                    );
                }
                const formFiles = await manifestResponse.json();
                if (!Array.isArray(formFiles)) {
                    throw new Error("Invalid manifest.json format");
                }
                for (const filename of formFiles) {
                    if (!filename.endsWith(".json")) continue; // Skip non-JSON
                    try {
                        const formResponse = await fetch(`/forms/${filename}`);
                        if (!formResponse.ok) {
                            console.warn(
                                `Could not fetch form ${filename}: ${formResponse.statusText}`,
                            );
                            continue; // Skip this file
                        }
                        const jsonData = await formResponse.json();
                        // Basic validation
                        if (!jsonData?.formTemplate?.questions) {
                            console.warn(
                                `Skipping invalid JSON data (Web): ${filename}`,
                            );
                            continue; // Skip this file
                        }
                        // Map the valid JSON data
                        const category = mapJsonToCategory(
                            jsonData.formTemplate,
                            filename,
                        );
                        loadedCategories.push(category);
                    } catch (fetchError) {
                        console.error(
                            `Error fetching or parsing file ${filename} (Web):`,
                            fetchError,
                        );
                        errorMessage = `Chyba při načítání souboru ${filename}.`; // Show specific error
                    }
                }
            }

            // Update the state
            categoriesData = loadedCategories;

            // Set error message if no categories were loaded
            if (loadedCategories.length === 0 && !errorMessage) {
                errorMessage = "Nebyly nalezeny nebo načteny žádné formuláře.";
                // Add environment-specific hints if needed
                if (typeof window !== "undefined" && window.__TAURI__) {
                    errorMessage +=
                        " Zkontrolujte obsah adresáře 'static/forms' a tauri.conf.json.";
                } else {
                    errorMessage +=
                        " Zkontrolujte soubor '/forms/manifest.json' a obsah adresáře 'static/forms/'.";
                }
            }
        } catch (error) {
            // Catch general errors
            console.error("Error loading form categories:", error);
            errorMessage =
                error.message || "Nepodařilo se načíst kategorie formulářů.";
            // Add specific error hints based on context
            if (
                error.message?.includes("path not found") &&
                typeof window !== "undefined" &&
                window.__TAURI__
            ) {
                errorMessage =
                    "Adresář 'static/forms' nebyl nalezen nebo není přístupný v Tauri zdrojích.";
            } else if (
                error.message?.includes("fetch") &&
                typeof window !== "undefined" &&
                !window.__TAURI__
            ) {
                errorMessage =
                    "Chyba při komunikaci se serverem pro načtení formulářů (manifest nebo JSON).";
            }
        } finally {
            isLoading = false;
        }
    });

    // TODO: maybe race condition?
    $effect(() => {
        isLoading = true;
        getConfig()
            .then((data) => {
                formName = `${data.user}, ${data.workspace}`;
            })
            .catch((err) => {
                console.error("Failed to load forms:", err);
            })
            .finally(() => {
                isLoading = false;
            });
    });

    // --- Helper Functions ---

    /** Maps schedule ID to frequency string. */
    function mapScheduleIdToFrequency(scheduleId) {
        if (!scheduleId) return "daily";
        const lowerId = scheduleId.toLowerCase();
        if (lowerId.includes("daily")) return "daily";
        if (lowerId.includes("biweekly")) return "biweekly";
        if (lowerId.includes("weekly")) return "weekly";
        if (lowerId.includes("monthly")) return "monthly";
        return "daily"; // Fallback
    }

    /** Maps frequency string back to Schedule ID. */
    function mapFrequencyToScheduleId(frequency) {
        // Using example IDs, adjust if your actual IDs differ
        switch (frequency) {
            case "daily":
                return "SCHED_DAILY_MORNING";
            case "weekly":
                return "SCHED_WEEKLY_MONDAY";
            case "biweekly":
                return "SCHED_BIWEEKLY_MONDAY";
            case "monthly":
                return "SCHED_MONTHLY";
            default:
                return `SCHED_UNKNOWN_${(frequency || "DEFAULT").toUpperCase()}`;
        }
    }

    /** Transforms raw template JSON into UI state structure. */
    function mapJsonToCategory(template, fileName) {
        const categoryId = fileName.replace(".json", "");
        let defaultCategoryFreq = "daily"; // Default

        // Determine default frequency from first question or default schedules
        if (template.questions?.length > 0) {
            defaultCategoryFreq = mapScheduleIdToFrequency(
                template.questions[0]?.timeParameterization?.scheduleId,
            );
        } else if (template.defaultSchedules?.length > 0) {
            const firstSchedFreq = template.defaultSchedules[0]?.frequency;
            if (
                firstSchedFreq &&
                frequencyOptions.some((opt) => opt.value === firstSchedFreq)
            ) {
                defaultCategoryFreq = firstSchedFreq;
            }
        }

        return {
            id: categoryId,
            name: template.name || categoryId,
            description: template.description || "",
            enabled: false, // Default to disabled (unchecked)
            defaultFreq: defaultCategoryFreq,
            defaultSchedules: template.defaultSchedules || [], // Keep original schedules if needed
            questions: (template.questions || []).map((q) => ({
                key: q.key,
                id: q.key, // Use key for Svelte #each
                name: q.text,
                enabled: false, // Default to disabled (unchecked)
                frequency: mapScheduleIdToFrequency(
                    q.timeParameterization?.scheduleId,
                ),
                // Store original properties needed for JSON generation
                dataType: q.dataType,
                options: q.options,
                defaultValue: q.defaultValue,
                problematicValues: q.problematicValues,
                criticalValues: q.criticalValues,
                // Store the form name from source template
                formName: template.name || categoryId,
            })),
        };
    }

    // --- Event Handlers ---

    /** Handles category enable/disable checkbox change. */
    function handleCategoryCheckboxChange(event, categoryIndex) {
        const isChecked = event.target.checked;
        categoriesData[categoryIndex].enabled = isChecked;
        // When enabling a category, also enable all its questions
        if (isChecked) {
            categoriesData[categoryIndex].questions.forEach(
                (q) => (q.enabled = true),
            );
        }
        // Note: When unchecking, questions remain enabled internally but are visually disabled by CSS.
        // This preserves their state if the category is re-enabled.
    }

    /** Handles individual question enable/disable checkbox change. */
    function handleQuestionCheckboxChange(event, categoryIndex, questionIndex) {
        categoriesData[categoryIndex].questions[questionIndex].enabled =
            event.target.checked;
    }

    /** Handles individual question frequency selection change. */
    function handleQuestionFrequencyChange(
        newFrequency,
        categoryIndex,
        questionIndex,
    ) {
        categoriesData[categoryIndex].questions[questionIndex].frequency =
            newFrequency;
    }

    /** Handles category-level frequency selection change. */
    function handleCategoryFrequencyChange(newFrequency, categoryIndex) {
        categoriesData[categoryIndex].defaultFreq = newFrequency;
        // Apply the new frequency to all questions within that category
        categoriesData[categoryIndex].questions.forEach((q) => {
            q.frequency = newFrequency;
        });
    }

    // --- JSON Generation Function (Internal) ---
    /** Generates the final JSON output based on the current UI state. */
    function generateFormJsonInternal() {
        // This function now primarily focuses on creating the JSON object
        // Error handling and state updates are managed by the calling function.
        generatedJsonOutput = ""; // Clear previous internal output

        const templateId = `FORM_CUSTOM_${Date.now()}`;

        const formTemplate = {
            templateId: templateId,
            name: "Vlastní Konfigurace", // Default name
            description: "Vygenerováno z konfiguračního nástroje", // Default description
            defaultSchedules: [
                // Standard schedules included in the template
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
            questions: [],
        };

        let questionsAdded = false;
        // Iterate through UI state to build the questions array
        categoriesData.forEach((category) => {
            if (category.enabled) {
                category.questions.forEach((question) => {
                    if (question.enabled) {
                        questionsAdded = true;
                        const questionObject = {
                            key: question.key,
                            text: question.name,
                            dataType: question.dataType,
                            // Include form_name for category grouping in export
                            formName: question.formName || category.name,
                            // Conditionally include optional fields
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
                            timeParameterization: {
                                scheduleId: mapFrequencyToScheduleId(
                                    question.frequency,
                                ),
                                timestamp: null,
                            },
                        };
                        formTemplate.questions.push(questionObject);
                    }
                });
            }
        });

        // Check if any questions were actually selected
        if (!questionsAdded) {
            errorMessage = "Nebyly vybrány žádné otázky pro dotazník.";
            showFeedbackMessage(null, errorMessage); // Show error immediately
            return false; // Indicate failure
        }

        const finalJson = { formTemplate: formTemplate };
        const jsonString = JSON.stringify(finalJson, null, 2); // Pretty print

        console.log("Generated Form JSON (Internal):", finalJson);
        generatedJsonOutput = jsonString; // Store internally for sending
        return true; // Indicate success
    }

    // --- Navigation Function (Internal) ---
    /** Stores the generated JSON in sessionStorage and navigates. */
    function sendConfigurationInternal() {
        // Assumes generatedJsonOutput is already populated and valid
        if (!browser) return false; // Ensure runs only in browser

        try {
            // JSON.parse(generatedJsonOutput); // Validation already done implicitly by generation
            sessionStorage.setItem(SESSION_STORAGE_KEY, generatedJsonOutput);
            console.log(
                "Configuration stored in sessionStorage, navigating...",
            );
            goto("/form-send"); // Navigate to the next step/page
            return true; // Indicate success
        } catch (e) {
            errorMessage = `Chyba při ukládání nebo navigaci: ${e.message}`;
            showFeedbackMessage(null, errorMessage);
            console.error("Error storing/navigating:", e);
            return false; // Indicate failure
        }
    }

    // --- Combined Action Handler ---
    /** Generates the JSON and sends the configuration in one step. */
    function createAndSendConfiguration() {
        isProcessing = true;
        errorMessage = "";
        successMessage = ""; // Clear messages

        // Step 1: Generate JSON internally
        const generationSuccess = generateFormJsonInternal();

        // Step 2: If generation succeeded, send the configuration
        if (generationSuccess && generatedJsonOutput) {
            const sendSuccess = sendConfigurationInternal();
            // Navigation happens in sendConfigurationInternal if successful
            if (!sendSuccess) {
                // Error message is set within sendConfigurationInternal
                isProcessing = false; // Stop processing on send error
                return;
            }
            // If sendConfigurationInternal navigates, this part might not be reached/seen
            // Success is implied by navigation.
        } else {
            // Error message is set within generateFormJsonInternal if failed
            isProcessing = false; // Stop processing on generation error
            return;
        }

        // Only set isProcessing to false if navigation didn't occur (e.g., error)
        // If navigation occurs, the component might unmount anyway.
        // Setting it here covers the error cases.
        isProcessing = false;
    }

    // --- Feedback Message Helper ---
    /** Displays success or error messages in a dedicated message box. */
    function showFeedbackMessage(successMsg, errorMsg) {
        // Update state variables which are bound to the message boxes in the template
        successMessage = successMsg || "";
        errorMessage = errorMsg || "";

        // Optional: Auto-hide messages after a delay
        // Only auto-hide errors now, success is implied by navigation
        if (errorMessage) {
            const timeout = 8000; // Longer for errors
            setTimeout(() => {
                if (errorMsg && errorMessage === errorMsg) {
                    errorMessage = "";
                }
            }, timeout);
        }
    }
</script>

<div class="font-sans bg-gray-50 min-h-screen p-4 md:p-6">
    <div
        class="container mx-auto max-w-4xl bg-white p-5 md:p-8 rounded-lg shadow-md border border-gray-200"
    >
        <h1
            class="text-2xl md:text-3xl font-bold mb-6 text-center text-gray-800"
        >
            Konfigurace Šablon Formulářů
        </h1>

        {#if isLoading}
            <p class="text-center text-gray-500 my-8">Načítání kategorií...</p>
        {/if}

        {#if errorMessage && isLoading}
            <div
                id="errorMessageBoxInitial"
                class="mb-6 p-4 rounded-md text-sm bg-red-100 border border-red-300 text-red-700"
                role="alert"
            >
                <strong class="font-semibold">Chyba při načítání:</strong>
                {errorMessage}
            </div>
        {/if}

        {#if !isLoading}
            <div>
                <p class="text-l mb-1text-gray-700 pt-4">
                    <span class="font-semibold mr-1">Název dotazníku:</span>
                    {formName}
                </p>
                <div class="flex text-l text-m mb-1">
                    <label class="font-semibold mr-24" for="username-input"
                        >Popis:</label
                    >
                    <input
                        type="text"
                        class="flex-1"
                        bind:value={formDescription}
                        required
                        aria-describedby="status-feedback"
                    />
                </div>
                <p class="text-sm text-gray-600 mb-6 leading-relaxed">
                    Zaškrtněte kategorie a otázky, které chcete zahrnout do
                    dotazníku pro pacienta. U každé položky nebo celé kategorie
                    můžete nastavit požadovanou frekvenci vyplňování.
                </p>

                {#if categoriesData.length === 0 && !errorMessage}
                    <p
                        class="text-center text-gray-500 my-8 bg-gray-100 p-4 rounded-md"
                    >
                        Nebyly nalezeny žádné konfigurovatelné formuláře.
                        Zkontrolujte prosím zdrojové soubory.
                    </p>
                {:else if categoriesData.length > 0}
                    <div id="categoriesContainer" class="space-y-4">
                        {#each categoriesData as category, catIndex (category.id)}
                            <details
                                class="block border border-gray-300 rounded-lg shadow-sm"
                                open={category.enabled}
                                on:toggle={(e) => {
                                    // Sync the enabled state if user manually toggles details
                                    if (e.target.open !== category.enabled) {
                                        category.enabled = e.target.open;
                                        // Trigger the same logic as checkbox change for enabling questions
                                        if (category.enabled) {
                                            category.questions.forEach(
                                                (q) => (q.enabled = true),
                                            );
                                        }
                                    }
                                }}
                            >
                                <summary
                                    class="summary-element flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 rounded-t-lg pr-4"
                                    class:rounded-b-lg={!category.enabled}
                                    class:bg-gray-50={category.enabled}
                                    aria-controls="category-content-{category.id}"
                                    aria-expanded={category.enabled}
                                >
                                    <div
                                        class="flex items-start flex-grow min-w-0 mr-4"
                                    >
                                        <span
                                            class="disclosure-arrow text-gray-500 mr-3 text-xs"
                                        ></span>
                                        <input
                                            type="checkbox"
                                            id="cat_cb_{category.id}"
                                            bind:checked={category.enabled}
                                            on:change={(e) =>
                                                handleCategoryCheckboxChange(
                                                    e,
                                                    catIndex,
                                                )}
                                            class="category-checkbox mt-1 flex-shrink-0"
                                            disabled={isProcessing}
                                            on:click|stopPropagation
                                            aria-labelledby="cat_label_{category.id}"
                                        />
                                        <label
                                            id="cat_label_{category.id}"
                                            for="cat_cb_{category.id}"
                                            class="category-label ml-3 font-semibold text-gray-800 cursor-pointer"
                                        >
                                            {category.name}
                                            {#if category.description}
                                                <span
                                                    class="block text-xs text-gray-500 font-normal mt-1"
                                                >
                                                    {category.description}
                                                </span>
                                            {/if}
                                        </label>
                                    </div>
                                    <div
                                        class="freq-button-group category-freq-group flex-shrink-0 items-end"
                                        class:disabled-group={!category.enabled ||
                                            isProcessing}
                                        role="group"
                                        aria-label="Hromadná frekvence pro {category.name}"
                                        on:click|stopPropagation
                                    >
                                        {#each frequencyOptions as opt (opt.value)}
                                            <button
                                                type="button"
                                                data-frequency={opt.value}
                                                class:selected={opt.value ===
                                                    category.defaultFreq}
                                                disabled={!category.enabled ||
                                                    isProcessing}
                                                on:click={() =>
                                                    handleCategoryFrequencyChange(
                                                        opt.value,
                                                        catIndex,
                                                    )}
                                                class="freq-button"
                                                aria-pressed={opt.value ===
                                                    category.defaultFreq}
                                            >
                                                {opt.label}
                                            </button>
                                        {/each}
                                    </div>
                                </summary>

                                <div
                                    id="category-content-{category.id}"
                                    class="details-content bg-white p-4 border-t border-gray-300 rounded-b-lg"
                                >
                                    {#if category.questions.length === 0}
                                        <p
                                            class="text-sm text-gray-500 italic px-2 py-1"
                                        >
                                            Tato kategorie neobsahuje žádné
                                            otázky.
                                        </p>
                                    {:else}
                                        <div class="space-y-3">
                                            {#each category.questions as question, qIndex (question.id)}
                                                <div
                                                    class="question-row flex flex-wrap items-center gap-x-4 gap-y-2 py-2 border-b border-gray-200 last:border-b-0 flex-row"
                                                    class:disabled-row={!category.enabled ||
                                                        isProcessing}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        id="q_cb_{category.id}_{question.id}"
                                                        bind:checked={
                                                            question.enabled
                                                        }
                                                        on:change={(e) =>
                                                            handleQuestionCheckboxChange(
                                                                e,
                                                                catIndex,
                                                                qIndex,
                                                            )}
                                                        class="question-checkbox flex-shrink-0"
                                                        disabled={!category.enabled ||
                                                            isProcessing}
                                                        aria-labelledby="q_label_{category.id}_{question.id}"
                                                    />
                                                    <label
                                                        id="q_label_{category.id}_{question.id}"
                                                        for="q_cb_{category.id}_{question.id}"
                                                        class="question-label flex-grow text-sm text-gray-700 cursor-pointer min-w-[150px]"
                                                    >
                                                        {question.name}
                                                        <span
                                                            class="text-xs text-gray-500 font-normal ml-1"
                                                        >
                                                            ({question.dataType})
                                                        </span>
                                                    </label>
                                                    <div
                                                        class="freq-button-group question-freq-group flex-shrink-0 ml-auto sm:ml-0"
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
                                                                aria-pressed={opt.value ===
                                                                    question.frequency}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        {/each}
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            </details>
                        {/each}
                    </div>
                {/if}

                <div class="mt-8 pt-6 border-t border-gray-300 text-center">
                    {#if errorMessage && !isLoading}
                        <div
                            id="actionErrorBox"
                            class="mb-4 p-3 rounded-md text-sm bg-red-100 border border-red-300 text-red-700"
                            role="alert"
                        >
                            <strong class="font-semibold">Chyba:</strong>
                            {errorMessage}
                        </div>
                    {/if}

                    <button
                        type="button"
                        on:click={createAndSendConfiguration}
                        disabled={isProcessing || categoriesData.length === 0}
                        class="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={categoriesData.length === 0
                            ? "Nejsou k dispozici žádné kategorie"
                            : "Vytvořit a odeslat konfiguraci"}
                    >
                        {#if isProcessing}
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                ></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            Vytváření...
                        {:else}
                            Vytvořit dotazník pro pacienta
                        {/if}
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>
```

<style lang="postcss">
    @reference '../../app.css'; /* Adjust path if needed */
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    /* Custom styles for <details> and <summary> to enhance card appearance */
    .summary-element {
        list-style: none; /* Remove default marker */
        transition: background-color 0.2s ease-in-out;
    }
    .summary-element::-webkit-details-marker {
        display: none; /* Hide default marker in WebKit */
    }
    .summary-element > * {
        pointer-events: none; /* Allow clicks only on summary itself initially */
    }
    /* Allow interaction with actual controls inside summary */
    .summary-element input,
    .summary-element label,
    .summary-element button {
        pointer-events: auto;
    }

    /* Custom disclosure arrow */
    .disclosure-arrow::before {
        content: "►"; /* Right-pointing triangle */
        display: inline-block;
        transition: transform 0.2s ease-in-out;
        transform-origin: center;
    }
    details[open] > .summary-element .disclosure-arrow::before {
        transform: rotate(90deg); /* Rotate down when open */
    }

    /* Remove bottom radius from summary when details is open */
    details[open] > .summary-element {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
    }

    /* Styling for frequency button groups */
    .freq-button-group {
        display: inline-flex;
        flex-wrap: wrap; /* Allow buttons to wrap */
        justify-content: flex-end;
        gap: 0.25rem; /* gap-1 */
        align-self: flex-end;
    }

    .details-content .freq-button-group {
        /* width: 100%; */ /* Removed to allow natural width */
        justify-content: flex-end;
    }

    /* Base styling for frequency buttons */
    .freq-button {
        @apply transition duration-150 ease-in-out border px-2.5 py-1 text-xs rounded-md shadow-sm;
        @apply focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500; /* Focus state */
    }

    /* Styling for selected frequency button (Primary Color) */
    .freq-button.selected {
        @apply bg-blue-600 text-white border-blue-600 font-medium;
    }

    /* Styling for unselected frequency button (Secondary/Neutral) */
    .freq-button:not(.selected) {
        @apply bg-white text-gray-700 border-gray-300 hover:bg-gray-100;
    }

    /* Styling for disabled frequency button */
    .freq-button:disabled {
        @apply opacity-60 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400;
    }
    /* Prevent hover effect on disabled */
    .freq-button:disabled:hover {
        @apply bg-gray-100;
    }

    /* Style disabled groups/rows */
    .disabled-group,
    .disabled-row {
        opacity: 0.6;
        /* pointer-events: none; */ /* Let individual elements handle disabled state */
    }
    /* Style children of disabled rows/groups to look disabled */
    .disabled-row label,
    .disabled-row .freq-button:not(:disabled) {
        /* Target non-disabled buttons within disabled row */
        color: theme("colors.gray.400");
    }
    .disabled-row .freq-button:not(.selected):not(:disabled) {
        background-color: theme("colors.gray.50");
        border-color: theme("colors.gray.200");
    }

    /* Styling for checkboxes (using primary color) */
    .category-checkbox,
    .question-checkbox {
        height: 1.1rem; /* Slightly smaller */
        width: 1.1rem;
        /* Tailwind classes for checkbox appearance */
        @apply border-gray-400 bg-white rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-white checked:bg-blue-600 checked:border-blue-600 cursor-pointer;
    }
    .category-checkbox:disabled,
    .question-checkbox:disabled {
        @apply cursor-not-allowed opacity-70 bg-gray-100;
    }

    /* Specific layout adjustments for question frequency buttons on smaller screens */
    .question-freq-group {
        @media (max-width: 640px) {
            /* sm breakpoint */
            width: 100%;
            justify-content: flex-start; /* Align left below label */
            padding-left: calc(
                1.1rem + 0.75rem
            ); /* Align with checkbox + margin */
            margin-top: 0.25rem; /* Add space when wrapped */
        }
    }

    /* Style for the JSON output area - Removed as JSON is no longer displayed */
    /* pre {
		tab-size: 2;
		white-space: pre-wrap;
		word-break: break-all;
	} */
</style>
