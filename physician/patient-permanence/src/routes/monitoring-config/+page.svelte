<script>
    import { saveForm, generateFormIdFromName } from "$lib/formStore.js";
    import { goto } from "$app/navigation"; // Keep goto if needed elsewhere, but not used in save

    // --- State Management (Svelte 5 Runes) ---
    let configName = $state("");
    let configDescription = $state("Standardní sada otázek pro sledování."); // Added description state
    let errorMessage = $state("");
    let successMessage = $state("");
    let isProcessing = $state(false);

    // Initial data structure for categories and questions (remains the same)
    let categoriesData = $state([
        {
            id: "neuro",
            name: "Neurologické příznaky",
            enabled: true,
            defaultFreq: "daily",
            questions: [
                {
                    id: "neuro_headache",
                    name: "Máte bolesti hlavy, závratě nebo problémy s rovnováhou?",
                    enabled: true,
                    frequency: "daily",
                },
                {
                    id: "neuro_mood",
                    name: "Zaznamenal(a) jste změny v náladě, paměti nebo chování?",
                    enabled: true,
                    frequency: "daily",
                },
                {
                    id: "neuro_limbs",
                    name: "Cítíte slabost nebo brnění v končetinách?",
                    enabled: true,
                    frequency: "daily",
                },
            ],
        },
        {
            id: "fatigue",
            name: "Únava a celkový stav",
            enabled: true,
            defaultFreq: "daily",
            questions: [
                {
                    id: "fatigue_severe",
                    name: "Cítíte se výrazně unavenější než obvykle?",
                    enabled: true,
                    frequency: "daily",
                },
                {
                    id: "fatigue_sleep",
                    name: "Máte potíže se spánkem nebo nadměrnou ospalost?",
                    enabled: true,
                    frequency: "daily",
                },
            ],
        },
        {
            id: "endocrine",
            name: "Endokrinní systém",
            enabled: true,
            defaultFreq: "weekly",
            questions: [
                {
                    id: "endo_temp",
                    name: "Máte návaly horka, zimnici nebo výkyvy tělesné teploty?",
                    enabled: true,
                    frequency: "weekly",
                },
                {
                    id: "endo_appetite",
                    name: "Změnila se Vaše chuť k jídlu nebo váha (výrazný úbytek nebo přírůstek)?",
                    enabled: true,
                    frequency: "weekly",
                },
                {
                    id: "endo_heart",
                    name: "Máte bušení srdce, třes nebo pocit vnitřního neklidu?",
                    enabled: true,
                    frequency: "weekly",
                },
                {
                    id: "endo_skin",
                    name: "Máte zácpu, citlivost na chlad nebo suchou kůži?",
                    enabled: true,
                    frequency: "weekly",
                },
            ],
        },
        {
            id: "pulmo",
            name: "Plíce",
            enabled: false,
            defaultFreq: "weekly",
            questions: [
                {
                    id: "pulmo_cough",
                    name: "Máte kašel, dušnost nebo tlak na hrudi?",
                    enabled: true,
                    frequency: "weekly",
                },
            ],
        },
        {
            id: "gastro",
            name: "Gastrointestinální trakt",
            enabled: false,
            defaultFreq: "daily",
            questions: [
                {
                    id: "gastro_diarrhea",
                    name: "Máte průjem, nevolnost nebo zvracení?",
                    enabled: true,
                    frequency: "daily",
                },
                {
                    id: "gastro_pain",
                    name: "Máte bolesti břicha nebo krev ve stolici?",
                    enabled: true,
                    frequency: "daily",
                },
            ],
        },
        {
            id: "derm",
            name: "Kůže",
            enabled: false,
            defaultFreq: "weekly",
            questions: [
                {
                    id: "derm_rash",
                    name: "Zaznamenal(a) jste vyrážku, svědění nebo změny barvy kůže?",
                    enabled: true,
                    frequency: "weekly",
                },
                {
                    id: "derm_hair",
                    name: "Vypadávají Vám vlasy víc než obvykle?",
                    enabled: true,
                    frequency: "monthly",
                },
            ],
        },
        {
            id: "ophtha",
            name: "Oči",
            enabled: false,
            defaultFreq: "monthly",
            questions: [
                {
                    id: "ophtha_vision",
                    name: "Máte rozmazané vidění, zarudnutí očí nebo bolest?",
                    enabled: true,
                    frequency: "monthly",
                },
            ],
        },
        {
            id: "uro",
            name: "Močové cesty",
            enabled: false,
            defaultFreq: "monthly",
            questions: [
                {
                    id: "uro_pain",
                    name: "Máte potíže s močením nebo bolesti v oblasti ledvin?",
                    enabled: true,
                    frequency: "monthly",
                },
            ],
        },
        {
            id: "cardio_sym",
            name: "Srdce a cévní systém",
            enabled: false,
            defaultFreq: "weekly",
            questions: [
                {
                    id: "cardio_sym_pain",
                    name: "Zaznamenal(a) jste bolest na hrudi nebo otoky nohou?",
                    enabled: true,
                    frequency: "weekly",
                },
            ],
        },
        {
            id: "inflamm",
            name: "Celkové známky zánětu/autoimunity",
            enabled: false,
            defaultFreq: "weekly",
            questions: [
                {
                    id: "inflamm_fever",
                    name: "Měl(a) jste horečku nebo nevysvětlitelnou bolest svalů/kloubů?",
                    enabled: true,
                    frequency: "weekly",
                },
            ],
        },
        {
            id: "general",
            name: "Obecné změny",
            enabled: false,
            defaultFreq: "monthly",
            questions: [
                {
                    id: "general_menstru",
                    name: "Došlo k nějakým změnám ve Vaší menstruaci nebo libidu?",
                    enabled: true,
                    frequency: "monthly",
                },
                {
                    id: "general_other",
                    name: "Máte nějaký jiný nový nebo neobvyklý zdravotní problém, který jsme ještě nezmínili?",
                    enabled: true,
                    frequency: "monthly",
                },
            ],
        },
    ]);

    const frequencyOptions = [
        { value: "daily", label: "Denně" },
        { value: "weekly", label: "Týdně" },
        { value: "bi_weekly", label: "Dvoutýdně" },
        { value: "monthly", label: "Měsíčně" },
    ];

    // --- Event Handlers (remain the same) ---
    function handleCategoryCheckboxChange(event, categoryIndex) {
        const isEnabled = event.target.checked;
        categoriesData[categoryIndex].enabled = isEnabled;
        // Optionally force-enable/disable questions when category changes
        // categoriesData[categoryIndex].questions.forEach(q => q.enabled = isEnabled);
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
        // Update frequency for all questions within this category
        categoriesData[categoryIndex].questions.forEach((q) => {
            q.frequency = newFrequency;
        });
    }

    // --- Helper to map frequency string to Schedule ID ---
    function mapFrequencyToScheduleId(frequency) {
        switch (frequency) {
            case "daily":
                return "SCHED_DAILY_MORNING";
            case "weekly":
                return "SCHED_WEEKLY_MORNING";
            case "bi_weekly":
                return "SCHED_BIWEEKLY_MORNING";
            case "monthly":
                return "SCHED_MONTHLY";
            default:
                return `SCHED_UNKNOWN_${frequency.toUpperCase()}`; // Fallback
        }
    }

    // --- MODIFIED Save Configuration Handler ---
    async function handleSaveConfiguration(event) {
        event.preventDefault();
        errorMessage = "";
        successMessage = "";

        if (!configName.trim()) {
            errorMessage = "Název šablony formuláře je povinný.";
            return;
        }
        isProcessing = true;

        // Generate the ID for the file and for use within the JSON
        const fileId = generateFormIdFromName(configName);
        if (!fileId) {
            errorMessage = "Nelze vygenerovat platné ID z názvu šablony.";
            isProcessing = false;
            return;
        }

        // --- Build the formTemplate structure ---
        const formTemplate = {
            templateId: "UNIQUE_FORM_TEMPLATE_ID",
            name: "Název formuláře (šablony)",
            description: "Popis účelu formuláře.",
            defaultSchedules: [
                {
                    scheduleId: "SCHED_DAILY_MORNING",
                    frequency: "daily",
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
        // Populate questions based on enabled categories and questions
        categoriesData.forEach((category) => {
            if (category.enabled) {
                category.questions.forEach((question) => {
                    if (question.enabled) {
                        // Create a question object based on the desired structure
                        // Assuming 'single_choice' (Yes/No) as default for these symptom questions
                        const questionObject = {
                            key: question.id, // Use question ID as the key
                            text: question.name, // Use question name as the text for the patient
                            dataType: "single_choice", // Defaulting to single choice
                            options: [
                                // Default Yes/No options
                                { value: "yes", text: "Ano" },
                                { value: "no", text: "Ne" },
                            ],
                            defaultValue: "no", // Default to 'No'
                            problematicValues: ["yes"], // Consider 'Yes' as problematic by default
                            criticalValues: [], // Keep critical empty for now, could also be ['yes']
                            timeParameterization: {
                                scheduleId: mapFrequencyToScheduleId(
                                    question.frequency,
                                ), // Map frequency
                                timestamp: null, // Timestamp is usually set at runtime
                            },
                        };
                        formTemplate.questions.push(questionObject);
                    }
                });
            }
        });

        // --- Prepare the final object to save (matching form.json root) ---
        const saveData = {
            formTemplate: formTemplate,
        };

        console.log(
            `Attempting to save form template with ID: ${fileId}`,
            saveData,
        );
        let success = true;

        isProcessing = false;

        // Show temporary message using the messageBox element
        const msgBox = document.getElementById("messageBox");
        if (msgBox) {
            msgBox.textContent = success ? successMessage : errorMessage;
            msgBox.classList.remove("hidden");
            if (success) {
                msgBox.classList.remove("bg-red-900", "text-red-200");
                msgBox.classList.add("bg-green-900", "text-green-200");
            } else {
                msgBox.classList.remove("bg-green-900", "text-green-200");
                msgBox.classList.add("bg-red-900", "text-red-200");
            }
            setTimeout(
                () => {
                    msgBox.classList.add("hidden");
                    // Clear messages after hiding
                    successMessage = "";
                    errorMessage = "";
                },
                success ? 3000 : 5000,
            );
        }
    }
</script>

<div
    class="container mx-auto max-w-4xl bg-gray-900 p-5 md:p-6 rounded-lg shadow-md"
>
    <h1 class="text-xl md:text-2xl font-bold mb-4 text-center text-gray-200">
        Vytvořit Šablonu Formuláře ze Sledování
    </h1>
    <p class="text-sm text-gray-400 mb-6 text-center">
        Nastavte otázky a frekvence pro generování nové šablony formuláře
        (form.json).
    </p>

    <form id="detailedConfigForm" on:submit={handleSaveConfiguration}>
        <div class="mb-4">
            <label
                for="config-name"
                class="block text-sm font-medium text-gray-300 mb-1"
                >Název Šablony Formuláře:</label
            >
            <input
                id="config-name"
                type="text"
                bind:value={configName}
                required
                disabled={isProcessing}
                class="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-800 text-gray-100"
                placeholder="Např. Standardní onkologické sledování"
            />
        </div>

        <div class="mb-6">
            <label
                for="config-description"
                class="block text-sm font-medium text-gray-300 mb-1"
                >Popis Šablony Formuláře:</label
            >
            <textarea
                id="config-description"
                bind:value={configDescription}
                rows="2"
                disabled={isProcessing}
                class="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-gray-800 text-gray-100"
                placeholder="Popište účel této šablony formuláře..."
            ></textarea>
        </div>

        <h2 class="text-lg font-semibold mb-3 text-gray-200">
            Kategorie a Otázky
        </h2>
        <p class="text-xs text-gray-400 mb-4">
            Zaškrtněte kategorie a otázky, které chcete zahrnout do šablony.
            Frekvenci pro celou kategorii lze nastavit v záhlaví, nebo upravit
            jednotlivé otázky po rozbalení.
        </p>
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
                                    handleCategoryCheckboxChange(e, catIndex)}
                                class="category-checkbox"
                                data-category-id={category.id}
                                disabled={isProcessing}
                                on:click|stopPropagation
                            />
                            <label
                                for="cat_cb_{category.id}"
                                class="category-label text-gray-100"
                                >{category.name}</label
                            >
                        </div>
                        <div
                            class="freq-button-group category-freq-group"
                            class:disabled={!category.enabled || isProcessing}
                            role="group"
                            aria-label="Hromadná frekvence pro {category.name}"
                        >
                            {#each frequencyOptions as opt (opt.value)}
                                <button
                                    type="button"
                                    data-frequency={opt.value}
                                    class:selected={opt.value ===
                                        category.defaultFreq}
                                    disabled={!category.enabled || isProcessing}
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
                                    disabled={!category.enabled || isProcessing}
                                    data-category-id={category.id}
                                    data-question-id={question.id}
                                />
                                <label
                                    for="q_cb_{category.id}_{question.id}"
                                    class="question-label text-gray-300"
                                    >{question.name}</label
                                >
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
                    </div>
                </details>
            {/each}
        </div>

        <div class="mt-6 pt-4 border-t border-gray-700 text-center">
            <div
                id="messageBox"
                class="mb-3 p-2 rounded-md text-sm hidden"
                role="alert"
            ></div>

            <button
                id="saveConfigBtn"
                type="submit"
                disabled={isProcessing}
                class="inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
                {#if isProcessing}
                    Ukládání...
                {:else}
                    Uložit Šablonu Formuláře
                {/if}
            </button>
        </div>
    </form>
</div>

<style lang="postcss">
    /* Base styles */
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

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
        align-items: center;
        flex-grow: 1;
        min-width: 0; /* Prevent flex item from overflowing */
    }
    .category-label {
        margin-left: 0.5rem;
        font-weight: 600;
        cursor: pointer;
        /* Allow label to wrap if needed */
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
        flex-wrap: wrap; /* Allow wrapping on smaller screens */
        align-items: center;
        padding: 0.5rem 0;
        gap: 0.5rem; /* Add gap for better spacing when wrapped */
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
        /* Allow label to wrap */
        overflow-wrap: break-word;
        word-break: break-word;
        hyphens: auto;
        min-width: 100px; /* Ensure label has some minimum width */
    }
    .freq-button-group {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        flex-shrink: 0; /* Prevent shrinking */
    }
    .category-freq-group {
        margin-left: auto; /* Pushes to the right */
    }
    /* Ensure category frequency group doesn't prevent summary click */
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

    /* --- Button Default Dark Styling --- */
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
    /* --- End Button Styling --- */

    .question-row .freq-button-group {
        margin-left: auto; /* Pushes to the right */
        /* Adjust margin for smaller screens if needed */
        @media (max-width: 640px) {
            margin-left: 0; /* Stack below label on small screens */
            width: 100%; /* Take full width */
            justify-content: flex-end; /* Align buttons right */
            padding-left: 2.15rem; /* Indent slightly more than checkbox */
        }
    }
    .question-row.disabled {
        opacity: 0.6;
    }
    .question-row.disabled label,
    .question-row.disabled input,
    .question-row.disabled button {
        cursor: not-allowed;
        pointer-events: none; /* Disable interactions */
    }

    .category-checkbox,
    .question-checkbox {
        height: 1.15rem;
        width: 1.15rem;
        flex-shrink: 0;
        margin-top: 0.125rem; /* Align better with text */
        /* Default dark checkbox styles */
        @apply border-gray-600 bg-gray-700 rounded text-blue-600 focus:ring-blue-600 focus:ring-offset-gray-800 checked:bg-blue-600 checked:border-blue-600;
        cursor: pointer; /* Make checkbox itself clickable */
    }
    .category-checkbox:disabled,
    .question-checkbox:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    /* Default dark summary/details styles */
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
</style>
