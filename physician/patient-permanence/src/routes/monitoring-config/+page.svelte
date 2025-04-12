<script>
    import { onMount } from "svelte";
    import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
    import { resolveResource } from "@tauri-apps/api/path";
    // import { saveForm, generateFormIdFromName } from "$lib/formStore.js"; // Not used currently
    import { goto } from "$app/navigation";

    // --- State Management (Svelte 5 Runes) ---
    let configName = $state("");
    let configDescription = $state("");
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
                            if (
                                !jsonData ||
                                !jsonData.formTemplate ||
                                !jsonData.formTemplate.questions
                            ) {
                                console.warn(
                                    `Skipping invalid JSON file (Tauri): ${entry.name}`,
                                );
                                continue;
                            }
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
                            errorMessage = `Chyba při čtení souboru ${entry.name}.`;
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
                    if (!filename.endsWith(".json")) continue;
                    try {
                        const formResponse = await fetch(`/forms/${filename}`);
                        if (!formResponse.ok) {
                            console.warn(
                                `Could not fetch form ${filename}: ${formResponse.statusText}`,
                            );
                            continue;
                        }
                        const jsonData = await formResponse.json();
                        if (
                            !jsonData ||
                            !jsonData.formTemplate ||
                            !jsonData.formTemplate.questions
                        ) {
                            console.warn(
                                `Skipping invalid JSON data (Web): ${filename}`,
                            );
                            continue;
                        }
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
                        errorMessage = `Chyba při načítání souboru ${filename}.`;
                    }
                }
            }

            categoriesData = loadedCategories;

            if (loadedCategories.length === 0 && !errorMessage) {
                errorMessage = "Nebyly nalezeny nebo načteny žádné formuláře.";
                if (window.__TAURI__) {
                    errorMessage +=
                        " Zkontrolujte obsah adresáře 'static/forms' a tauri.conf.json.";
                } else {
                    errorMessage +=
                        " Zkontrolujte soubor '/forms/manifest.json' a obsah adresáře 'static/forms/'.";
                }
            }
        } catch (error) {
            console.error("Error loading form categories:", error);
            errorMessage =
                error.message || "Nepodařilo se načíst kategorie formulářů.";
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
            isLoading = false;
        }
    });

    // --- Helper Functions ---

    function mapScheduleIdToFrequency(scheduleId) {
        if (!scheduleId) return "daily";
        const lowerId = scheduleId.toLowerCase();
        if (lowerId.includes("daily")) return "daily";
        if (lowerId.includes("biweekly")) return "biweekly";
        if (lowerId.includes("weekly")) return "weekly";
        if (lowerId.includes("monthly")) return "monthly";
        return "daily";
    }

    // Maps simple frequency string back to a Schedule ID for JSON generation
    function mapFrequencyToScheduleId(frequency) {
        switch (frequency) {
            case "daily":
                return "SCHED_DAILY_MORNING"; // From example form.json
            case "weekly":
                return "SCHED_WEEKLY_MONDAY"; // From example form.json
            case "biweekly":
                return "SCHED_BIWEEKLY_MONDAY"; // From example form.json
            case "monthly":
                return "SCHED_MONTHLY"; // From example form.json
            default:
                return `SCHED_UNKNOWN_${(frequency || "DEFAULT").toUpperCase()}`; // Fallback
        }
    }

    function mapJsonToCategory(template, fileName) {
        const categoryId = fileName.replace(".json", "");
        let defaultCategoryFreq = "daily";
        if (template.questions && template.questions.length > 0) {
            defaultCategoryFreq = mapScheduleIdToFrequency(
                template.questions[0]?.timeParameterization?.scheduleId,
            );
        } else if (
            template.defaultSchedules &&
            template.defaultSchedules.length > 0
        ) {
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
            enabled: true,
            defaultFreq: defaultCategoryFreq,
            // Store original detailed data directly on the category/question objects
            defaultSchedules: template.defaultSchedules || [],
            questions: (template.questions || []).map((q) => ({
                key: q.key,
                id: q.key, // Use key also as svelte #each key
                name: q.text,
                enabled: true, // UI state
                frequency: mapScheduleIdToFrequency(
                    q.timeParameterization?.scheduleId,
                ), // UI state (simplified)
                // Store original detailed properties needed for generation
                dataType: q.dataType,
                options: q.options,
                defaultValue: q.defaultValue,
                problematicValues: q.problematicValues,
                criticalValues: q.criticalValues,
                // Store original scheduleId if needed, though we map back from frequency for generation
                // scheduleId: q.timeParameterization?.scheduleId,
            })),
        };
    }

    // --- Event Handlers ---

    function handleCategoryCheckboxChange(event, categoryIndex) {
        const isEnabled = event.target.checked;
        categoriesData[categoryIndex].enabled = isEnabled;
    }

    function handleQuestionCheckboxChange(event, categoryIndex, questionIndex) {
        categoriesData[categoryIndex].questions[questionIndex].enabled =
            event.target.checked;
    }

    function handleQuestionFrequencyChange(
        newFrequency,
        categoryIndex,
        questionIndex,
    ) {
        categoriesData[categoryIndex].questions[questionIndex].frequency =
            newFrequency;
    }

    function handleCategoryFrequencyChange(newFrequency, categoryIndex) {
        categoriesData[categoryIndex].defaultFreq = newFrequency;
        categoriesData[categoryIndex].questions.forEach((q) => {
            q.frequency = newFrequency;
        });
    }

    // --- JSON Generation Function ---
    function generateFormJson() {
        isProcessing = true;
        errorMessage = "";
        successMessage = "";
        generatedJsonOutput = ""; // Clear previous output

        // Simple template ID generation from name
        const templateId = `FORM_${configName
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9_]+/g, "_")}`;

        const formTemplate = {
            templateId: templateId,
            name: configName.trim(),
            description: configDescription.trim(),
            // Use hardcoded default schedules from user example for consistency
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
            questions: [],
        };

        // Iterate through UI state and add enabled questions
        categoriesData.forEach((category) => {
            if (category.enabled) {
                category.questions.forEach((question) => {
                    if (question.enabled) {
                        // Construct the question object using stored detailed properties
                        const questionObject = {
                            key: question.key,
                            text: question.name, // name holds the text in UI state
                            dataType: question.dataType,
                            // Include optional fields only if they exist in the loaded data
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
                                ), // Map UI frequency back
                                timestamp: null, // Timestamp is typically null in templates
                            },
                        };
                        formTemplate.questions.push(questionObject);
                    }
                });
            }
        });

        const finalJson = { formTemplate: formTemplate };
        const jsonString = JSON.stringify(finalJson, null, 2); // Pretty print

        // Output the JSON
        console.log("Generated Form JSON:", finalJson);
        generatedJsonOutput = jsonString; // Update state for display in <pre>
        successMessage =
            "JSON úspěšně vygenerován a zobrazen níže (také v konzoli).";

        isProcessing = false;
        showFeedbackMessage(successMessage, null); // Show success feedback
    }

    // --- Feedback Message Helper ---
    function showFeedbackMessage(successMsg, errorMsg) {
        const msgBox = document.getElementById("generationMessageBox"); // Use the new message box ID
        const success = !!successMsg;
        if (msgBox) {
            msgBox.textContent = success ? successMsg : errorMsg;
            msgBox.classList.remove("hidden");
            if (success) {
                msgBox.classList.remove("bg-red-900", "text-red-200");
                msgBox.classList.add("bg-green-900", "text-green-200");
            } else {
                msgBox.classList.remove("bg-green-900", "text-green-200");
                msgBox.classList.add("bg-red-900", "text-red-200");
            }
            // Keep message visible longer if it's an error or contains output
            const timeout = success && !generatedJsonOutput ? 3000 : 8000;
            setTimeout(() => {
                // Only hide if it wasn't updated again in the meantime
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
            <h2 class="text-lg font-semibold mb-3 text-gray-200">
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
                    class="inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {#if isProcessing}
                        Generování...
                    {:else}
                        Vygenerovat JSON Formuláře
                    {/if}
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
    @reference "../../app.css" /* Adjust path if needed */
    @reference tailwindcss;

    details > summary {
        list-style: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        transition: background-color 0.2s;
        gap: 0.75rem;
    }
    details[open] > summary {
        border-bottom-left-radius: 0;
        border-bottom-right-radius: 0;
        border-bottom: none;
    }
    details > summary::before {
        content: "►";
        margin-right: 0.5rem;
        font-size: 0.7em;
        transition: transform 0.2s ease-in-out;
        flex-shrink: 0;
        @apply text-gray-400;
    }
    details[open] > summary::before {
        transform: rotate(90deg);
    }
    .summary-main {
        display: flex;
        align-items: flex-start;
        flex-grow: 1;
        min-width: 0;
    }
    .category-label {
        margin-left: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        overflow-wrap: break-word;
        word-break: break-word;
        hyphens: auto;
    }
    .details-content {
        padding: 1rem;
        border-top: none;
        border-bottom-left-radius: 0.375rem;
        border-bottom-right-radius: 0.375rem;
    }
    .question-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        padding: 0.5rem 0;
        gap: 0.5rem;
    }
    .question-row:last-child {
        border-bottom: none !important;
    }
    .question-label {
        flex-grow: 1;
        margin-left: 0.75rem;
        margin-right: 1rem;
        font-size: 0.875rem;
        cursor: pointer;
        line-height: 1.4;
        overflow-wrap: break-word;
        word-break: break-word;
        hyphens: auto;
        min-width: 100px;
    }
    .freq-button-group {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        flex-shrink: 0;
    }
    .category-freq-group {
        margin-left: auto;
        align-self: center;
    }
    .category-freq-group button {
        pointer-events: auto;
    }

    .category-freq-group.disabled {
        opacity: 0.6;
        pointer-events: none;
    }
    .category-freq-group.disabled button {
        pointer-events: none;
    }

    .freq-button-group button {
        @apply transition duration-200 ease-in-out border px-2 py-1 text-xs rounded-md;
    }
    .freq-button-group button.selected {
        @apply bg-blue-500 text-white border-blue-500;
    }
    .freq-button-group button:not(.selected) {
        @apply bg-gray-700 text-gray-200 border-gray-500;
    }
    .freq-button-group button:not(.selected):hover {
        @apply bg-gray-600;
    }
    .freq-button-group button:disabled {
        @apply opacity-50 cursor-not-allowed bg-gray-800 border-gray-600 text-gray-400;
    }

    .question-row .freq-button-group {
        margin-left: auto;
        @media (max-width: 640px) {
            margin-left: 0;
            width: 100%;
            justify-content: flex-end;
            padding-left: 2.15rem;
        }
    }
    .question-row.disabled {
        opacity: 0.6;
    }
    .question-row.disabled label,
    .question-row.disabled input,
    .question-row.disabled button {
        cursor: not-allowed;
        pointer-events: none;
    }

    .category-checkbox,
    .question-checkbox {
        height: 1.15rem;
        width: 1.15rem;
        flex-shrink: 0;
        margin-top: 0.125rem;
        @apply border-gray-600 bg-gray-700 rounded text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-800 checked:bg-blue-600 checked:border-blue-600;
        cursor: pointer;
    }
    .category-checkbox:disabled,
    .question-checkbox:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    details > summary {
        @apply border-gray-700 bg-gray-800 hover:bg-gray-700;
    }
    details[open] > summary {
        @apply bg-gray-700;
    }
    .details-content {
        @apply border-gray-700 bg-gray-800;
    }
    .question-row {
        @apply border-gray-700;
    }

    summary.open-summary {
        /* Add specific styles for when the details element is open if needed */
    }

    /* Style for the JSON output area */
    pre {
        max-height: 300px; /* Limit height and make scrollable */
        tab-size: 2;
    }
</style>
