<script>
    import { onMount } from "svelte";
    import { listForms } from "$lib/formStore.js";
    import { goto } from "$app/navigation";

    let forms = $state([]);
    let isLoading = $state(true);
    let error = $state(null);

    // Use Svelte 5 runes for reactivity if preferred, otherwise onMount for client-side fetch
    $effect(() => {
        isLoading = true;
        error = null;
        listForms()
            .then((data) => {
                forms = data;
            })
            .catch((err) => {
                console.error("Failed to load forms:", err);
                error = "Could not load form definitions.";
            })
            .finally(() => {
                isLoading = false;
            });
    });
</script>

{#if isLoading}
<p>Loading form definitions...</p>
{:else if error}
<p style="color: red;">{error}</p>
{:else if forms.length === 0}
<p>No form definitions found. Create one!</p>
{:else}
    <h1>Available Form Definitions</h1>
    <ul>
        {#each forms as form (form.id)}
            <li>
                <a href="/patient-form/{form.id}">
                    {form.name}
                    <br>
                    {form.description || "Bez popisu"}
                </a>
                <a href="/form-edit/{form.id}"> Edit </a>
            </li>
        {/each}
    </ul>
{/if}

<ul>
    <li>
        <a href="/patient-code-input">Zadání kódu od lékaře</a>
    </li>
</ul>


<style>
    ul {
        list-style: none;
        padding: 0;
    }
    li {
        margin-bottom: 10px;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    li a {
        text-decoration: none;
        color: var(
            --color-text,
            #333
        ); /* Use CSS variables if defined globally */
    }
    li a:hover {
        text-decoration: underline;
    }
    button {
        padding: 8px 15px;
        cursor: pointer;
    }
</style>
