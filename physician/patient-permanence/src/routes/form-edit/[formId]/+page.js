import { error } from "@sveltejs/kit";
import { getForm } from "$lib/formStore.js";

/** @type {import('./$types').PageLoad} */
export async function load({ params }) {
  const { formId } = params;

  if (!formId) {
    throw error(400, "Form ID is required");
  }

  const formJson = await getForm(formId);

  if (formJson === null) {
    // Throw a SvelteKit error to show a proper error page
    throw error(404, `Form definition with ID "${formId}" not found.`);
  }

  // Pass the loaded data to the page component
  return {
    formId,
    formJson,
  };
}
