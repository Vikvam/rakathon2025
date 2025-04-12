<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment"; // Import browser check
    import { goto } from "$app/navigation"; // Import goto for navigation

    let ws: WebSocket | null = null; // WebSocket instance
    let code = ""; // 6-digit code for patient connection
    let status:
        | "initializing"
        | "connected"
        | "waiting"
        | "success"
        | "error"
        | "no_config" = "initializing"; // Current status
    let error = ""; // Error message string
    let configJsonString: string | null = null; // Variable to hold the JSON string from sessionStorage
    let configData: any = null; // Variable to hold the parsed config data
    const SESSION_STORAGE_KEY = "pendingConfigJson"; // Key for sessionStorage access

    /** Generates a random 6-digit code. */
    function generateCode(): string {
        return Math.floor(100000 + Math.random() * 899999).toString();
    }

    /** Initializes the WebSocket connection and sets up event listeners. */
    function initializeWebSocket() {
        // Pre-condition check: Ensure config data is available
        if (!configJsonString) {
            status = "no_config";
            error = "Chybí konfigurační data. Vraťte se a vygenerujte je.";
            console.error("Configuration JSON string is missing.");
            return; // Stop initialization if config is missing
        }

        // Attempt to parse the configuration JSON
        try {
            configData = JSON.parse(configJsonString);
            // Basic validation: Ensure the expected structure exists
            if (!configData || !configData.formTemplate) {
                throw new Error("Neplatný formát konfiguračních dat.");
            }
        } catch (e: unknown) {
            // Handle JSON parsing errors
            status = "error";
            error = `Chyba při zpracování konfiguračních dat: ${e instanceof Error ? e.message : "Neznámá chyba"}`;
            console.error("Failed to parse configuration JSON:", e);
            return; // Stop initialization if parsing fails
        }

        // Generate connection code and reset state
        code = generateCode();
        status = "initializing";
        error = ""; // Clear previous errors

        // Establish WebSocket connection
        // Ensure you are using the correct WebSocket endpoint
        ws = new WebSocket("wss://rakathon-proxy.manakjiri.cz/doctor");

        /** Handles the WebSocket connection opening. */
        ws.onopen = () => {
            status = "connected";
            console.log("WebSocket connection opened.");
            // Send the initial message to register the doctor session with the code
            if (ws) {
                ws.send(
                    JSON.stringify({
                        message_type: "doctor_session_init",
                        code: code, // Send the generated code
                    }),
                );
                status = "waiting"; // Update status to waiting for patient
                console.log(
                    "WebSocket connected, sent init message with code, waiting for patient.",
                );
            }
        };

        /** Handles incoming messages from the WebSocket server. */
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("WebSocket message received:", data);

                // Check if the patient has connected
                if (data.message_type === "doctor_session_patient_connected") {
                    console.log(
                        "Patient connected, sending configuration data.",
                    );
                    // Send the configuration data (parsed earlier) to the server/patient
                    if (ws && configData) {
                        ws.send(
                            JSON.stringify({
                                message_type: "doctor_session_response",
                                data: configData, // Send the actual parsed configuration object
                            }),
                        );
                        // Close the connection after successfully sending the data
                        ws.close();
                        status = "success"; // Update status to success
                        console.log(
                            "Configuration data sent successfully, closing connection.",
                        );
                    } else {
                        throw new Error(
                            "WebSocket or configData not available for sending response.",
                        );
                    }
                } else {
                    console.log(
                        "Received unexpected message type:",
                        data.message_type,
                    );
                }
            } catch (parseError) {
                console.error(
                    "Error parsing received WebSocket message:",
                    parseError,
                    event.data,
                );
                status = "error";
                error = "Chyba při zpracování odpovědi serveru.";
            }
        };

        /** Handles the WebSocket connection closing. */
        ws.onclose = (event) => {
            console.log(
                `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`,
            );
            // Update status only if it wasn't already set to success, error, or no_config
            if (
                status !== "success" &&
                status !== "error" &&
                status !== "no_config"
            ) {
                status = "error";
                error = "Spojení bylo neočekávaně ukončeno.";
                console.warn("WebSocket connection closed unexpectedly.");
            } else if (status === "success") {
                console.log(
                    "WebSocket connection closed normally after successful data transfer.",
                );
            }
            ws = null; // Clear the instance
        };

        /** Handles WebSocket connection errors. */
        ws.onerror = (event) => {
            status = "error";
            error =
                "Chyba WebSocket spojení. Zkontrolujte připojení k internetu.";
            console.error("WebSocket error:", event);
            ws = null; // Clear the instance
        };
    }

    // --- Svelte Lifecycle Hooks ---

    /** Runs when the component is first mounted to the DOM. */
    onMount(() => {
        if (!browser) return; // Ensure runs only in browser

        configJsonString = sessionStorage.getItem(SESSION_STORAGE_KEY);

        if (configJsonString) {
            // IMPORTANT: Remove item immediately after retrieving
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            console.log(
                "Configuration loaded from sessionStorage and removed.",
            );
            initializeWebSocket();
        } else {
            status = "no_config";
            error =
                "Konfigurační data nebyla nalezena. Vraťte se na předchozí stránku a vygenerujte je.";
            console.warn(
                "No configuration JSON found in sessionStorage on mount.",
            );
        }
    });

    /** Runs when the component is about to be destroyed. */
    onDestroy(() => {
        // Clean up WebSocket connection
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log("Component destroying, closing WebSocket connection.");
            ws.close();
            ws = null;
        }
    });

    // --- UI Action Functions ---

    /** Attempts to re-establish the WebSocket connection. */
    function retryConnection() {
        // Re-check sessionStorage in case the user went back and generated config again
        if (browser) {
            configJsonString = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (configJsonString) {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                console.log(
                    "Retrying connection: Found config in sessionStorage.",
                );
                // Reset parsed data and re-initialize
                configData = null;
                initializeWebSocket();
            } else {
                // Config is still missing
                status = "no_config";
                error =
                    "Konfigurační data stále chybí. Nelze opakovat. Vraťte se na konfiguraci.";
                console.warn("Retry failed: Configuration data still missing.");
            }
        } else {
            status = "error";
            error =
                "Nelze opakovat spojení (prostředí prohlížeče není dostupné).";
        }
    }

    /** Navigates to the monitoring config page */
    function goToConfig() {
        goto("/monitoring-config");
    }
