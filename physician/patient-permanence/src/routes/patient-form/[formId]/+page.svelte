<script>
    import { browser } from "$app/environment";
    import { onDestroy } from "svelte"; // Import onDestroy for potential cleanup

    // --- Component Props (Svelte 5) ---
    // Use $props() to get the props passed from the load function.
    // Destructure 'data' from the returned props object.
    let { data } = $props();

    // --- Component State ---
    let formData = $state(null); // Will hold the parsed form structure { name, description, questions, ... }
    let currentQuestionIndex = $state(0);
    let answers = $state({});
    let totalQuestions = $state(0);
    let isReviewing = $state(false);
    let isLoading = $state(true);
    let loadError = $state(null);
    let submissionMessage = $state("");
    let submissionSuccess = $state(false);
    let isSubmitting = $state(false);

    // --- Reactive Derived State ---
    const currentQuestion = $derived(
        formData?.questions?.[currentQuestionIndex],
    );
    const progressPercent = $derived(
        totalQuestions > 0
            ? isReviewing
                ? 100
                : (currentQuestionIndex / totalQuestions) * 100
            : 0,
    );

    // --- Lifecycle / Effects ---
    // Effect to load and parse the form definition when the component mounts or data changes
    $effect(() => {
        isLoading = true;
        loadError = null;
        formData = null; // Reset form data on change
        currentQuestionIndex = 0; // Reset index
        answers = {}; // Reset answers
        totalQuestions = 0;
        isReviewing = false;
        submissionMessage = "";
        submissionSuccess = false;
        isSubmitting = false;

        console.log(`Effect: Loading form for ID: ${data.formId}`);
        console.log("Effect: Received JSON string:", data.formJsonString);

        // Short delay to allow UI update for loading state if needed
        const timer = setTimeout(() => {
            try {
                if (!data.formJsonString) {
                    // This case might be handled by +page.js error, but check again
                    throw new Error("Formulář nebyl nalezen nebo je prázdný.");
                }

                // Parse the JSON string provided by the load function
                const parsedJson = JSON.parse(data.formJsonString).formTemplate;

                // *** IMPORTANT: Adjust based on your actual JSON structure ***
                // Assuming the structure saved by monitoring-config is { formTemplate: { ... } }
                // If your JSON file *is* the formTemplate object directly, use: const loadedForm = parsedJson;
                const loadedForm = parsedJson; // Extract the relevant part

                if (
                    !loadedForm ||
                    !loadedForm.questions ||
                    loadedForm.questions.length === 0
                ) {
                    throw new Error(
                        "Načtená data formuláře jsou neplatná nebo neobsahují otázky.",
                    );
                }

                // Assign the loaded and validated form data to state
                formData = loadedForm;
                totalQuestions = formData.questions.length;
                initializeAnswers(); // Initialize answers based on the loaded form
                isLoading = false;
                console.log(
                    "Effect: Form data loaded and parsed successfully.",
                    formData,
                );
            } catch (error) {
                console.error(
                    "Effect: Chyba při načítání nebo parsování formuláře:",
                    error,
                );
                loadError = `Nepodařilo se načíst nebo zpracovat formulář: ${error.message}`;
                isLoading = false;
            }
        }, 50); // Simulate a tiny delay or handle async parsing if needed

        // Cleanup function for the effect
        return () => {
            clearTimeout(timer);
            console.log(`Effect cleanup for form ID: ${data.formId}`);
        };
    }); // This effect depends on `data.formId` and `data.formJsonString`

    function initializeAnswers() {
        if (!formData || !formData.questions) return;
        const initialAnswers = {};
        formData.questions.forEach((q) => {
            // Use defaultValue if provided, otherwise set sensible defaults
            if (q.defaultValue !== undefined && q.defaultValue !== null) {
                initialAnswers[q.key] = q.defaultValue;
            } else {
                // Set empty string for text/numerical, undefined for choices if no default
                if (q.dataType === "text" || q.dataType === "numerical") {
                    initialAnswers[q.key] = "";
                } else {
                    // For single_choice, multiple_choice etc., start with nothing selected
                    initialAnswers[q.key] = undefined;
                }
            }
        });
        answers = initialAnswers;
        console.log("Initialized answers based on loaded form:", answers);
    }

    // --- Event Handlers (Remain largely the same) ---
    function handleOptionButtonClick(questionKey, value) {
        answers[questionKey] = value;
        console.log(`Answer updated for ${questionKey}:`, value);
        // Optional: Auto-advance on single choice selection
        // if (currentQuestion?.dataType === 'single_choice') {
        //   setTimeout(goToNextQuestion, 150); // Add small delay
        // }
    }

    function saveCurrentAnswer() {
        // No changes needed here - relies on currentQuestion and answers state
        if (!currentQuestion || isReviewing) return;

        const questionKey = currentQuestion.key;
        const dataType = currentQuestion.dataType;

        // Log saving text/numerical as they might be partially filled
        if (dataType === "numerical" || dataType === "text") {
            console.log(
                `Answer saved for ${questionKey}:`,
                answers[questionKey],
            );
        }
        // For single choice, if still undefined when navigating, confirm default (if any)
        else if (
            dataType === "single_choice" &&
            answers[questionKey] === undefined &&
            currentQuestion.defaultValue !== undefined
        ) {
            // This logic might be redundant if initializeAnswers sets defaults correctly
            // answers[questionKey] = currentQuestion.defaultValue;
            // console.log(`Default answer confirmed for ${questionKey}:`, currentQuestion.defaultValue);
        } else {
            console.log(
                `Answer recorded for ${questionKey}:`,
                answers[questionKey],
            );
        }
    }

    function goToNextQuestion() {
        saveCurrentAnswer();
        if (currentQuestionIndex === totalQuestions - 1) {
            isReviewing = true;
            submissionMessage = ""; // Clear previous submission messages
        } else if (currentQuestionIndex < totalQuestions - 1) {
            currentQuestionIndex++;
        }
    }

    function goToPreviousQuestion() {
        // Save answer before going back - important if user changed something
        saveCurrentAnswer();
        if (isReviewing) {
            isReviewing = false; // Exit review mode to the last question
            // currentQuestionIndex remains at the last question index
        } else if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
        }
    }

    function goBackToEdit() {
        isReviewing = false;
        submissionMessage = ""; // Clear potential submission messages
        // currentQuestionIndex remains at the last question index by default
    }

    async function handleFinalSubmit() {
        isSubmitting = true;
        submissionMessage = "";
        submissionSuccess = false;

        // Construct the submission payload
        const submissionData = {
            formTemplateId: formData?.templateId || data.formId, // Use templateId from form or fallback to file ID
            formName: formData?.name || "Neznámý formulář", // Include form name if available
            submissionTimestamp: new Date().toISOString(),
            answers: { ...answers }, // Send a copy of the answers
        };

        console.log("Final Form Submission Payload:", submissionData);

        try {
            // Simulate network request
            await new Promise((resolve) => setTimeout(resolve, 800));

            // --- Placeholder for actual submission logic ---
            // Example: await invoke('submit_patient_form', { formData: submissionData });
            // ----------------------------------------------

            submissionMessage = "Formulář byl úspěšně odeslán!";
            submissionSuccess = true;
            console.log("Submission successful (simulated).");

            // Optionally, navigate away or disable the form after successful submission
            // await goto('/thank-you');
        } catch (error) {
            console.error("Chyba při odesílání formuláře:", error);
            submissionMessage = `Chyba při odesílání: ${error.message || "Neznámá chyba"}`;
            submissionSuccess = false;
        } finally {
            isSubmitting = false;
        }
    }

    function getDisplayAnswer(questionKey) {
        const question = formData?.questions.find((q) => q.key === questionKey);
        const answerValue = answers[questionKey];

        if (
            answerValue === undefined ||
            answerValue === null ||
            answerValue === ""
        ) {
            // Return an HTML STRING, not JSX/HTML syntax
            return '<span class="text-gray-400 italic">Nevyplněno</span>';
        }

        if (question?.dataType === "single_choice") {
            const selectedOption = question.options?.find(
                (opt) => opt.value === answerValue,
            );
            // Return plain text (safer) or the stringified value as fallback
            // Escape HTML entities in text just in case option text contains < or >
            const text = selectedOption
                ? selectedOption.text
                : String(answerValue);
            return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        // Add handling for other types if needed (e.g., multiple_choice arrays)

        // Ensure the final return is also a string and escape basic HTML
        const text = String(answerValue);
        return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- Tailwind Class Strings for Buttons ---
    const baseButtonClasses = $state(
        "px-4 py-2 border rounded-md text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed",
    );
    const unselectedButtonClasses = $state(
        "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    );
    const selectedButtonClasses = $state(
        "bg-blue-600 text-white border-blue-600 shadow-sm hover:bg-blue-700",
    );
    const navButtonClasses = $state(
        "font-semibold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed",
    );
</script>

<div
    class="bg-white p-5 sm:p-6 md:p-8 rounded-lg shadow-lg w-full max-w-lg mx-auto my-4"
>
    {#if isLoading}
        <div class="text-center py-10">
            <svg
                class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3"
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
            <p class="text-center text-gray-600 font-medium">
                Načítání formuláře...
            </p>
        </div>
    {:else if loadError}
        <div
            class="text-center py-10 bg-red-50 border border-red-200 rounded-md p-4"
        >
            <p class="text-lg font-semibold text-red-700 mb-2">
                Chyba při načítání formuláře
            </p>
            <p class="text-red-600">{loadError}</p>
            <a href="/" class="mt-4 inline-block text-blue-600 hover:underline"
                >Zpět na domovskou stránku</a
            >
        </div>
    {:else if formData && !submissionSuccess}
        <!-- Form Title and Description -->
        <h1
            class="text-xl sm:text-2xl font-bold mb-2 text-gray-800 text-center"
        >
            {formData.name || "Formulář"}
        </h1>
        {#if formData.description}
            <p class="text-gray-600 mb-4 text-sm sm:text-base text-center">
                {formData.description}
            </p>
        {/if}

        <!-- Progress Bar -->
        {#if totalQuestions > 0 && !isReviewing}
            <div
                class="progress-indicator text-center text-sm text-gray-500 mb-1"
            >
                Otázka {currentQuestionIndex + 1} z {totalQuestions}
            </div>
        {/if}
        <div class="w-full bg-gray-200 rounded-full h-2.5 mb-5 overflow-hidden">
            <div
                class="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                style="width: {progressPercent}%"
                aria-valuenow={progressPercent}
                aria-valuemin="0"
                aria-valuemax="100"
                role="progressbar"
                aria-label="Průběh vyplňování formuláře"
            ></div>
        </div>

        <!-- Question Display Area -->
        {#if !isReviewing && currentQuestion}
            <div
                class="question-container mb-6 min-h-[150px]"
                aria-live="polite"
            >
                <fieldset class="space-y-3">
                    <legend
                        class="block text-base sm:text-lg font-medium text-gray-800 mb-3"
                        id="q_{currentQuestion.key}_label"
                    >
                        {currentQuestion.text}
                    </legend>

                    {#if currentQuestion.dataType === "single_choice"}
                        <div
                            class="option-button-group flex flex-wrap gap-2 sm:gap-3 mt-2 justify-center"
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
                            class="mt-1 block w-full max-w-xs mx-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-lg disabled:bg-gray-100"
                            min={currentQuestion.inputAttributes?.min}
                            max={currentQuestion.inputAttributes?.max}
                            step={currentQuestion.inputAttributes?.step ?? "1"}
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
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-base disabled:bg-gray-100"
                            bind:value={answers[currentQuestion.key]}
                            aria-labelledby="q_{currentQuestion.key}_label"
                            required={currentQuestion.required ?? false}
                            disabled={isSubmitting}
                        ></textarea>
                        <!-- Add other data types like 'multiple_choice', 'date', etc. here -->
                    {:else}
                        <!-- Fallback for unknown types -->
                        <input
                            type="text"
                            id="q_{currentQuestion.key}"
                            name={currentQuestion.key}
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-base disabled:bg-gray-100"
                            bind:value={answers[currentQuestion.key]}
                            aria-labelledby="q_{currentQuestion.key}_label"
                            disabled={isSubmitting}
                        />
                    {/if}
                </fieldset>
            </div>
        {/if}

        <!-- Review Area -->
        {#if isReviewing}
            <div class="review-container mt-4" aria-live="polite">
                <h2
                    class="text-lg font-semibold text-gray-800 mb-4 text-center"
                >
                    Zkontrolujte své odpovědi
                </h2>
                <div class="overflow-x-auto border border-gray-200 rounded-md">
                    <table class="w-full text-left border-collapse">
                        <thead class="bg-gray-50">
                            <tr>
                                <th
                                    class="p-2 sm:p-3 border-b border-gray-300 text-sm sm:text-base font-semibold text-gray-700"
                                    >Otázka</th
                                >
                                <th
                                    class="p-2 sm:p-3 border-b border-gray-300 text-sm sm:text-base font-semibold text-gray-700"
                                    >Vaše odpověď</th
                                >
                            </tr>
                        </thead>
                        <tbody>
                            {#each formData.questions as question (question.key)}
                                <tr class="hover:bg-gray-50">
                                    <td
                                        class="p-2 sm:p-3 border-b border-gray-200 text-sm sm:text-base font-medium text-gray-600 w-2/5"
                                        >{question.text}</td
                                    >
                                    <td
                                        class="p-2 sm:p-3 border-b border-gray-200 text-sm sm:text-base text-gray-800"
                                        >{@html getDisplayAnswer(
                                            question.key,
                                        )}</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}

        <!-- Submission Message Area -->
        {#if submissionMessage && !submissionSuccess}
            <div
                class="text-center my-4 p-3 rounded-md bg-red-100 border border-red-300 text-sm text-red-700 font-medium"
                role="alert"
                aria-live="assertive"
            >
                {submissionMessage}
            </div>
        {/if}

        <!-- Navigation Buttons -->
        <div
            class="flex justify-between items-center mt-6 pt-5 border-t border-gray-200"
        >
            {#if isReviewing}
                <!-- In Review Mode -->
                <button
                    type="button"
                    class="{navButtonClasses} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-400"
                    on:click={goBackToEdit}
                    disabled={isSubmitting}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5 inline-block mr-1"
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
                            class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block"
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
                        Odesílání...
                    {:else}
                        Odeslat formulář
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 inline-block ml-1"
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
                <!-- In Question Mode -->
                <button
                    type="button"
                    class="{navButtonClasses} bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400"
                    class:invisible={currentQuestionIndex === 0}
                    on:click={goToPreviousQuestion}
                    disabled={isSubmitting}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5 inline-block mr-1"
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
                        class="h-5 w-5 inline-block ml-1"
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
        <!-- Success Message Display -->
        <div class="text-center py-10">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-16 w-16 text-green-500 mx-auto mb-4"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                />
            </svg>
            <h2 class="text-xl font-semibold text-gray-800 mb-2">Hotovo!</h2>
            <p
                class="text-center my-4 text-green-700 font-medium"
                role="alert"
                aria-live="assertive"
            >
                {submissionMessage}
            </p>
            <a
                href="/"
                class="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            >
                Zpět na domovskou stránku
            </a>
        </div>
    {/if}
</div>

<style>
    /* Tailwind handles most styles via classes */
    .invisible {
        visibility: hidden;
    }
    /* Ensure enough space for question content */
    .question-container {
        display: flex;
        flex-direction: column;
        justify-content: center; /* Center content vertically */
    }
    /* Style for un-answered questions */
    .text-gray-400.italic {
        font-style: italic;
        color: #9ca3af; /* Tailwind gray-400 */
    }
</style>
