import { error } from "@sveltejs/kit";
import { getForm } from "$lib/formStore.js";
import { browser } from "$app/environment";

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  // This load function runs on the client-side because ssr=false
  if (!browser) {
    // Should not happen with ssr=false, but good practice
    return {
      formId: params.formId,
      formJsonString: null,
      loadError: "Loading only supported on client.",
    };
  }

  const { formId } = params;

  if (!formId) {
    // This case should be handled by SvelteKit routing rules, but defensive check
    throw error(400, "Form ID parameter is missing");
  }

  console.log(`[+page.js] Loading form with ID: ${formId}`);

  try {
    const formJsonString = await getForm(formId);

    if (formJsonString === null) {
      // Throw a SvelteKit error to show a standard error page
      console.error(`[+page.js] Form definition "${formId}" not found.`);
      throw error(404, `Form definition "${formId}" not found.`);
    }

    // Pass the raw JSON string and the ID to the page component
    return {
      formId,
      formJsonString, // Pass as string, parse in component
    };
  } catch (err) {
    // Catch errors from getForm or other issues
    console.error(`[+page.js] Error loading form "${formId}":`, err);
    // If it's already a SvelteKit error, rethrow it
    if (err.status) {
      throw err;
    }
    // Otherwise, throw a generic server error
    throw error(
      500,
      `Failed to load form definition "${formId}". Check application logs.`,
    );
  }
}
