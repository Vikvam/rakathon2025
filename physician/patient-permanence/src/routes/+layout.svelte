<script>
    import Header from "$lib/Header.svelte";
    // Import any global styles if you have them, e.g.:
    import "../app.css";
</script>

<div class="app-container">
    
        <Header />
    
    <main class="page-content">
        <slot />
        <!-- Page content will be rendered here -->
    </main>
</div>

<style>
    /* Optional: Add some basic layout structure */
    .app-container {
        display: flex;
        flex-direction: column;
        min-height: 100vh; /* Ensure container takes full height */
    }

    .page-content {
        flex-grow: 1; /* Allows main content to fill available space */
        /* Resetting container styles from the original +page.svelte if needed */
        /* The specific page content will define its own layout now */
    }

    /* You might want to move global styles from +page.svelte
     (like :root variables, body styles) to a global CSS file (e.g., src/app.css)
     and import it here or in app.html if they should apply everywhere.
     Let's keep the page-specific styles in +page.svelte for now.
  */
</style>
