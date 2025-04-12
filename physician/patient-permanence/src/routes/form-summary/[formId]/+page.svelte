<script>
    import {
        isProblematic,
        isCritical,
        exportFormSummary,
    } from "$lib/exportForm.js";
    import { goto } from "$app/navigation";

    let { data } = $props();
    let formJson = $state(JSON.parse(data.formJson));
    console.log(formJson.formTemplate.questions);
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

<div>
    <h2>Form Summary (Latest Answers):</h2>
    <p>{exportFormSummary(formJson)}</p>
</div>

<style>
    div {
        margin-top: 20px;
        padding: 15px;
        border: 1px solid #eee;
        border-radius: 5px;
        background-color: #f9f9f9;
    }
    h2 {
        font-size: 1.2em;
        margin-bottom: 10px;
        color: #333;
    }
    p {
        font-family: monospace;
        color: #555;
    }
</style>
