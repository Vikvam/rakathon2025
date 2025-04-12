<script>
    // Assuming your store is in $lib and exports getConfig, saveConfig
    import { getConfig, saveConfig } from "$lib/configStore.js";
    import {listForms} from "$lib/formStore.js"; // Adjust path as needed

    // --- Svelte 5 State ---
    let config = $state({});         // Holds the loaded config object { user: '...' }
    let editedUsername = $state('');    // Bound to the input field
    let editedEmail = $state('');    // Bound to the input field
    let isLoading = $state(true);       // For initial load indication
    let isSaving = $state(false);       // For save indication/disabling button
    let statusMessage = $state('');     // For success feedback
    let errorMessage = $state('');      // For error feedback

    // Use Svelte 5 runes for reactivity if preferred, otherwise onMount for client-side fetch
    $effect(() => {
        isLoading = true;
        getConfig()
            .then((data) => {
                config = data;
                editedUsername = data.user;
                editedEmail = data.email;
            })
            .catch((err) => {
                console.error("Failed to load forms:", err);
            })
            .finally(() => {
                isLoading = false;
            });
    });

    // --- Save Handler ---
    async function handleSave() {
        // Prevent saving if already saving or something went wrong loading config
        if (isSaving || !config) return;

        isSaving = true;
        statusMessage = '';
        errorMessage = '';

        const updatedConfig = { ...config, user: editedUsername, email: editedEmail };

        try {
            const success = await saveConfig(updatedConfig);

            if (success) {
                // Update the main config state to match the saved data
                config = updatedConfig;
                statusMessage = "Úspěšně uloženo!";
            } else {
                // saveConfig returned false, likely due to FS error logged in the store
                errorMessage = "Failed to save username. Please check logs and try again.";
            }
        } catch (e) {
            // Catch any unexpected errors during the save process
            console.error("Settings Page: Error during saveConfig call:", e);
            errorMessage = "An unexpected error occurred while saving.";
        } finally {
            isSaving = false;
        }
    }
</script>

<svelte:head>
    <title>Edit Settings</title>
</svelte:head>

<div class="settings-page-container">
    {#if isLoading}
        <p>Loading settings...</p>
    {:else}
        <form onsubmit={handleSave} class="settings-form">
            <div class="form-group">
                <label for="username-input">Jméno:</label>
                <input
                        type="text"
                        id="username-input"
                        bind:value={editedUsername}
                        disabled={isSaving}
                        required
                        aria-describedby="status-feedback"
                />
            </div>

            <div class="form-group">
                <label for="email-input">Email:</label>
                <input
                        type="text"
                        id="email-input"
                        bind:value={editedEmail}
                        disabled={isSaving}
                        required
                        aria-describedby="status-feedback"
                />
            </div>

            {#if statusMessage}
                <p id="status-feedback" class="feedback success">{statusMessage}</p>
            {/if}
            {#if errorMessage}
                <p id="status-feedback" class="feedback error">{errorMessage}</p>
            {/if}

            <button type="submit" disabled={isSaving || !editedUsername}>
                {#if isSaving}
                    Ukládám...
                {:else}
                    Uložit
                {/if}
            </button>
        </form>
    {/if}
</div>

<style>
    .settings-page-container {
        font-family: sans-serif;
        max-width: 600px;
        margin: 3rem auto;
        padding: 1.5rem 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        background-color: #fff;
    }

    h1 {
        text-align: center;
        color: #333;
        margin-bottom: 2rem;
    }

    .settings-form {
        display: grid;
        gap: 1.5rem; /* Increased gap */
    }

    .form-group {
        display: flex;
        flex-direction: column; /* Stack label and input vertically */
        gap: 0.5rem; /* Space between label and input */
    }

    label {
        font-weight: 600; /* Slightly bolder */
        color: #555;
    }

    input[type="text"] {
        padding: 0.8rem 1rem; /* Slightly larger padding */
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 1rem;
        transition: border-color 0.2s;
    }

    input[type="text"]:focus {
        border-color: #007bff;
        outline: none;
    }

    input:disabled {
        background-color: #f0f0f0; /* Lighter disabled background */
        cursor: not-allowed;
    }

    button {
        padding: 0.8rem 1.5rem;
        background-color: #28a745; /* Green color for save */
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.2s ease;
        justify-self: start; /* Align button to the left */
    }

    button:hover:not(:disabled) {
        background-color: #218838; /* Darker green on hover */
    }

    button:disabled {
        background-color: #a0a0a0; /* Grey disabled state */
        cursor: not-allowed;
    }

    .feedback {
        text-align: center; /* Center feedback messages */
        margin-top: -0.5rem; /* Adjust position relative to input */
        margin-bottom: 0.5rem;
        font-weight: 500;
    }

    .success {
        color: #28a745; /* Match button green */
    }

    .error {
        color: #dc3545; /* Standard error red */
    }
</style>