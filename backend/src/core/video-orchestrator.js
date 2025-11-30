/**
 * Video structure generation orchestrator with automatic repair/retry
 */

import { LLMClient } from './llm-client.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../prompts/video-architecture.js';
import { RootSchema } from '../schemas/video-structure.schema.js';

/**
 * Helper that builds a repair prompt containing the model's last output
 * and the validation error so the model knows exactly what to fix.
 */
function buildRepairPrompt(rawOutput, validationError) {
  // Extract the specific error message
  let specificError = validationError;
  
  // If it's a JSON parse error, provide more specific guidance
  if (validationError.includes('Expected') && validationError.includes('after property value')) {
    specificError = `JSON parsing error: ${validationError}

COMMON FIXES:
- Make sure every object in an array has a closing brace } before the array closes with ]
- Example WRONG: {"id": "seg1", "order": 1]  (missing closing brace)
- Example CORRECT: {"id": "seg1", "order": 1}]  (has closing brace)
- Make sure all properties are separated by commas
- Make sure all strings are properly quoted
- Check that the last segment object closes with } before the array closes with ]`;
  }
  
  return `The JSON you returned is not valid.

**Your output**

\`\`\`
${rawOutput.substring(0, 1500)}
\`\`\`

**Error**

${specificError}

**CRITICAL**: Please rewrite the ENTIRE JSON object from scratch. Make absolutely sure:
1. Every object in the segments array has a closing brace } before the array closes
2. All properties are separated by commas
3. The JSON is valid and can be parsed by JSON.parse()
4. Output ONLY the JSON - no markdown, no code fences, no explanations`;
}

/**
 * Main entry point – returns a fully‑validated video‑structure object.
 *
 * @param {LLMClient} client - an instance of LLMClient (already configured)
 * @param {import('./types.js').VideoGenerationInput} input - the video generation input
 * @param {number} maxAttempts - how many times we will ask the model to repair
 * @returns {Promise<import('./types.js').CVAResult>}
 */
export async function generateVideoStructure(
  client,
  input,
  maxAttempts = 3
) {
  // --- 1️⃣ first request -------------------------------------------------
  let userPrompt = buildUserPrompt(input);
  let rawResponse = await client.generate(userPrompt, SYSTEM_PROMPT);
  let attempt = 1;

  while (true) {
    try {
      // --- 2️⃣ extract *only* the JSON (your LLMClient already ships with a giant helper)
      // Log raw response for debugging (first 500 chars)
      if (attempt === 1) {
        console.log('📝 Raw LLM response (first 500 chars):', rawResponse.content.substring(0, 500));
      }
      const jsonObj = LLMClient.parseJSON(rawResponse.content);

      // --- 3️⃣ schema validation -------------------------------------------------
      const result = RootSchema.safeParse(jsonObj);
      if (!result.success) {
        // Validation failed → throw so the catch block will ask for a repair
        const why = result.error.issues
          .map((i) => `${i.path.join('.')} – ${i.message}`)
          .join('; ');
        throw new Error(`Schema validation failed: ${why}`);
      }

      // ---- SUCCESS ---------------------------------------------------------
      return result.data; // <-- fully validated, ready for the rest of the pipeline
    } catch (e) {
      // -----------------------------------------------------------------
      // If we're out of attempts we bail out with a helpful error.
      // -----------------------------------------------------------------
      if (attempt >= maxAttempts) {
        throw new Error(
          `Could not obtain a valid video structure after ${maxAttempts} attempts.\n` +
            `Last error: ${e.message}\n` +
            `Last LLM output (truncated): ${rawResponse.content.slice(0, 500)}`
        );
      }

      // -----------------------------------------------------------------
      // Otherwise we ask the model to **repair** the JSON.
      // -----------------------------------------------------------------
      console.warn(
        `⚠️  Attempt ${attempt} failed (${e.message}). Asking LLM to fix…`
      );

      const repairPrompt = buildRepairPrompt(
        rawResponse.content,
        e.message
      );

      // Note: we keep the same system prompt – it already contains the schema rules.
      rawResponse = await client.generate(repairPrompt, SYSTEM_PROMPT);
      attempt++;
    }
  }
}

