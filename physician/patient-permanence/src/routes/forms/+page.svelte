<script>
    import { onMount } from "svelte"; // Keep onMount if needed for other things, otherwise remove
    import { registerActionTypes } from "@tauri-apps/plugin-notification";

    // goto is no longer needed here for notifications
    // import { goto } from "$app/navigation";
    import {
        isPermissionGranted,
        requestPermission,
        sendNotification,
    } from "@tauri-apps/plugin-notification";
    // listen is no longer needed here
    // import { listen } from "@tauri-apps/api/event";
    import { getForms, listForms } from "$lib/formStore.js";

    let forms = $state([]);
    let isLoading = $state(true);
    let error = $state(null);
    // notificationCleanup is no longer needed here
    // let notificationCleanup = null;
    import { onAction } from "@tauri-apps/plugin-notification";

    onAction((notification) => {
        console.log("Action performed:", notification);
    });

    /** Shows a notification prompting the user to fill the last form. */
    async function showNotification(form) {
        if (!form) return; // Don't show if no form provided

        await registerActionTypes([
            {
                id: "messages",
                actions: [
                    {
                        id: "reply",
                        title: "Reply",
                        input: true,
                        inputButtonTitle: "Send",
                        inputPlaceholder: "Type your reply...",
                    },
                    {
                        id: "mark-read",
                        title: "Mark as Read",
                        foreground: false,
                    },
                ],
            },
        ]);

        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
            const permissionResult = await requestPermission();
            permissionGranted = permissionResult === "granted";
        }

        if (permissionGranted) {
            console.log(
                `Sending notification for form: ${form.name} (ID: ${form.templateId})`,
            );
            try {
                await sendNotification({
                    title: "Nevyplněný dotazník",
                    body: `Máte nový dotazník k vyplnění: ${form.name}. Klikněte zde pro otevření.`,
                    // Include form ID in data for the click handler in the layout
                    actionTypeId: "messages",
                });
                console.log("Notification sent successfully.");
                // It might be better to register the onAction listener once, perhaps in onMount or globally,
                // rather than re-registering every time a notification is sent.
                // However, keeping the existing logic for now.
                await onAction((notification) => {
                    console.log("Action performed:", notification);
                });
            } catch (e) {
                console.error("Failed to send notification:", e);
                // Optional: Inform user via UI if sending fails
                // error = "Nepodařilo se odeslat notifikaci.";
            }
        } else {
            console.warn("Notification permission not granted.");
            // Optional: Inform user via UI that notifications are disabled
            // error = "Notifikace nejsou povoleny.";
        }
    }

    // --- Lifecycle Hooks ---

    // Effect to load forms and schedule notification (Stays Here)
    $effect(() => {
        isLoading = true;
        error = null;
        console.log("Form list effect running...");
        listForms(); // Assuming this triggers an update to the store which getForms reads
        getForms()
            .then((data) => {
                forms = data;
                console.log("Forms loaded:", forms.length);
                // Schedule notification after forms are loaded
                if (forms.length > 0) {
                    const lastForm = forms[forms.length - 1];
                    console.log(
                        "Scheduling notification for last form:",
                        lastForm.name,
                    );
                    // Set timeout to show notification after 5 seconds
                    const timerId = setTimeout(() => {
                        console.log("Timer fired, showing notification...");
                        showNotification(lastForm);
                    }, 5000); // 5 seconds delay

                    // Cleanup function for the effect: clear timeout if component unmounts or effect re-runs
                    return () => {
                        console.log("Clearing notification timer.");
                        clearTimeout(timerId);
                    };
                } else {
                    console.log("No forms found, not scheduling notification.");
                }
            })
            .catch((err) => {
                console.error("Failed to load forms:", err);
                error = "Nepodařilo se načíst dotazníky.";
            })
            .finally(() => {
                isLoading = false;
                console.log("Form loading finished.");
            });
    });

    // Mount hook is no longer needed for the notification listener
    /*
	onMount(async () => {
		// REMOVED: Listener logic moved to +layout.svelte
		return () => {
			// REMOVED: Cleanup logic moved to +layout.svelte
		};
	});
	*/
</script>

{#if isLoading}
    <p class="text-center text-gray-500 my-8">Načítám dotazníky...</p>
{:else if error}
    <div
        class="my-4 p-4 rounded-md text-sm bg-red-100 border border-red-300 text-red-700 max-w-md mx-auto"
        role="alert"
    >
        <strong class="font-semibold">Chyba:</strong>
        {error}
    </div>
{:else if forms.length === 0}
    <p class="text-center text-gray-500 my-8 max-w-md mx-auto">
        Zatím nemáte žádné dotazníky, obdržíte je od lékaře.
    </p>
{:else}
    <h1 class="mb-6 text-center text-2xl font-bold text-gray-800">
        Aktuální dotazníky
    </h1>
    <div class="w-full max-w-md mx-auto space-y-4">
        <ul>
            {#each forms as form, index (form.templateId)}
                <li>
                    <div
                        class="rounded-lg border border-gray-200 bg-white p-6 shadow-md"
                    >
                        <a
                            href="/patient-form/{form.templateId}"
                            class="block mb-3"
                            aria-label="Vyplnit dotazník {form.name}"
                        >
                            <span class="font-medium text-lg text-gray-900"
                                >{form.name}</span
                            >
                            <br />
                            <span class="text-sm text-gray-600"
                                >{form.description || "Bez popisu"}</span
                            >
                        </a>

                        <div class="flex space-x-4 mt-2 text-sm">
                            <a
                                href="/form-edit/{form.templateId}"
                                class="text-blue-600 hover:underline"
                                aria-label="Upravit dotazník {form.name}"
                            >
                                Editovat
                            </a>
                            <a
                                href="/form-summary/{form.templateId}"
                                class="text-green-600 hover:underline"
                                aria-label="Zobrazit shrnutí dotazníku {form.name}"
                            >
                                Shrnutí
                            </a>
                        </div>

                        {#if index === forms.length - 1}
                            <p class="text-red-600 font-semibold mt-3 text-sm">
                                Je na čase tento dotazník vyplnit
                            </p>
                        {/if}
                    </div>
                </li>
            {/each}
        </ul>
    </div>
{/if}

<a
    href="/patient-code-input"
    class="code-input-button w-full max-w-md mx-auto mt-6 block rounded-lg bg-blue-600 text-white text-center py-3 px-6 shadow-md hover:bg-blue-700 transition-colors duration-200 ease-in-out"
>
    Zadání kódu od lékaře
</a>

<style>
    /* Keep ul reset if needed, though Tailwind often handles this */
    ul {
        list-style: none;
        padding: 0;
        margin: 0; /* Added margin reset */
    }
    /* Removed li styles as Tailwind is used now */
    .code-input-button {
        font-weight: 500;
        text-decoration: none;
    }
    .code-input-button:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* Removed the rule that displayed aria-label on hover */
</style>
