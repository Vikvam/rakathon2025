/**
 * Checks if a *specific* answer is problematic based on range and
 * deviation from PREVIOUS *or* FIRST answer.
 * NOTE: Repetitions logic from template is IGNORED here.
 * NOTE: First answer (index 0) only checked for range, not deviation.
 */
export function isProblematic(formJSON, questionIdx, answerIdx) {
  try {
    // Use getQaData to fetch details, including all answers for the first answer comparison
    const { question, answer, previousAnswer, answers } = getQaData(
      formJSON,
      questionIdx,
      answerIdx,
    );

    const rules = question.problematicValues;
    if (!rules) return false;

    const currentValue = answer.value;

    if (question.dataType === "numerical") {
      if (typeof currentValue !== "number") return false;

      // 1. Check Range (Applies to all answers, including the first)
      if (rules.range) {
        const { min, max } = rules.range;
        let isProblematicInRange = false;
        const meetsMin = min == null || currentValue >= min;
        const meetsMax = max == null || currentValue <= max;
        if (meetsMin && meetsMax && (min != null || max != null)) {
          isProblematicInRange = true;
        }
        if (isProblematicInRange) {
          // console.log(`Problematic Range: Q${questionIdx}, A${answerIdx}, Val:${currentValue}, Range:[${min ?? "-inf"}, ${max ?? "inf"}]`);
          return true; // Problematic by range
        }
      }

      // --- Deviation Checks ---
      // Skip deviation checks entirely for the very first answer (index 0)
      if (answerIdx === 0) {
        return false; // First answer cannot be problematic by deviation
      }

      // 2. Check Deviation vs Previous Answer (if applicable)
      let isDevProblematicVsPrev = false;
      if (rules.deviation && previousAnswer) {
        // previousAnswer is already i-1
        const { increasePercent, decreasePercent } = rules.deviation;
        const previousValue = previousAnswer.value;
        if (typeof previousValue === "number") {
          const deviation = calculateDeviationPercent(
            currentValue,
            previousValue,
          );
          if (deviation !== null && deviation !== Infinity) {
            const increaseExceeded =
              increasePercent != null && deviation > increasePercent;
            const decreaseExceeded =
              decreasePercent != null && deviation < -decreasePercent;
            if (increaseExceeded || decreaseExceeded) {
              isDevProblematicVsPrev = true;
              // console.log(`Problematic Deviation vs Prev: Q${questionIdx}, A${answerIdx}, Val:${currentValue}, Prev:${previousValue}, Dev:${deviation.toFixed(1)}%`);
            }
          } else if (
            deviation === Infinity &&
            increasePercent != null &&
            currentValue > 0
          ) {
            isDevProblematicVsPrev = true; // Infinite increase from 0
            // console.log(`Problematic Deviation vs Prev (from 0): Q${questionIdx}, A${answerIdx}, Val:${currentValue}, Prev:0`);
          }
        }
      }
      if (isDevProblematicVsPrev) return true; // Problematic by deviation vs previous

      // 3. Check Deviation vs First Answer (if applicable and different from previous)
      let isDevProblematicVsFirst = false;
      const firstAnswer = answers?.[0];
      // Only check vs first if rules.deviation exists, we are not index 1 (where prev IS first), and firstAnswer exists
      if (rules.deviation && answerIdx > 1 && firstAnswer) {
        const { increasePercent, decreasePercent } = rules.deviation;
        const firstValue = firstAnswer.value;
        if (typeof firstValue === "number") {
          const deviation = calculateDeviationPercent(currentValue, firstValue);
          if (deviation !== null && deviation !== Infinity) {
            const increaseExceeded =
              increasePercent != null && deviation > increasePercent;
            const decreaseExceeded =
              decreasePercent != null && deviation < -decreasePercent;
            if (increaseExceeded || decreaseExceeded) {
              isDevProblematicVsFirst = true;
              // console.log(`Problematic Deviation vs First: Q${questionIdx}, A${answerIdx}, Val:${currentValue}, First:${firstValue}, Dev:${deviation.toFixed(1)}%`);
            }
          } else if (
            deviation === Infinity &&
            increasePercent != null &&
            currentValue > 0
          ) {
            isDevProblematicVsFirst = true; // Infinite increase from 0
            // console.log(`Problematic Deviation vs First (from 0): Q${questionIdx}, A${answerIdx}, Val:${currentValue}, First:0`);
          }
        }
      }
      if (isDevProblematicVsFirst) return true; // Problematic by deviation vs first
    } else if (question.dataType === "single_choice") {
      // single_choice logic remains the same
      if (Array.isArray(rules) && rules.includes(currentValue)) {
        return true;
      }
    }

    return false; // Not problematic by any applicable rule
  } catch (error) {
    console.error(
      `Error in isProblematic (Q:${questionIdx}, A:${answerIdx}):`,
      error,
    );
    return false;
  }
}

