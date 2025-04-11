<script>
    import { saveForm, generateFormIdFromName } from "$lib/formStore.js";
    import { goto } from "$app/navigation";

    let formName = $state(""); // User-friendly name for the form
    let formJson = $state(
        JSON.stringify(
            {
                name: "", // Will be updated from formName
                version: 1,
                fields: [
                    {
                        id: "example-field",
                        type: "text",
                        label: "Example Field",
                    },
                ],
            },
            null,
            2,
        ),
    ); // Start with a basic template, nicely formatted
    let errorMessage = $state("");
    let isSaving = $state(false);

    async function handleSubmit() {
        errorMessage = "";
        isSaving = true;

        if (!formName.trim()) {
            errorMessage = "Form Name is required.";
            isSaving = false;
            return;
        }

        let parsedJson;
        try {
            parsedJson = JSON.parse(formJson);
        } catch (e) {
            errorMessage = `Invalid JSON: ${e.message}`;
            isSaving = false;
            return;
        }

        // Update the name in the JSON content itself from the input field
        parsedJson.name = formName.trim();
        const updatedJsonString = JSON.stringify(parsedJson, null, 2);
        formJson = updatedJsonString; // Update the textarea content too

        // Generate a filesystem-friendly ID from the name
        const formId = generateFormIdFromName(formName);
        if (!formId) {
            errorMessage = "Could not generate a valid ID from the name.";
            isSaving = false;
            return;
        }

        console.log(`Attempting to save form with ID: ${formId}`);

        const success = await saveForm(formId, updatedJsonString);
        if (success) {
            // Optionally show a success message before redirecting
            console.log("Form saved successfully!");
            goto("/forms"); // Redirect to the list after successful save
        } else {
            errorMessage =
                "Failed to save the form definition. Check console for details.";
        }
        isSaving = false;
    }
</script>

<h1>Create New Form Definition</h1>

<form onsubmit={handleSubmit}>
    <div class="form-group">
        <label for="form-name">Form Name:</label>
        <input
            id="form-name"
            type="text"
            bind:value={formName}
            required
            disabled={isSaving}
        />
        <small>Used to identify the form and generate its file ID.</small>
    </div>

    <div class="form-group">
        <label for="form-json">Form JSON Definition:</label>
        <textarea
            id="form-json"
            bind:value={formJson}
            rows="15"
            required
            disabled={isSaving}
        ></textarea>
    </div>

    {#if errorMessage}
        <p class="error-message">{errorMessage}</p>
    {/if}

    <button type="submit" disabled={isSaving}>
        {#if isSaving}Saving...{:else}Save Form Definition{/if}
    </button>
</form>

<style>
    .form-group {
        margin-bottom: 15px;
    }
    label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
    }
    input[type="text"],
    textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box; /* Include padding and border in element's total width/height */
        font-family: monospace; /* Good for JSON */
    }
    textarea {
        min-height: 200px;
        font-size: 0.9em;
    }
    small {
        display: block;
        font-size: 0.8em;
        color: #666;
        margin-top: 3px;
    }
    .error-message {
        color: red;
        margin-top: 10px;
    }
    button {
        padding: 10px 20px;
        cursor: pointer;
    }
    button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
</style>
