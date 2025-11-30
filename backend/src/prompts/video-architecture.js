/**
 * System and user prompts for video architecture generation
 */

/** ------------------------------------------------------------------
 *  System prompt – never changes (you can put it in a .env if you wish)
 * ------------------------------------------------------------------- */
export const SYSTEM_PROMPT = `You are the **Chief Video Architect (CVA)**. Your job is to output a **single** JSON object that follows the schema shown below.

**RULES**

1️⃣ Output ONLY the JSON – no introductory sentence, no trailing explanation, and **no markdown fences** (no \`\`\` or \`\`\`json).

2️⃣ Do NOT add comments or any text outside the JSON.

3️⃣ If you cannot produce a valid object, reply with the literal: {}.

4️⃣ Use temperature = 0 (deterministic output).

**SCHEMA**

{
  "structure": {
    "total_duration": <number>,               // total video length in seconds
    "segments": [                             // in order of appearance
      {
        "id": <string>,                       // e.g. "seg1"
        "asset_id": <string>,                 // img1, music1, etc.
        "duration": <number>,                 // seconds
        "order": <integer>,                   // 1‑based
        "transition_type": <string, optional> // e.g. "crossfade"
      }
      // … repeat for every segment …
    ],
    "voiceover_duration": <number>,           // seconds
    "voiceover_start": <number>               // seconds from start
  },
  "reasoning": <string>                       // brief explanation of your decisions
}`;

/** ------------------------------------------------------------------
 *  User‑prompt builder – you pass the concrete values for the video you want.
 * ------------------------------------------------------------------- */
export function buildUserPrompt(input) {
  const assetsList = input.assets
    .map(asset => `  - ${asset.id} (${asset.type}): ${asset.src}`)
    .join('\n');

  return `Analyze this video generation request and create a structured plan:

PROJECT ID: ${input.project_id}

VIDEO SETTINGS:
- Resolution: ${input.video_settings.resolution}
- FPS: ${input.video_settings.fps}
- Format: ${input.video_settings.format}

ASSETS:
${assetsList}

INSTRUCTIONS:
- Style: ${input.instructions.style || 'not specified'}
- Camera Movement: ${input.instructions.camera_movement || 'not specified'}
- Transitions: ${input.instructions.transitions || 'not specified'}
- Target Duration: ${input.instructions.target_duration || 'auto'} seconds
- Voiceover: ${input.instructions.voiceover ? JSON.stringify(input.instructions.voiceover) : 'none'}

Create a video structure that:
1. Uses all provided image assets
2. Meets the target duration (or calculates appropriate duration if auto)
3. Creates logical segment flow
4. Accounts for transitions between segments
5. Allocates time for voiceover if present

Return ONLY the JSON object defined in the system prompt.`;
}

