<script>
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment"; // Import browser check

    let ws; // WebSocket instance
    let code = ""; // 6-digit code for patient connection
    let status = "initializing"; // Current status: 'initializing' | 'connected' | 'waiting' | 'success' | 'error' | 'no_config'
    let error = ""; // Error message string
    let configJsonString = null; // Variable to hold the JSON string from sessionStorage
    const SESSION_STORAGE_KEY = "pendingConfigJson"; // Key for sessionStorage access

    /** Generates a random 6-digit code. */
    function generateCode() {
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
        let configData;
        try {
            configData = JSON.parse(configJsonString);
            // Basic validation: Ensure the expected structure exists
            if (!configData || !configData.formTemplate) {
                throw new Error("Neplatný formát konfiguračních dat.");
            }
        } catch (e) {
            // Handle JSON parsing errors
            status = "error";
            error = `Chyba při zpracování konfiguračních dat: ${e.message}`;
            console.error("Failed to parse configuration JSON:", e);
            return; // Stop initialization if parsing fails
        }

        // Generate connection code and reset state
        code = generateCode();
        status = "initializing";
        error = ""; // Clear previous errors

        // Establish WebSocket connection
        // Use your actual WebSocket endpoint URL here
        ws = new WebSocket("wss://rakathon-proxy.manakjiri.cz/doctor");

        /** Handles the WebSocket connection opening. */
        ws.onopen = () => {
            status = "connected";
            console.log("WebSocket connection opened.");
            // Send the initial message to register the doctor session with the code
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
                    // Log if an unexpected message type is received
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
                // Optionally set an error state here if needed
            }
        };

        /** Handles the WebSocket connection closing. */
        ws.onclose = (event) => {
            console.log(
                `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`,
            );
            // Update status only if it wasn't already set to success, error, or no_config
            // This prevents overriding the final status if the close happens after completion/error
            if (
                status !== "success" &&
                status !== "error" &&
                status !== "no_config"
            ) {
                // If closed unexpectedly while waiting or connecting
                status = "error";
                error = "Spojení bylo neočekávaně ukončeno.";
                console.warn("WebSocket connection closed unexpectedly.");
            } else if (status === "success") {
                console.log(
                    "WebSocket connection closed normally after successful data transfer.",
                );
            }
        };

        /** Handles WebSocket connection errors. */
        ws.onerror = (event) => {
            status = "error";
            error = "Chyba WebSocket spojení.";
            console.error("WebSocket error:", event);
        };
    }

    // --- Svelte Lifecycle Hooks ---

    /** Runs when the component is first mounted to the DOM. */
    onMount(() => {
        // Ensure code runs only in the browser
        if (!browser) return;

        // Retrieve the configuration JSON string from sessionStorage
        configJsonString = sessionStorage.getItem(SESSION_STORAGE_KEY);

        if (configJsonString) {
            // IMPORTANT: Remove the item immediately after retrieving it
            // to prevent it being reused on refresh or re-navigation.
            sessionStorage.removeItem(SESSION_STORAGE_KEY);
            console.log(
                "Configuration loaded from sessionStorage and removed.",
            );
            // Initialize the WebSocket connection now that config is loaded
            initializeWebSocket();
        } else {
            // Handle the case where no configuration data is found
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
        // Clean up the WebSocket connection if it's still open
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log("Component destroying, closing WebSocket connection.");
            ws.close();
        }
    });

    // --- UI Action Functions ---

    /** Attempts to re-establish the WebSocket connection. */
    function retryConnection() {
        // Re-check sessionStorage in case the user went back and generated config again
        if (browser) {
            configJsonString = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (configJsonString) {
                // Found config, clear it and try initializing again
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                console.log(
                    "Retrying connection: Found config in sessionStorage.",
                );
                initializeWebSocket();
            } else {
                // Config is still missing, cannot retry meaningfully
                status = "no_config";
                error =
                    "Konfigurační data stále chybí. Nelze opakovat. Vraťte se na konfiguraci.";
                console.warn("Retry failed: Configuration data still missing.");
            }
        } else {
            // Cannot retry if not in browser context
            status = "error";
            error =
                "Nelze opakovat spojení (prostředí prohlížeče není dostupné).";
        }
    }