/**
 * Checks if a *specific* answer is critical based on range and
 * deviation from PREVIOUS *or* FIRST answer.
 * NOTE: Repetitions logic from template is IGNORED here.
 * NOTE: First answer (index 0) only checked for range, not deviation.
 */
export function isCritical(formJSON, questionIdx, answerIdx) {
  try {
    // Use getQaData to fetch details, including all answers for the first answer comparison
    const { question, answer, previousAnswer, answers } = getQaData(
      formJSON,
      questionIdx,
      answerIdx,
    );

    const rules = question.criticalValues;
    if (!rules) return false;

    const currentValue = answer.value;

    if (question.dataType === "numerical") {
      if (typeof currentValue !== "number") return false;

      // 1. Check Range (Applies to all answers, including the first)
      if (rules.range) {
        const { min, max } = rules.range;
        let isCriticalInRange = false;
        const meetsMin = min == null || currentValue >= min;
        const meetsMax = max == null || currentValue <= max;
        if (meetsMin && meetsMax && (min != null || max != null)) {
          isCriticalInRange = true;
        }
        if (isCriticalInRange) {
          // console.log(`Critical Range: Q${questionIdx}, A${answerIdx}, Val:${currentValue}, Range:[${min ?? "-inf"}, ${max ?? "inf"}]`);
          return true; // Critical by range
        }
      }

      // --- Deviation Checks ---
      // Skip deviation checks entirely for the very first answer (index 0)
      if (answerIdx === 0) {
        return false; // First answer cannot be critical by deviation
      }

      // 2. Check Deviation vs Previous Answer (if applicable)
      let isDevCriticalVsPrev = false;
      if (rules.deviation && previousAnswer) {
        const { increasePercent, decreasePercent } = rules.deviation;
        const previousValue = previousAnswer.value;
        if (typeof previousValue === "number") {
          const deviation = calculateDeviationPercent(
            currentValue,
            previousValue,
          );
          if (deviation !== null && deviation !== Infinity) {
            const increaseExceeded =
              increasePercent != null && deviation > increasePercent;
            const decreaseExceeded =
              decreasePercent != null && deviation < -decreasePercent;
            if (increaseExceeded || decreaseExceeded) {
              isDevCriticalVsPrev = true;
              //  console.log(`Critical Deviation vs Prev: Q${questionIdx}, A${answerIdx}, Val:${currentValue}, Prev:${previousValue}, Dev:${deviation.toFixed(1)}%`);
            }
          } else if (
            deviation === Infinity &&
            increasePercent != null &&
            currentValue > 0
          ) {
            isDevCriticalVsPrev = true; // Infinite increase from 0
            //  console.log(`Critical Deviation vs Prev (from 0): Q${questionIdx}, A${answerIdx}, Val:${currentValue}, Prev:0`);
          }
        }
      }
      if (isDevCriticalVsPrev) return true; // Critical by deviation vs previous

      // 3. Check Deviation vs First Answer (if applicable and different from previous)
      let isDevCriticalVsFirst = false;
      const firstAnswer = answers?.[0];
      if (rules.deviation && answerIdx > 1 && firstAnswer) {
        const { increasePercent, decreasePercent } = rules.deviation;
        const firstValue = firstAnswer.value;
        if (typeof firstValue === "number") {
          const deviation = calculateDeviationPercent(currentValue, firstValue);
          if (deviation !== null && deviation !== Infinity) {
            const increaseExceeded =
              increasePercent != null && deviation > increasePercent;
            const decreaseExceeded =
              decreasePercent != null && deviation < -decreasePercent;
            if (increaseExceeded || decreaseExceeded) {
              isDevCriticalVsFirst = true;
              // console.log(`Critical Deviation vs First: Q${questionIdx}, A${answerIdx}, Val:${currentValue}, First:${firstValue}, Dev:${deviation.toFixed(1)}%`);
            }
          } else if (
            deviation === Infinity &&
            increasePercent != null &&
            currentValue > 0
          ) {
            isDevCriticalVsFirst = true; // Infinite increase from 0
            // console.log(`Critical Deviation vs First (from 0): Q${questionIdx}, A${answerIdx}, Val:${currentValue}, First:0`);
          }
        }
      }
      if (isDevCriticalVsFirst) return true; // Critical by deviation vs first
    } else if (question.dataType === "single_choice") {
      // single_choice logic remains the same
      if (Array.isArray(rules) && rules.includes(currentValue)) {
        return true;
      }
    }

    return false; // Not critical by any applicable rule
  } catch (error) {
    console.error(
      `Error in isCritical (Q:${questionIdx}, A:${answerIdx}):`,
      error,
    );
    return false;
  }
}

