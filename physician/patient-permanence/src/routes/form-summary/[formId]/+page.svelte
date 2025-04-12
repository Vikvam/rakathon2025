<script>
    import {
        isProblematic,
        isCritical,
        exportFormSummary,
    } from "$lib/exportForm.js";

    let { data } = $props();
    let formJson = $state(JSON.parse(data.formJson));
    console.log(formJson.formTemplate.questions);
</script>

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