</script>

<div class="container">
    {#if status === "initializing"}
        <div class="status">Inicializace spojení...</div>
        <svg
            class="animate-spin h-8 w-8 text-blue-500 mt-4"
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
        <div class="status">Spojeno, příprava relace...</div>
        <svg
            class="animate-spin h-8 w-8 text-blue-500 mt-4"
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
        <div class="code">{code}</div>
        <div class="status">Čekání na připojení pacienta...</div>
        <div class="instructions">
            Prosím, sdělte pacientovi tento kód pro připojení k relaci.
        </div>
    {:else if status === "success"}
        <div class="success">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-12 w-12 text-green-500 mx-auto mb-2"
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
            Konfigurace byla úspěšně odeslána! Spojení bylo ukončeno.
        </div>
        <a href="/monitoring-config" class="retry-button new-session-button"
            >Nová relace</a
        >
    {:else if status === "error"}
        <div class="error">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-12 w-12 text-red-500 mx-auto mb-2"
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
            {error}
            <button on:click={retryConnection}>Zkusit znovu</button>
        </div>
    {:else if status === "no_config"}
        <div class="error">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-12 w-12 text-yellow-500 mx-auto mb-2"
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
            {error}
            <a href="/monitoring-config" class="retry-button"
                >Zpět na konfiguraci</a
            >
        </div>
    {/if}
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh; /* Adjusted height for better centering */
        padding: 1rem;
        text-align: center;
        font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            Oxygen,
            Ubuntu,
            Cantarell,
            "Open Sans",
            "Helvetica Neue",
            sans-serif; /* System font stack */
    }

    .code {
        font-size: clamp(2.5rem, 10vw, 4rem); /* Responsive font size */
        font-weight: bold;
        margin: 1.5rem 0;
        letter-spacing: 0.5rem; /* Spacing between digits */
        color: #333; /* Dark gray text */
        background-color: #f0f0f0; /* Light gray background */
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Subtle shadow */
        display: inline-block; /* Fit content width */
    }

    .status {
        font-size: 1.2rem;
        color: #666; /* Medium gray */
        margin-top: 0.5rem;
    }
    .instructions {
        font-size: 1rem;
        color: #555; /* Slightly darker gray */
        margin-top: 0.5rem;
        max-width: 300px; /* Limit width for readability */
    }

    .success {
        color: #27ae60; /* Slightly darker green */
        font-size: 1.4rem;
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .error {
        color: #c0392b; /* Slightly darker red */
        font-size: 1.2rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 400px; /* Limit width */
    }

    /* Common styles for buttons and links styled as buttons */
    button,
    .retry-button {
        margin-top: 1.5rem;
        padding: 0.75rem 1.5rem;
        background-color: #2980b9; /* Default blue */
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
        transition: background-color 0.2s ease;
        text-decoration: none; /* Remove underline from links */
        display: inline-block; /* Proper alignment */
    }

    button:hover,
    .retry-button:hover {
        background-color: #1f618d; /* Darker blue on hover */
    }

    /* Specific button colors */
    .error button {
        background-color: #e74c3c; /* Red for error retry */
    }
    .error button:hover {
        background-color: #c0392b; /* Darker red on hover */
    }
    .error a.retry-button {
        /* Style link like a button */
        background-color: #f39c12; /* Orange for 'back' navigation */
    }
    .error a.retry-button:hover {
        background-color: #e67e22; /* Darker orange on hover */
    }
    .success a.new-session-button {
        background-color: #2ecc71; /* Green for new session */
    }
    .success a.new-session-button:hover {
        background-color: #27ae60; /* Darker green */
    }
</style>