/**
 * Exports a summary based on *all* answers for each question, grouped by category.
 * - Numerical: Shows mean + overall status flag (critical/problematic/normal).
 * - Single Choice: Shows overall status text (critical/problematic/negates).
 * Overall status is determined by checking *all* answers using the updated
 * isCritical/isProblematic functions (which include dual deviation checks).
 *
 * @param {object} formJSON - The complete form JSON object including answers arrays per question.
 * @returns {string} - A summary string with questions grouped by category.
 */
export function exportFormSummary(formJSON) {
  if (!formJSON?.formTemplate?.questions) {
    return "Chybí data formuláře.";
  }

  // Object to store category-specific summaries
  /** @type {Object.<string, Array<string>>} */
  const categorySummaries = {};
  const questions = formJSON.formTemplate.questions;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const answers = question.answers || [];
    const totalAnswers = answers.length;

    // Skip questions with no answers
    if (totalAnswers === 0) {
      continue;
    }

    const keyText = question.key.replace(/\_/g, " ");
    
    // Get category name from formName or fallback to "Ostatní" (Other)
    const category = question.formName || "Ostatní";

    // Initialize category array if it doesn't exist
    if (!categorySummaries[category]) {
      categorySummaries[category] = [];
    }

    // --- Get Overall Status (using updated isCritical/isProblematic) ---
    const { isAnyCritical, isAnyProblematic } = getQuestionOverallStatus(
      formJSON,
      i,
    );

    // --- Process based on data type ---
    let summaryPart = "";

    if (question.dataType === "numerical") {
      // Calculate mean
      /** @type {Array<number>} */
      const numericalValues = answers
        .map(/** @param {any} a */ (a) => a.value)
        .filter(/** @param {any} v */ (v) => typeof v === "number");
      const validCount = numericalValues.length;
      let meanValueStr = "N/A";
      if (validCount > 0) {
        const sum = numericalValues.reduce(
          /** @param {number} acc @param {number} val */
          (acc, val) => acc + val, 
          0
        );
        const mean = sum / validCount;
        meanValueStr = mean.toFixed(1);
      }

      // Determine overall status description for numerical
      let statusDescription = "";
      if (isAnyCritical) {
        statusDescription = " (závažný stav)"; // Overall critical state found
      } else if (isAnyProblematic) {
        statusDescription = " (problematický stav)"; // Overall problematic state found (but no critical)
      } else {
        statusDescription = " (v normě)"; // All answers were within normal limits
      }

      summaryPart = `${keyText}: ${meanValueStr}${statusDescription}`;
    } else if (question.dataType === "single_choice") {
      // Single Choice summary logic remains the same (uses overall status)
      let choiceDescription = "";
      if (isAnyCritical) {
        choiceDescription = "závažné potíže";
      } else if (isAnyProblematic) {
        choiceDescription = "potíže";
      } else {
        choiceDescription = "neguje potíže";
      }
      summaryPart = `${keyText}: ${choiceDescription}`;
    } else {
      // Fallback for other data types (uses latest value)
      const latestAnswer = answers[totalAnswers - 1];
      let valueStr = JSON.stringify(latestAnswer?.value ?? "N/A"); // Handle potential undefined value
      summaryPart = `${keyText}: ${valueStr}`;
    }

    categorySummaries[category].push(`- ${summaryPart}`);
  }

  // Join summaries by category
  const resultLines = ["Subj.:"];
  
  // Get all categories
  const categories = Object.keys(categorySummaries);
  
  if (categories.length === 0) {
    return "Žádné otázky ke shrnutí.";
  }
  
  // Add each category with its summaries
  categories.forEach(category => {
    resultLines.push(`\n${category}:`);
    resultLines.push(categorySummaries[category].join("\n"));
  });

  return resultLines.join("\n");
}