</script>

<div
    class="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 font-sans"
>
    <div
        class="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 text-center shadow-md md:p-8"
    >
        <div class="mb-6">
            {#if status === "initializing"}
                <h2 class="mb-4 text-lg font-medium text-gray-700">
                    Inicializace spojení...
                </h2>
                <svg
                    class="mx-auto h-8 w-8 animate-spin text-blue-600"
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
            {:else if status === "connected"}
                <h2 class="mb-4 text-lg font-medium text-gray-700">
                    Spojeno, příprava relace...
                </h2>
                <svg
                    class="mx-auto h-8 w-8 animate-spin text-blue-600"
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
            {:else if status === "waiting"}
                <h2 class="mb-2 text-lg font-medium text-gray-700">
                    Čekání na připojení pacienta
                </h2>
                <p class="mb-6 text-sm text-gray-600">
                    Prosím, sdělte pacientovi tento kód pro připojení:
                </p>
                <div
                    class="inline-block rounded-lg border border-blue-200 bg-blue-50 px-6 py-4 shadow-sm"
                >
                    <div
                        class="text-4xl font-bold tracking-widest text-blue-700 sm:text-5xl"
                    >
                        {code}
                    </div>
                </div>
                <p class="mt-6 text-xs text-gray-500">
                    Tato relace zůstane aktivní, dokud se pacient nepřipojí.
                </p>
            {:else if status === "success"}
                <div
                    class="rounded-md border border-green-300 bg-green-100 p-4 text-center text-sm text-green-800"
                    role="status"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="mx-auto mb-3 h-12 w-12 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <p class="font-medium">
                        Konfigurace byla úspěšně odeslána!
                    </p>
                    <p>Spojení bylo ukončeno.</p>
                </div>
            {:else if status === "error"}
                <div
                    class="rounded-md border border-red-300 bg-red-100 p-4 text-center text-sm text-red-700"
                    role="alert"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="mx-auto mb-3 h-12 w-12 text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <p class="font-medium">Chyba spojení</p>
                    <p>{error}</p>
                </div>
                <button
                    on:click={retryConnection}
                    class="mt-4 inline-block rounded-md border border-transparent bg-red-600 py-2 px-5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >Zkusit znovu</button
                >
            {:else if status === "no_config"}
                <div
                    class="rounded-md border border-yellow-300 bg-yellow-100 p-4 text-center text-sm text-yellow-800"
                    role="alert"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="mx-auto mb-3 h-12 w-12 text-yellow-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                    <p class="font-medium">Chybí konfigurace</p>
                    <p>{error}</p>
                </div>
                <button
                    on:click={goToConfig}
                    class="mt-4 inline-block rounded-md border border-transparent bg-yellow-500 py-2 px-5 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                    >Zpět na konfiguraci</button
                >
            {/if}
        </div>

        <div class="border-t border-gray-200 pt-6">
            <button
                on:click={goToConfig}
                class="inline-block w-full rounded-md border border-transparent bg-blue-600 py-2 px-5 text-center text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
            >
                Vytvořit nový dotazník
            </button>
        </div>
    </div>
</div>
