<script>
    import { invoke } from "@tauri-apps/api/core";

    let name = $state("");
    let greetMsg = $state("");

    async function greet(event) {
        event.preventDefault();
        // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
        greetMsg = await invoke("greet", { name });
    }
</script>

<main
    class="container mx-auto flex flex-col items-center justify-center px-4 py-10 text-center"
>
    <h1 class="mb-6 text-3xl font-bold text-gray-800">
        Vítejte v Tauri + SvelteKit
    </h1>

    <div class="mb-4 flex justify-center space-x-4">
        <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">
            <img
                src="/vite.svg"
                class="h-16 w-16 p-2 transition duration-300 ease-in-out hover:drop-shadow-[0_0_2em_#747bff]"
                alt="Vite Logo"
            />
        </a>
        <a href="https://tauri.app" target="_blank" rel="noopener noreferrer">
            <img
                src="/tauri.svg"
                class="h-16 w-16 p-2 transition duration-300 ease-in-out hover:drop-shadow-[0_0_2em_#24c8db]"
                alt="Tauri Logo"
            />
        </a>
        <a
            href="https://kit.svelte.dev"
            target="_blank"
            rel="noopener noreferrer"
        >
            <img
                src="/svelte.svg"
                class="h-16 w-16 p-2 transition duration-300 ease-in-out hover:drop-shadow-[0_0_2em_#ff3e00]"
                alt="SvelteKit Logo"
            />
        </a>
    </div>
    <p class="mb-8 text-gray-600">
        Klikněte na loga Tauri, Vite a SvelteKit pro více informací.
    </p>

    <form
        class="flex w-full max-w-sm items-center justify-center space-x-2"
        onsubmit={greet}
    >
        <input
            id="greet-input"
            class="input-base flex-grow"
            placeholder="Zadejte jméno..."
            bind:value={name}
        />
        <button type="submit" class="btn btn-primary"> Pozdravit </button>
    </form>

    {#if greetMsg}
        <p class="mt-6 rounded bg-blue-100 p-3 text-blue-800">{greetMsg}</p>
    {/if}
</main>
