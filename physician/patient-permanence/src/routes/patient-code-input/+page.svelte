<script lang="ts">
    import { goto } from "$app/navigation";
    import { saveForm } from "$lib/formStore";

    let code = "";
    let status: "idle" | "submitting" | "error" | "success" = "idle";
    let error = "";

    async function submitCode() {
        if (!code || code.length !== 6) {
            error = "Please enter a valid 6-digit code";
            status = "error";
            return;
        }

        status = "submitting";
        error = "";

        try {
            const response = await fetch(
                "https://rakathon-proxy.manakjiri.cz/patient",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message_type: "patient_session_query",
                        code: parseInt(code),
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(
                    `Server responded with status: ${response.status}`,
                );
            }

            const data = await response.json();

            if (data.message_type === "patient_session_response") {
                status = "success";
                // Redirect to patient form page with the data
                let formId = data.data.formTemplate.templateId;
                const success = await saveForm(
                    formId,
                    JSON.stringify(data.data),
                );
                setTimeout(() => {
                    goto("/patient-form/" + formId);
                }, 1000);
            } else {
                throw new Error("Unexpected response from server");
            }
        } catch (err: unknown) {
            console.error("Error connecting to doctor session:", err);
            status = "error";
            error =
                err instanceof Error
                    ? err.message
                    : "Failed to connect to doctor. Please check the code and try again.";
        }
    }

    function handleInput(event: Event) {
        // Ensure only numbers are entered
        const input = event.target as HTMLInputElement;
        code = input.value.replace(/[^0-9]/g, "").slice(0, 6);
    }
</script>

<div class="container">
    <h1>Connect to Your Doctor</h1>

    <div class="input-container">
        <label for="code-input"
            >Enter the 6-digit code provided by your doctor:</label
        >
        <input
            id="code-input"
            type="text"
            bind:value={code}
            on:input={handleInput}
            placeholder="123456"
            maxlength="6"
            disabled={status === "submitting" || status === "success"}
        />

        <button
            on:click={submitCode}
            disabled={code.length !== 6 ||
                status === "submitting" ||
                status === "success"}
        >
            {#if status === "submitting"}
                Connecting...
            {:else}
                Connect
            {/if}
        </button>
    </div>

    {#if status === "error"}
        <div class="error">
            {error}
        </div>
    {:else if status === "success"}
        <div class="success">
            Connection successful! Redirecting to your form...
        </div>
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 1rem;
    }

    h1 {
        margin-bottom: 2rem;
        color: #333;
    }

    .input-container {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 400px;
    }

    label {
        margin-bottom: 0.5rem;
    }

    input {
        padding: 1rem;
        font-size: 1.5rem;
        text-align: center;
        letter-spacing: 0.25rem;
        margin-bottom: 1rem;
        border: 2px solid #ddd;
        border-radius: 4px;
    }

    input:focus {
        outline: none;
        border-color: #3498db;
    }

    button {
        padding: 0.75rem 1rem;
        background-color: #3498db;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
    }

    button:hover:not(:disabled) {
        background-color: #2980b9;
    }

    button:disabled {
        background-color: #95a5a6;
        cursor: not-allowed;
    }

    .error {
        margin-top: 1rem;
        color: #e74c3c;
        text-align: center;
    }

    .success {
        margin-top: 1rem;
        color: #2ecc71;
        text-align: center;
    }
</style>
