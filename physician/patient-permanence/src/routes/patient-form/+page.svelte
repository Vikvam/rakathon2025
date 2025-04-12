<script>
    import { browser } from "$app/environment";
    import { onMount } from "svelte"; // Or use $effect
    import { page } from "$app/stores";

    // --- Default Form Data ---
    const defaultFormData = $state({
        templateId: "DEFAULT_ONCO_SURVEY_V1",
        name: "Denní Kontrola Příznaků",
        description:
            "Odpovězte prosím na následující otázky ohledně Vašeho dnešního stavu.",
        questions: [
            {
                key: "fatigue_severe",
                text: "Cítíte se výrazně unavenější než obvykle?",
                dataType: "single_choice",
                options: [
                    { value: "yes", text: "Ano" },
                    { value: "no", text: "Ne" },
                ],
                defaultValue: "no",
                problematicValues: ["yes"],
                criticalValues: [],
                timeParameterization: { scheduleId: "SCHED_DAILY_AUTO" },
            },
            {
                key: "neuro_headache",
                text: "Máte bolesti hlavy, závratě nebo problémy s rovnováhou?",
                dataType: "single_choice",
                options: [
                    { value: "yes", text: "Ano" },
                    { value: "no", text: "Ne" },
                ],
                defaultValue: "no",
                problematicValues: ["yes"],
                criticalValues: [],
                timeParameterization: { scheduleId: "SCHED_DAILY_AUTO" },
            },
            {
                key: "pain_level",
                text: "Na stupnici od 0 (žádná bolest) do 10 (nesnesitelná bolest), jaká je Vaše současná úroveň bolesti?",
                dataType: "numerical",
                problematicValues: { range: { min: 5, max: 10 } },
                criticalValues: { range: { min: 8, max: 10 } },
                timeParameterization: { scheduleId: "SCHED_DAILY_AUTO" },
                inputAttributes: { min: "0", max: "10", step: "1" },
            },
            {
                key: "mood_today",
                text: "Jaká je Vaše celková nálada dnes?",
                dataType: "single_choice",
                options: [
                    { value: "good", text: "Dobrá" },
                    { value: "neutral", text: "Neutrální" },
                    { value: "bad", text: "Špatná" },
                ],
                defaultValue: "neutral",
                problematicValues: ["bad"],
                criticalValues: [],
                timeParameterization: { scheduleId: "SCHED_DAILY_AUTO" },
            },
        ],
    });

    // --- Component State ---
    let formData = $state(null);
    let currentQuestionIndex = $state(0);
    let answers = $state({});
    let totalQuestions = $state(0);
    let isReviewing = $state(false);
    let isLoading = $state(true);
    let loadError = $state(null);
    let submissionMessage = $state("");
    let submissionSuccess = $state(false);
    let isSubmitting = $state(false);
    let doctorSessionData = $state(null);

    // --- Reactive Derived State ---
    const currentQuestion = $derived(
        formData?.questions?.[currentQuestionIndex],
    );
    // **FIX:** Calculate progressPercent using $derived
    const progressPercent = $derived(
        totalQuestions > 0
            ? isReviewing
                ? 100
                : (currentQuestionIndex / totalQuestions) * 100
            : 0,
    );

    // --- Lifecycle / Effects ---
    $effect(() => {
        isLoading = true;
        loadError = null;
        console.log("Effect: Loading form data...");
        const timer = setTimeout(() => {
            try {
                // Check if we have doctor session data from navigation state
                if (browser && window.history.state?.formData) {
                    doctorSessionData = window.history.state.formData;
                    console.log("Doctor session data received:", doctorSessionData);
                }
                
                if (
                    !defaultFormData ||
                    !defaultFormData.questions ||
                    defaultFormData.questions.length === 0
                ) {
                    throw new Error("Načtená data formuláře jsou neplatná.");
                }
                formData = defaultFormData;
                totalQuestions = formData.questions.length;
                initializeAnswers();
                isLoading = false;
                console.log("Effect: Form data loaded.", formData);
            } catch (error) {
                console.error("Effect: Chyba při načítání formuláře:", error);
                loadError =
                    error.message || "Nepodařilo se načíst definici formuláře.";
                isLoading = false;
            }
        }, 50);
        return () => clearTimeout(timer);
    });

    function initializeAnswers() {
        /* ... remains the same ... */
        if (!formData || !formData.questions) return;
        const initialAnswers = {};
        formData.questions.forEach((q) => {
            if (q.defaultValue !== undefined) {
                initialAnswers[q.key] = q.defaultValue;
            } else {
                if (q.dataType === "text" || q.dataType === "numerical") {
                    initialAnswers[q.key] = "";
                } else {
                    initialAnswers[q.key] = undefined;
                }
            }
        });
        answers = initialAnswers;
        console.log("Initialized answers:", answers);
    }

    // --- Event Handlers ---
    function handleOptionButtonClick(questionKey, value) {
        /* ... remains the same ... */
        answers[questionKey] = value;
        console.log(`Answer updated for ${questionKey}:`, value);
    }

    function saveCurrentAnswer() {
        /* ... remains the same ... */
        if (!currentQuestion || isReviewing) return;

        const questionKey = currentQuestion.key;
        const dataType = currentQuestion.dataType;

        if (dataType === "numerical" || dataType === "text") {
            console.log(
                `Answer saved for ${questionKey}:`,
                answers[questionKey],
            );
        } else if (
            dataType === "single_choice" &&
            answers[questionKey] === undefined
        ) {
            answers[questionKey] = currentQuestion.defaultValue;
            console.log(
                `Default answer confirmed for ${questionKey}:`,
                currentQuestion.defaultValue,
            );
        }
    }

    function goToNextQuestion() {
        /* ... remains the same ... */
        saveCurrentAnswer();
        if (currentQuestionIndex === totalQuestions - 1) {
            isReviewing = true;
            submissionMessage = "";
        } else if (currentQuestionIndex < totalQuestions - 1) {
            currentQuestionIndex++;
        }
    }

    function goToPreviousQuestion() {
        /* ... remains the same ... */
        saveCurrentAnswer();
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
        }
    }

    function goBackToEdit() {
        /* ... remains the same ... */
        isReviewing = false;
        submissionMessage = "";
    }

    async function handleFinalSubmit() {
        isSubmitting = true;
        submissionMessage = "";
        submissionSuccess = false;

        const submissionData = {
            formTemplateId: formData.templateId,
            timestamp: new Date().toISOString(),
            answers: { ...answers },
            doctorSessionData: doctorSessionData // Include the doctor session data if available
        };

        console.log("Form Submitted:", submissionData);

        try {
            await new Promise((resolve) => setTimeout(resolve, 500));
            submissionMessage = "Formulář byl úspěšně odeslán!";
            submissionSuccess = true;
            console.log("Submission successful (simulated).");
        } catch (error) {
            console.error("Chyba při odesílání formuláře:", error);
            submissionMessage = `Chyba při odesílání: ${error.message || "Neznámá chyba"}`;
            submissionSuccess = false;
        } finally {
            isSubmitting = false;
        }
    }

    function getDisplayAnswer(questionKey) {
        /* ... remains the same ... */
        const question = formData?.questions.find((q) => q.key === questionKey);
        const answerValue = answers[questionKey];

        if (
            answerValue === undefined ||
            answerValue === null ||
            answerValue === ""
        ) {
            return "-";
        }

        if (question?.dataType === "single_choice") {
            const selectedOption = question.options.find(
                (opt) => opt.value === answerValue,
            );
            return selectedOption ? selectedOption.text : answerValue;
        }

        return answerValue;
    }

    // --- Tailwind Class Strings for Buttons ---
    const baseButtonClasses = $state(
        "px-4 py-2 border rounded-md text-sm sm:text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition duration-150 ease-in-out",
    );
    const unselectedButtonClasses = $state(
        "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    );
    const selectedButtonClasses = $state(
        "bg-blue-600 text-white border-blue-600 shadow-sm",
    );
</script>

<div
    class="bg-white p-5 sm:p-6 md:p-8 rounded-lg shadow-lg w-full max-w-lg mx-auto"
>
    {#if isLoading}
        <p class="text-center text-gray-600">Načítání formuláře...</p>
    {:else if loadError}
        <p class="text-center text-red-600">Chyba: {loadError}</p>
    {:else if formData}
        <h1
            class="text-xl sm:text-2xl font-bold mb-2 text-gray-800 text-center"
        >
            {formData.name}
        </h1>
        <p class="text-gray-600 mb-4 text-sm sm:text-base text-center">
            {formData.description}
        </p>

        {#if !isReviewing && !submissionSuccess}
            <div class="progress-indicator">
                Otázka {currentQuestionIndex + 1} z {totalQuestions}
            </div>
            <div
                class="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden"
            >
                <div
                    class="bg-blue-600 h-2.5 rounded-full transition-width duration-300 ease-in-out"
                    style="width: {progressPercent}%"
                ></div>
            </div>
        {:else if isReviewing && !submissionSuccess}
            <div
                class="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden"
            >
                <div
                    class="bg-blue-600 h-2.5 rounded-full transition-width duration-300 ease-in-out"
                    style="width: 100%"
                ></div>
            </div>
        {/if}

        {#if !isReviewing && currentQuestion}
            <div class="question-container mb-4">
                <div class="space-y-3">
                    <label
                        class="block text-base font-medium text-gray-800 mb-3"
                        for="q_{currentQuestion.key}"
                    >
                        {currentQuestion.text}
                    </label>

                    {#if currentQuestion.dataType === "single_choice"}
                        <div
                            class="option-button-group flex flex-wrap gap-2 mt-2 justify-center"
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
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-lg"
                            min={currentQuestion.inputAttributes?.min}
                            max={currentQuestion.inputAttributes?.max}
                            step={currentQuestion.inputAttributes?.step}
                            bind:value={answers[currentQuestion.key]}
                        />
                    {:else if currentQuestion.dataType === "text"}
                        <textarea
                            id="q_{currentQuestion.key}"
                            name={currentQuestion.key}
                            rows="4"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-lg"
                            bind:value={answers[currentQuestion.key]}
                        ></textarea>
                    {:else}
                        <input
                            type="text"
                            id="q_{currentQuestion.key}"
                            name={currentQuestion.key}
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-lg"
                            bind:value={answers[currentQuestion.key]}
                        />
                    {/if}
                </div>
            </div>
        {/if}

        {#if isReviewing}
            <div class="review-container mt-4">
                <h2
                    class="text-lg font-semibold text-gray-800 mb-3 text-center"
                >
                    Zkontrolujte své odpovědi
                </h2>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse mt-4">
                        <thead>
                            <tr>
                                <th
                                    class="p-2 border border-gray-300 text-sm sm:text-base bg-gray-100 font-semibold text-gray-700"
                                    >Otázka</th
                                >
                                <th
                                    class="p-2 border border-gray-300 text-sm sm:text-base bg-gray-100 font-semibold text-gray-700"
                                    >Vaše odpověď</th
                                >
                            </tr>
                        </thead>
                        <tbody>
                            {#each formData.questions as question (question.key)}
                                <tr>
                                    <td
                                        class="p-2 border border-gray-300 text-sm sm:text-base font-medium text-gray-600 w-2/5"
                                        >{question.text}</td
                                    >
                                    <td
                                        class="p-2 border border-gray-300 text-sm sm:text-base text-gray-800"
                                        >{getDisplayAnswer(question.key)}</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}

        {#if submissionMessage}
            <div
                class="text-center my-4 text-sm"
                class:text-green-600={submissionSuccess}
                class:text-red-600={!submissionSuccess}
                class:font-semibold={submissionSuccess || !submissionSuccess}
                aria-live="polite"
            >
                {submissionMessage}
            </div>
        {/if}

        {#if !submissionSuccess}
            <div
                class="flex justify-between items-center mt-6 pt-5 border-t border-gray-200"
            >
                {#if isReviewing}
                    <button
                        type="button"
                        class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 transition duration-150 ease-in-out"
                        on:click={goBackToEdit}
                        disabled={isSubmitting}
                    >
                        Zpět na úpravy
                    </button>
                    <button
                        type="button"
                        class="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out disabled:opacity-50"
                        on:click={handleFinalSubmit}
                        disabled={isSubmitting}
                    >
                        {#if isSubmitting}Odesílání...{:else}Odeslat formulář{/if}
                    </button>
                {:else}
                    <button
                        type="button"
                        class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-150 ease-in-out"
                        class:invisible={currentQuestionIndex === 0}
                        on:click={goToPreviousQuestion}
                    >
                        Předchozí
                    </button>
                    <button
                        type="button"
                        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                        on:click={goToNextQuestion}
                    >
                        {currentQuestionIndex === totalQuestions - 1
                            ? "Zkontrolovat odpovědi"
                            : "Další"}
                    </button>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    /* Minimal styles needed as Tailwind handles most */
    .question-container {
        min-height: 150px;
        padding-bottom: 1rem;
        display: flex;
        flex-direction: column;
    }
    .invisible {
        visibility: hidden;
    }
</style>
