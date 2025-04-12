<script>
    // Import necessary functions, classes, and enums from the Tauri notification PLUGIN
    import {
        sendNotification, // Used for BOTH immediate and scheduled notifications
        isPermissionGranted,
        requestPermission,
        cancel, // The function to cancel notifications by ID
        Schedule, // The class to create schedule configurations
        ScheduleEvery, // Enum for interval types (e.g., Second, Minute)
        // 'schedule' function is NOT imported as it doesn't seem to exist as a top-level export
    } from "@tauri-apps/plugin-notification";
    import { onMount } from "svelte";

    let permissionGranted = false; // Reactive variable for permission status
    // Store the ID of the currently active repeating notification for cancellation
    let repeatingNotificationId = null; // Store the ID number
    let isPeriodicActive = false; // Track if periodic notifications are scheduled

    // Check notification permission on component mount
    onMount(async () => {
        permissionGranted = await isPermissionGranted();
        console.log(`Initial notification permission: ${permissionGranted}`);
    });

    // Function to request notification permission
    async function requestNotificationPermission() {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
        if (permissionGranted) {
            console.log("Notification permission granted by user.");
        } else {
            console.log(`Notification permission status: ${permission}`);
            alert(`Notification permission was ${permission}.`);
        }
    }

    // Function to send a single, immediate notification
    function showSingleNotification() {
        if (!permissionGranted) {
            alert("Please grant notification permission first.");
            return;
        }
        // Call sendNotification without a schedule property for immediate sending
        sendNotification({
            title: "Single Notification",
            body: "This is a one-time test notification!",
        });
        console.log("Single notification sent.");
    }

    // Function to schedule repeating notifications using sendNotification
    async function scheduleRepeatingNotifications() {
        if (!permissionGranted) {
            alert("Please grant notification permission first.");
            return;
        }
        if (isPeriodicActive) {
            console.log("Repeating notifications already scheduled.");
            return; // Already scheduled
        }

        const intervalSeconds = 15; // Schedule notification every 15 seconds
        console.log(
            `Scheduling repeating notifications every ${intervalSeconds} seconds using sendNotification() with a schedule option.`,
        );

        try {
            // 1. Create the schedule configuration using the Schedule class
            const scheduleInstance = Schedule.every(
                ScheduleEvery.Second,
                intervalSeconds,
            );
            // Note: ScheduleEvery.Second might not work on iOS according to docs

            // 2. Generate a unique ID for this repeating notification schedule
            // IMPORTANT: Ensure this ID is unique if multiple schedules could exist.
            // Using a simple timestamp or random number for this example.
            const newNotificationId = Date.now(); // Simple unique ID generation

            // 3. Define the notification details, including the ID and schedule instance
            const notificationOptions = {
                id: newNotificationId, // Assign the unique ID
                title: "Repeating Background Notification",
                body: `This notification repeats every ${intervalSeconds}s. ID: ${newNotificationId}`, // Display ID for clarity
                schedule: scheduleInstance, // Assign the created Schedule instance here
                // icon: 'path/to/icon.png' // Optional icon
            };

            // 4. Call sendNotification with the options object containing the schedule
            // This registers the notification with the system scheduler. It returns void.
            sendNotification(notificationOptions);

            // Store the ID for cancellation and update state
            repeatingNotificationId = newNotificationId;
            isPeriodicActive = true;
            console.log(
                `Successfully scheduled repeating notification with ID: ${repeatingNotificationId}`,
            );

            // Send an immediate confirmation notification (optional)
            sendNotification({
                title: "Repeating Notifications Scheduled",
                body: `Notifications (ID: ${repeatingNotificationId}) will now appear every ${intervalSeconds} seconds.`,
            });
        } catch (error) {
            console.error(
                "Failed to schedule notifications via sendNotification:",
                error,
            );
            alert(`Error scheduling notifications: ${error}`);
        }
    }

    // Function to cancel the scheduled repeating notifications using its ID
    async function cancelRepeatingNotifications() {
        if (!isPeriodicActive || repeatingNotificationId === null) {
            console.log(
                "No repeating notifications are currently scheduled or ID is missing.",
            );
            return;
        }

        const idToCancel = repeatingNotificationId; // Get the ID we stored

        console.log(
            `Attempting to cancel scheduled notification with ID: ${idToCancel}`,
        );
        try {
            // Call cancel with the array containing the single notification ID
            await cancel([idToCancel]);

            repeatingNotificationId = null; // Clear the stored ID
            isPeriodicActive = false;
            console.log(
                `Successfully cancelled repeating notification with ID: ${idToCancel}.`,
            );

            // Send an immediate confirmation notification
            if (permissionGranted) {
                sendNotification({
                    title: "Repeating Notifications Cancelled",
                    body: `The repeating notification (ID: ${idToCancel}) was cancelled.`,
                });
            }
        } catch (error) {
            console.error("Failed to cancel notification:", error);
            alert(`Error cancelling notification: ${error}`);
            // Reset state optimistically on error
            // repeatingNotificationId = null;
            // isPeriodicActive = false;
        }
    }
</script>

<div class="container mx-auto p-4 text-center">
    <h1 class="text-2xl font-bold mb-4">
        Tauri Notifications Demo (sendNotification for Scheduling)
    </h1>

    {#if !permissionGranted}
        <p class="mb-4">Notification permission is required.</p>
        <button
            on:click={requestNotificationPermission}
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
        >
            Request Permission
        </button>
    {:else}
        <p class="mb-4 text-green-600">Notification permission granted.</p>

        <button
            on:click={showSingleNotification}
            class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4 mr-2"
        >
            Show Single Notification
        </button>

        {#if !isPeriodicActive}
            <button
                on:click={scheduleRepeatingNotifications}
                class="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded mb-4"
            >
                Schedule Repeating (Every 15s)
            </button>
        {:else}
            <button
                on:click={cancelRepeatingNotifications}
                class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-4"
            >
                Cancel Repeating Notification (ID: {repeatingNotificationId})
            </button>
        {/if}
    {/if}

    <div class="mt-6">
        <a href="/" class="text-blue-500 hover:underline">Go back to Home</a>
    </div>
</div>

<style>
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
</style>
