<script>
    import { saveForm, deleteForm } from "$lib/formStore.js";
    import { goto } from "$app/navigation";

    // --- Svelte 5 Prop Declaration ---
    // Use $props() to get the props passed from the load function.
    // Destructure 'data' from the returned props object.
    let { data } = $props();

    // --- Svelte 5 State Management ---
    // Initialize reactive state using the 'data' prop obtained via $props().
    let editableJson = $state(data.formJson);
    let errorMessage = $state("");
    let successMessage = $state("");
    let isProcessing = $state(false);

    // --- Effects ---
    // Effect to react to changes in the 'data' prop.
    // This effect runs when the component mounts and whenever 'data.formJson' changes value.
    $effect(() => {
        console.log("Data prop changed via $props(), resetting editableJson");
        editableJson = data.formJson;
        // Reset messages when data source changes
        errorMessage = "";
        successMessage = "";
        isProcessing = false; // Reset processing state too
    });

    // --- Actions ---
    async function handleUpdate() {
        errorMessage = "";
        successMessage = "";
        isProcessing = true;

        let parsedJson;
        try {
            parsedJson = JSON.parse(editableJson);
        } catch (e) {
            errorMessage = `Invalid JSON: ${e.message}`;
            isProcessing = false;
            return;
        }

        const formattedJson = JSON.stringify(parsedJson, null, 2);
        editableJson = formattedJson; // Update the reactive state

        const success = await saveForm(data.formId, formattedJson);
        if (success) {
            successMessage = "Form definition updated successfully!";
            await goto("/forms", { replaceState: true });
            isProcessing = false;
        } else {
            errorMessage = "Failed to update the form definition.";
        }
        isProcessing = false;
    }

    async function handleDelete() {
        if (
            !confirm(
                `Are you sure you want to delete the form "${data.formId}"? This cannot be undone.`,
            )
        ) {
            return;
        }

        errorMessage = "";
        successMessage = "";
        isProcessing = true;

        const success = await deleteForm(data.formId);
        if (success) {
            goto("/forms", { replaceState: true }); // Navigate away
        } else {
            errorMessage =
                "Failed to delete the form definition. Check console.";
            isProcessing = false;
        }
    }
</script>

<!-- Template remains the same -->
<h1>Edit Form Definition: {data.formId}</h1>

<form onsubmit={handleUpdate}>
    <div class="form-group">
        <label for="form-json">Form JSON Definition:</label>
        <textarea
            id="form-json"
            bind:value={editableJson}
            rows="20"
            required
            disabled={isProcessing}
        ></textarea>
    </div>

    {#if successMessage}
        <p class="success-message">{successMessage}</p>
    {/if}
    {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
    {/if}

    <div class="button-group">
        <button type="submit" disabled={isProcessing}>
            {#if isProcessing}Processing...{:else}Update Definition{/if}
        </button>
        <button
            type="button"
            class="delete-button"
            onclick={handleDelete}
            disabled={isProcessing}
        >
            {#if isProcessing}Processing...{:else}Delete Definition{/if}
        </button>
        <a href="/forms" class="cancel-link">Cancel</a>
    </div>
</form>

<style>
    /* Styles remain the same */
    .form-group {
        margin-bottom: 15px;
    }
    label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
    }
    textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
        font-family: monospace; /* Good for JSON */
        min-height: 300px;
        font-size: 0.9em;
    }
    .success-message {
        color: green;
        margin-top: 10px;
        font-weight: bold;
    }
    .error-message {
        color: red;
        margin-top: 10px;
        font-weight: bold;
    }
    .button-group {
        margin-top: 20px;
        display: flex;
        gap: 10px; /* Space between buttons */
        align-items: center;
    }
    button {
        padding: 10px 20px;
        cursor: pointer;
    }
    button.delete-button {
        background-color: #dc3545; /* Red */
        color: white;
        border: none;
    }
    button.delete-button:hover {
        background-color: #c82333;
    }
    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    .cancel-link {
        margin-left: auto; /* Push cancel link to the right */
        color: #007bff;
        text-decoration: none;
    }
    .cancel-link:hover {
        text-decoration: underline;
    }
</style>