function getQaData(formJSON, questionIdx, answerIdx) {
  const question = formJSON?.formTemplate?.questions?.[questionIdx];
  if (!question) {
    throw Error(`Question at index ${questionIdx} not found.`);
  }
  // Ensure answers array exists
  const answers = question.answers || [];
  const answer = answers[answerIdx];
  if (!answer) {
    // Modify error message slightly as answers might be empty
    throw Error(
      `Answer at index ${answerIdx} for question ${questionIdx} not found or answers array missing/empty.`,
    );
  }
  const previousAnswer = answerIdx > 0 ? answers[answerIdx - 1] : null;
  return { question, answer, previousAnswer, answers }; // Pass all answers too if needed later
}

function calculateDeviationPercent(currentValue, previousValue) {
  if (
    previousValue == null ||
    typeof previousValue !== "number" ||
    currentValue == null ||
    typeof currentValue !== "number"
  ) {
    return null; // Cannot calculate
  }
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : Infinity;
  }
  return ((currentValue - previousValue) / Math.abs(previousValue)) * 100; // Use Math.abs for correct % change interpretation
}

/**
 * Determines the overall status of a question based on all its answers.
 * Checks if *any* answer was critical or problematic.
 *
 * @param {object} formJSON - The form object with answers included.
 * @param {number} questionIdx - The index of the question.
 * @returns {{isAnyCritical: boolean, isAnyProblematic: boolean}} - Overall status flags.
 */
function getQuestionOverallStatus(formJSON, questionIdx) {
  /** @type {any} */
  const question = formJSON?.formTemplate?.questions?.[questionIdx];
  const answers = question?.answers || [];
  let isAnyCritical = false;
  let isAnyProblematic = false;

  // Check all answers for critical status first
  for (let i = 0; i < answers.length; i++) {
    if (isCritical(formJSON, questionIdx, i)) {
      isAnyCritical = true;
      break; // Found critical, no need to check further for this flag
    }
  }

  // If no critical answer was found, check all answers for problematic status
  // Correction: Check for problematic regardless, needed for the 3-tier logic
  // if (!isAnyCritical) { // Removed this condition
  for (let i = 0; i < answers.length; i++) {
    if (isProblematic(formJSON, questionIdx, i)) {
      isAnyProblematic = true;
      break; // Found problematic, no need to check further for this flag
    }
  }
  // }

  return { isAnyCritical, isAnyProblematic };
}

/**
 * Determines the overall status of a form based on all its questions.
 * Checks if *any* question was critical or problematic.
 *
 * @param {object} formJSON - The form object with answers included.
 * @returns {{isCritical: boolean, isProblematic: boolean}} - Overall status flags.
 */
export function getFormOverallStatus(formJSON) {
  const questions = formJSON.formTemplate.questions;
  let isCritical = false;
  let isProblematic = false;

  for (let i = 0; i < questions.length; i++) {
    const { isAnyCritical, isAnyProblematic } = getQuestionOverallStatus(
      formJSON,
      i,
    );
    if (isAnyCritical) {
      isCritical = true;
    }
    if (isAnyProblematic) {
      isProblematic = true;
    }
  }
  return { isCritical, isProblematic };
}