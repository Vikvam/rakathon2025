<script>
    import {getForms, listForms} from "$lib/formStore.js";

    let forms = $state([]);
    let isLoading = $state(true);
    let error = $state(null);

    // Use Svelte 5 runes for reactivity if preferred, otherwise onMount for client-side fetch
    $effect(() => {
        isLoading = true;
        error = null;
        getForms()
            .then((data) => {
                forms = data;
            })
            .catch((err) => {
                console.error("Failed to load forms:", err);
                error = "Nepodařilo se načíst dotazníky.";
            })
            .finally(() => {
                isLoading = false;
            });
    });
</script>

{#if isLoading}
<p>Načítám dotazníky...</p>
{:else if error}
<p style="color: red;">{error}</p>
{:else if forms.length === 0}
<p>Zatím nemáte žádné dotazníky, obdržíte je od lékaře</p>
{:else}
    <h1 class="mb-6 text-center text-2xl font-bold text-gray-800">Aktuální dotazníky</h1>
    <div class="w-full max-w-md mx-auto rounded-lg border border-gray-200 bg-white p-6 shadow-md">
        <ul>
            {#each forms as form (form.templateId)}
                <li>
                    <a href="/patient-form/{form.templateId}" class="block mb-2">
                        <span class="font-medium">{form.name}</span>
                        <br>
                        <span class="text-sm text-gray-600">{form.description || "Bez popisu"}</span>
                    </a>
                    <a href="/form-edit/{form.id}" class="text-blue-600 hover:underline"> Edit </a>
                    <a href="/form-summary/{form.id}" class="text-blue-600 hover:underline"> Shrnutí </a>
                </li>
            {/each}
        </ul>
    </div>
{/if}

<a href="/patient-code-input" class="code-input-button w-full max-w-md mx-auto mt-6 block rounded-lg bg-blue-600 text-white text-center py-4 px-6 shadow-md hover:bg-blue-700 transition-colors">
    Zadání kódu od lékaře
</a>

<style>
    ul {
        list-style: none;
        padding: 0;
    }
    li {
        margin-bottom: 10px;
        padding: 15px;
        border: 1px solid #ccc;
        border-radius: 8px;
        background-color: #f9f9f9;
        transition: all 0.2s ease;
    }
    li:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        transform: translateY(-2px);
    }
    li a {
        text-decoration: none;
        color: var(--color-text, #333);
    }
    button {
        padding: 8px 15px;
        cursor: pointer;
    }
    .code-input-button {
        font-weight: 500;
        text-decoration: none;
    }
    .code-input-button:hover {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
</style>
