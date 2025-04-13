<script lang="ts">
    import { browser } from "$app/environment";
    import { onDestroy, onMount } from "svelte"; // Import onMount if needed, onDestroy for cleanup
    import { formSaveAnswers, getForm } from "$lib/formStore"; // Assuming this utility exists
    import { getConfig } from "$lib/configStore.js";

    import { goto } from "$app/navigation";
    import { getFormOverallStatus, exportFormSummary } from "$lib/exportForm";

    // --- Component Props (Svelte 5) ---
    let { data } = $props(); // Passed from +page.ts load function

    // --- Component State ---
    let config = $state({});         // Holds the loaded config object { user: '...' }
    let formData = $state<any>(null); // Parsed form structure { name, description, questions, ... }
    let currentQuestionIndex = $state(0);
    let answers = $state<Record<string, any>>({}); // Store answers keyed by question.key
    let totalQuestions = $state(0);
    let isReviewing = $state(false);
    let isLoading = $state(true);
    let loadError = $state<string | null>(null);
    let submissionMessage = $state("");
    let submissionSuccess = $state(false);
    let isSubmitting = $state(false);
    let isAnyAnswerCritical = $state(false);
    let isAnyAnswerProblematic = $state(false);
    let emailContent = $state("");

    // --- Reactive Derived State ---
    // Get the current question object based on the index
    const currentQuestion = $derived(
        formData?.questions?.[currentQuestionIndex],
    );
    // Calculate progress percentage
    const progressPercent = $derived(
        totalQuestions > 0
            ? isReviewing
                ? 100 // Show 100% when reviewing
                : ((currentQuestionIndex + 1) / totalQuestions) * 100 // Calculate based on current question
            : 0,
    );

    // --- Lifecycle / Effects ---
    // Effect to load and parse the form definition when component mounts or data changes
    $effect(() => {
        // Reset state when data changes (e.g., navigating to a different form)
        isLoading = true;
        loadError = null;
        formData = null;
        currentQuestionIndex = 0;
        answers = {};
        totalQuestions = 0;
        isReviewing = false;
        submissionMessage = "";
        submissionSuccess = false;
        isSubmitting = false;

        console.log(`Effect: Loading form for ID: ${data.formId}`);
        console.log("Effect: Received JSON string:", data.formJsonString);

        // Use a minimal timeout to ensure UI updates before potentially heavy parsing
        const timer = setTimeout(() => {
            getConfig()
                .then((data) => {
                    config = data;
                })
                .catch((err) => {
                    console.error("Failed to load forms:", err);
                })
                .finally(() => {
                    isLoading = false;
                });
            try {
                if (!data.formJsonString) {
                    throw new Error("Formulář nebyl nalezen nebo je prázdný.");
                }

                // Parse the JSON string
                // Assuming the structure is { formTemplate: { ... } } as saved previously
                const parsedJson = JSON.parse(data.formJsonString);
                const loadedForm = parsedJson.formTemplate; // Extract the relevant part

                if (!loadedForm?.questions?.length) {
                    throw new Error(
                        "Načtená data formuláře jsou neplatná nebo neobsahují otázky.",
                    );
                }

                // Assign validated form data to state
                formData = loadedForm;
                totalQuestions = formData.questions.length;
                initializeAnswers(); // Set initial answer values
                isLoading = false;
                console.log(
                    "Effect: Form data loaded and parsed successfully.",
                    formData,
                );
            } catch (error: any) {
                console.error(
                    "Effect: Chyba při načítání nebo parsování formuláře:",
                    error,
                );
                loadError = `Nepodařilo se načíst nebo zpracovat formulář: ${error.message}`;
                isLoading = false;
            }
        }, 10); // Minimal delay

        // Cleanup function for the effect
        return () => {
            clearTimeout(timer);
            console.log(`Effect cleanup for form ID: ${data.formId}`);
        };
    }); // Dependency array inferred by Svelte 5

    /** Initializes the answers state based on loaded questions and default values */
    function initializeAnswers() {
        if (!formData?.questions) return;
        const initialAnswers: Record<string, any> = {};
        formData.questions.forEach((q: any) => {
            if (q.defaultValue !== undefined && q.defaultValue !== null) {
                initialAnswers[q.key] = q.defaultValue;
            } else {
                // Set sensible empty defaults based on type
                if (q.dataType === "text" || q.dataType === "numerical") {
                    initialAnswers[q.key] = "";
                } else {
                    // For choices, boolean, etc., start with undefined (nothing selected)
                    initialAnswers[q.key] = undefined;
                }
            }
        });
        answers = initialAnswers;
        console.log("Initialized answers:", answers);
    }

    // --- Event Handlers ---
    /** Handles clicks on single-choice option buttons */
    function handleOptionButtonClick(questionKey: string, value: any) {
        if (isSubmitting) return; // Prevent changes during submission
        answers[questionKey] = value;
        console.log(`Answer updated for ${questionKey}:`, value);
        // Optional: Auto-advance after a short delay for better UX
        // setTimeout(goToNextQuestion, 150);
    }

    /** Saves the answer for the current question (used before navigating) */
    function saveCurrentAnswer() {
        // This function primarily serves as a logging point now,
        // as answers are updated directly via `bind:value` or `handleOptionButtonClick`.
        if (!currentQuestion || isReviewing) return;
        console.log(
            `Answer recorded for ${currentQuestion.key}:`,
            answers[currentQuestion.key],
        );
    }

    /** Navigates to the next question or enters review mode */
    function goToNextQuestion() {
        saveCurrentAnswer();
        if (currentQuestionIndex === totalQuestions - 1) {
            isReviewing = true;
            submissionMessage = ""; // Clear previous submission messages
        } else if (currentQuestionIndex < totalQuestions - 1) {
            currentQuestionIndex++;
        }
    }

    /** Navigates to the previous question or exits review mode */
    function goToPreviousQuestion() {
        saveCurrentAnswer();
        if (isReviewing) {
            isReviewing = false; // Exit review mode back to the last question
        } else if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
        }
    }

    /** Exits review mode to allow editing */
    function goBackToEdit() {
        isReviewing = false;
        submissionMessage = "";
        // Stay on the last question index for immediate editing
    }

    /** Handles the final submission of the form */
    async function handleFinalSubmit() {
        isSubmitting = true;
        submissionMessage = "";
        submissionSuccess = false;

        // Construct the submission payload
        const submissionData = {
            formTemplateId: formData?.templateId || data.formId,
            formName: formData?.name || "Neznámý formulář",
            submissionTimestamp: new Date().toISOString(),
            answers: { ...answers }, // Send a copy
        };

        console.log("Final Form Submission Payload:", submissionData);

        try {
            // Simulate network request - REPLACE WITH ACTUAL SUBMISSION LOGIC
            await new Promise((resolve) => setTimeout(resolve, 800));
            // Example: await invoke('submit_patient_form', { formData: submissionData });
            // --- Save answers using imported function ---
            await formSaveAnswers(data.formId, submissionData.answers);
            // ----------------------------------------------

            const formJson = await getForm(data.formId);
            if (formJson) {
                const form = JSON.parse(formJson);
                const { isProblematic, isCritical } = getFormOverallStatus(form);
                isAnyAnswerProblematic = isProblematic;
                isAnyAnswerCritical = isCritical;
                emailContent = "subject=" + encodeURIComponent(`Formulář ${formData.name} byl odeslán`) + "&body=" + encodeURIComponent(exportFormSummary(form));
            }

            submissionMessage = "Formulář byl úspěšně uložen";
            submissionSuccess = true;
            console.log("Submission successful (simulated & saved).");

            // Optional: Clear form data from storage if needed
            // if (browser) localStorage.removeItem(`formAnswers_${data.formId}`);

            // Optional: Navigate away after success
            // await goto('/thank-you');
        } catch (error: any) {
            console.error("Chyba při odesílání formuláře:", error);
            submissionMessage = `Chyba při odesílání: ${error.message || "Neznámá chyba"}`;
            submissionSuccess = false;
        } finally {
            isSubmitting = false;
        }
    }

    /** Formats the answer for display in the review table */
    function getDisplayAnswer(questionKey: string): string {
        const question = formData?.questions.find(
            (q: any) => q.key === questionKey,
        );
        const answerValue = answers[questionKey];

        // Handle unanswered questions
        if (
            answerValue === undefined ||
            answerValue === null ||
            answerValue === ""
        ) {
            return '<span class="text-gray-400 italic">Nevyplněno</span>'; // Return HTML string
        }

        // Handle single choice - find the option text
        if (question?.dataType === "single_choice") {
            const selectedOption = question.options?.find(
                (opt: any) => opt.value === answerValue,
            );
            const text = selectedOption
                ? selectedOption.text
                : String(answerValue);
            // Basic escaping for safety
            return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        // Add handling for other types like 'multiple_choice' if needed
        // if (question?.dataType === 'multiple_choice' && Array.isArray(answerValue)) {
        //   return answerValue.join(', ');
        // }

        // Default: return the string value, escaped
        const text = String(answerValue);
        return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- Tailwind Class Strings for Buttons (defined once for consistency) ---
    // Base classes for option buttons
    const baseButtonClasses =
        "px-4 py-2 border rounded-md text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed";
    // Classes for unselected option buttons
    const unselectedButtonClasses =
        "bg-white text-gray-700 border-gray-300 hover:bg-gray-50";
    // Classes for selected option buttons
    const selectedButtonClasses =
        "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700";
    // Base classes for navigation buttons
    const navButtonClasses =
        "font-semibold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center text-sm sm:text-base";
</script>

<button
    on:click={() => goto('/forms')}
    class="absolute top-4 left-4 inline-flex items-center rounded-md px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    aria-label="Zpět"
>
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
    <span class="ml-1">Zpět</span>
</button>

<div class="min-h-screen bg-gray-50 p-4 font-sans">
    <div
        class="mx-auto my-4 w-full max-w-lg rounded-lg border border-gray-200 bg-white p-5 shadow-lg sm:p-6 md:p-8"
    >
        {#if isLoading}
            <div class="py-10 text-center">
                <svg
                    class="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600"
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
                <p class="text-center font-medium text-gray-600">
                    Načítání formuláře...
                </p>
            </div>
        {:else if loadError}
            <div
                class="rounded-md border border-red-200 bg-red-50 p-4 py-10 text-center"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="mx-auto mb-3 h-12 w-12 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p class="mb-2 text-lg font-semibold text-red-700">
                    Chyba při načítání formuláře
                </p>
                <p class="text-red-600">{loadError}</p>
                <a
                    href="/forms"
                    class="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
                    >Zpět na domovskou stránku</a
                >
            </div>
        {:else if formData && !submissionSuccess}
            <h1
                class="mb-2 text-center text-xl font-bold text-gray-800 sm:text-2xl"
            >
                {formData.name || "Formulář"}
            </h1>
            {#if formData.description}
                <p class="mb-4 text-center text-sm text-gray-600 sm:text-base">
                    {formData.description}
                </p>
            {/if}

            {#if totalQuestions > 0 && !isReviewing}
                <div
                    class="mb-1 text-center text-xs font-medium text-gray-500 sm:text-sm"
                >
                    Otázka {currentQuestionIndex + 1} / {totalQuestions}
                </div>
            {/if}
            <div
                class="mb-5 h-2.5 w-full overflow-hidden rounded-full bg-gray-200"
            >
                <div
                    class="h-2.5 rounded-full bg-blue-600 transition-all duration-300 ease-in-out"
                    style="width: {progressPercent}%"
                    aria-valuenow={progressPercent}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    role="progressbar"
                    aria-label="Průběh vyplňování formuláře"
                ></div>
            </div>

            {#if !isReviewing && currentQuestion}
                <div
                    class="question-container mb-6 min-h-[150px]"
                    aria-live="polite"
                >
                    <fieldset class="space-y-3">
                        <legend
                            class="mb-3 block text-base font-medium text-gray-800 sm:text-lg"
                            id="q_{currentQuestion.key}_label"
                        >
                            {currentQuestion.text}
                        </legend>

                        {#if currentQuestion.dataType === "single_choice"}
                            <div
                                class="option-button-group mt-2 flex flex-wrap justify-center gap-2 sm:gap-3"
                                role="radiogroup"
                                aria-labelledby="q_{currentQuestion.key}_label"
                            >
                                {#each currentQuestion.options as option (option.value)}
                                    <button
                                        type="button"
                                        class="{baseButtonClasses} {answers[
                                            currentQuestion.key
                                        ] === option.value
                                            ? selectedButtonClasses
                                            : unselectedButtonClasses}"
                                        aria-checked={answers[
                                            currentQuestion.key
                                        ] === option.value}
                                        role="radio"
                                        on:click={() =>
                                            handleOptionButtonClick(
                                                currentQuestion.key,
                                                option.value,
                                            )}
                                        disabled={isSubmitting}
                                    >
                                        {option.text}
                                    </button>
                                {/each}
                            </div>
                        {:else if currentQuestion.dataType === "numerical"}
                            <input
                                type="number"
                                id="q_{currentQuestion.key}"
                                name={currentQuestion.key}
                                class="mx-auto mt-1 block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-center shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 sm:text-lg"
                                min={currentQuestion.inputAttributes?.min}
                                max={currentQuestion.inputAttributes?.max}
                                step={currentQuestion.inputAttributes?.step ??
                                    "1"}
                                bind:value={answers[currentQuestion.key]}
                                aria-labelledby="q_{currentQuestion.key}_label"
                                required={currentQuestion.required ?? false}
                                disabled={isSubmitting}
                            />
                        {:else if currentQuestion.dataType === "text"}
                            <textarea
                                id="q_{currentQuestion.key}"
                                name={currentQuestion.key}
                                rows="4"
                                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 sm:text-base"
                                bind:value={answers[currentQuestion.key]}
                                aria-labelledby="q_{currentQuestion.key}_label"
                                required={currentQuestion.required ?? false}
                                disabled={isSubmitting}
                            ></textarea>
                        {:else}
                            <input
                                type="text"
                                id="q_{currentQuestion.key}"
                                name={currentQuestion.key}
                                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 sm:text-base"
                                bind:value={answers[currentQuestion.key]}
                                aria-labelledby="q_{currentQuestion.key}_label"
                                disabled={isSubmitting}
                            />
                        {/if}
                    </fieldset>
                </div>
            {/if}

            {#if isReviewing}
                <div class="review-container mt-4" aria-live="polite">
                    <h2
                        class="mb-4 text-center text-lg font-semibold text-gray-800"
                    >
                        Zkontrolujte své odpovědi
                    </h2>
                    <div
                        class="overflow-x-auto rounded-md border border-gray-200"
                    >
                        <table class="w-full border-collapse text-left">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th
                                        class="border-b border-gray-300 p-2 text-xs font-semibold uppercase text-gray-600 sm:p-3 sm:text-sm"
                                        >Otázka</th
                                    >
                                    <th
                                        class="border-b border-gray-300 p-2 text-xs font-semibold uppercase text-gray-600 sm:p-3 sm:text-sm"
                                        >Vaše odpověď</th
                                    >
                                </tr>
                            </thead>
                            <tbody>
                                {#each formData.questions as question (question.key)}
                                    <tr class="hover:bg-gray-50">
                                        <td
                                            class="w-2/5 border-b border-gray-200 p-2 text-sm font-medium text-gray-600 sm:p-3 sm:text-base"
                                            >{question.text}</td
                                        >
                                        <td
                                            class="border-b border-gray-200 p-2 text-sm text-gray-800 sm:p-3 sm:text-base"
                                        >
                                            {@html getDisplayAnswer(
                                                question.key,
                                            )}
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                </div>
            {/if}

            {#if submissionMessage && !submissionSuccess}
                <div
                    class="my-4 rounded-md border border-red-300 bg-red-100 p-3 text-center text-sm font-medium text-red-700"
                    role="alert"
                    aria-live="assertive"
                >
                    {submissionMessage}
                </div>
            {/if}

            <div
                class="mt-6 flex items-center justify-between border-t border-gray-200 pt-5"
            >
                {#if isReviewing}
                    <button
                        type="button"
                        class="{navButtonClasses} bg-gray-500 hover:bg-gray-600 text-white focus:ring-gray-400"
                        on:click={goBackToEdit}
                        disabled={isSubmitting}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="mr-1 inline-block h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clip-rule="evenodd"
                            />
                        </svg>
                        Upravit
                    </button>
                    <button
                        type="button"
                        class="{navButtonClasses} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500"
                        on:click={handleFinalSubmit}
                        disabled={isSubmitting}
                    >
                        {#if isSubmitting}
                            <svg
                                class="mr-2 inline-block h-5 w-5 animate-spin text-white"
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
                            Ukládání...
                        {:else}
                            Uložit formulář
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="ml-1 inline-block h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fill-rule="evenodd"
                                    d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                                    clip-rule="evenodd"
                                />
                            </svg>
                        {/if}
                    </button>
                {:else}
                    <button
                        type="button"
                        class="{navButtonClasses} bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400"
                        class:invisible={currentQuestionIndex === 0}
                        on:click={goToPreviousQuestion}
                        disabled={isSubmitting}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="mr-1 inline-block h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clip-rule="evenodd"
                            />
                        </svg>
                        Předchozí
                    </button>
                    <button
                        type="button"
                        class="{navButtonClasses} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500"
                        on:click={goToNextQuestion}
                        disabled={isSubmitting}
                    >
                        {currentQuestionIndex === totalQuestions - 1
                            ? "Zkontrolovat odpovědi"
                            : "Další"}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="ml-1 inline-block h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </button>
                {/if}
            </div>
        {:else if formData && submissionSuccess}
            <div class="py-10 text-center">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="mx-auto mb-4 h-16 w-16 text-green-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clip-rule="evenodd"
                    />
                </svg>
                <h2 class="mb-2 text-xl font-semibold text-gray-800">
                    Hotovo!
                </h2>
                <p
                    class="my-4 text-center font-medium text-green-700"
                    role="alert"
                    aria-live="assertive"
                >
                    {submissionMessage}
                </p>

                {#if isAnyAnswerCritical}
                    <p>Tyto informace vašeho lékaře zajímají. Prosím, odešlete mu e-mail.</p>
                    <a
                        href="mailto:info@example.com?{emailContent}"
                        target="_blank"
                        class="mt-6 inline-block rounded-md bg-yellow-600 py-2 px-5 font-semibold text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                    >
                        Odeslat E-mail
                    </a>
                    <br>
                {/if}
                <a
                    href="/forms"
                    class="mt-6 inline-block rounded-md bg-blue-600 py-2 px-5 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Zpět na domovskou stránku
                </a>
            </div>
        {/if}
    </div>
</div>

<style lang="postcss">
    /* Import Tailwind base, components, utilities */
    @reference "../../../app.css";
    @reference tailwindcss;

    /* Minimal custom styles if needed */
    .question-container {
        display: flex;
        flex-direction: column;
        justify-content: center; /* Center content vertically if needed */
    }
    /* Style for un-answered questions in review table */
    .text-gray-400.italic {
        @apply text-gray-400 italic; /* Ensure Tailwind applies */
    }
    /* Hide previous button visually but keep in layout */
    .invisible {
        visibility: hidden;
    }
</style>
