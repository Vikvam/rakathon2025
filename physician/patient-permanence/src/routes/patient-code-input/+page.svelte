<script lang="ts">
    import { goto } from "$app/navigation";
    import { saveForm } from "$lib/formStore"; // Assuming this utility exists

    let code = "";
    let status: "idle" | "submitting" | "error" | "success" = "idle";
    let error = "";

    async function submitCode() {
        if (!code || code.length !== 6) {
            error = "Prosím zadejte platný 6místný kód"; // Updated error message
            status = "error";
            return;
        }

        status = "submitting";
        error = "";

        try {
            // API endpoint for patient session query
            const response = await fetch(
                "https://rakathon-proxy.manakjiri.cz/patient",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message_type: "patient_session_query",
                        code: parseInt(code), // Send code as number
                    }),
                },
            );

            if (!response.ok) {
                // Handle non-successful HTTP responses
                let serverError = `Server odpověděl chybou: ${response.status}`;
                try {
                    // Try to get more specific error from response body
                    const errorData = await response.json();
                    serverError =
                        errorData.message || errorData.error || serverError;
                } catch (e) {
                    // Ignore if response body is not JSON or empty
                }
                throw new Error(serverError);
            }

            const data = await response.json();

            // Check for expected response type
            if (
                data.message_type === "patient_session_response" &&
                data.data?.formTemplate
            ) {
                status = "success";
                let formId = data.data.formTemplate.templateId;

                // Save the received form data (assuming saveForm handles potential errors)
                await saveForm(formId, JSON.stringify(data.data));

                // Redirect after a short delay
                setTimeout(() => {
                    goto("/forms");
                }, 1000);
            } else {
                // Handle unexpected response structure
                throw new Error("Neočekávaná odpověď ze serveru.");
            }
        } catch (err: unknown) {
            console.error("Error connecting to doctor session:", err);
            status = "error";
            // Set user-friendly error message
            error =
                err instanceof Error
                    ? err.message
                    : "Nepodařilo se připojit k lékaři. Zkontrolujte kód a zkuste to znovu.";
        }
    }

    function handleInput(event: Event) {
        // Ensure only numbers are entered and limit length
        const input = event.target as HTMLInputElement;
        // Keep only digits 0-9 and limit to 6 characters
        code = input.value.replace(/[^0-9]/g, "").slice(0, 6);
        // Update the input value directly to reflect sanitized code
        input.value = code;
    }
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

<div
    class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 font-sans"
>
    <div
        class="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-md md:p-8"
    >
        <h1 class="mb-6 text-center text-2xl font-bold text-gray-800">
            Stáhnout dotazníky od lékaře
        </h1>

        <div class="mb-4">
            <label
                for="code-input"
                class="mb-2 block text-sm font-medium text-gray-700"
                >Zadejte 6místný kód od Vašeho lékaře:</label
            >
            <input
                id="code-input"
                type="text"
                inputmode="numeric"
                bind:value={code}
                on:input={handleInput}
                placeholder="- - - - - -"
                maxlength="6"
                disabled={status === "submitting" || status === "success"}
                class="block w-full rounded-md border border-gray-300 px-3 py-3 text-center text-2xl font-mono tracking-[0.5em] shadow-sm placeholder:tracking-normal placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 sm:text-3xl"
            />
        </div>

        <button
            on:click={submitCode}
            disabled={code.length !== 6 ||
                status === "submitting" ||
                status === "success"}
            class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {#if status === "submitting"}
                <svg
                    class="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
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
                Stahování...
            {:else}
                Potvrdit
            {/if}
        </button>

        {#if status === "error"}
            <div
                class="mt-4 rounded-md border border-red-300 bg-red-100 p-3 text-center text-sm text-red-700"
                role="alert"
            >
                {error}
            </div>
        {:else if status === "success"}
            <div
                class="mt-4 rounded-md border border-green-300 bg-green-100 p-3 text-center text-sm text-green-800"
                role="status"
            >
                Dotazníky byly úspěšně staženy.
            </div>
        {/if}
    </div>
</div>
