/**
 * Safety & Compliance Officer (SCO) Agent
 * Responsibilities: Check copyright risk, personal-image misuse, deepfake risk, validate instructions
 */

import { LLMClient } from '../core/llm-client.js';

const { parseJSON } = LLMClient;

export class SCO {
  /**
   * @param {LLMClient} llmClient
   */
  constructor(llmClient) {
    this.llmClient = llmClient;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @param {import('../core/types.js').CDResult} cdResult
   * @param {import('../core/types.js').VEResult} veResult
   * @param {import('../core/types.js').AEResult} aeResult
   * @returns {Promise<import('../core/types.js').SCOResult>}
   */
  async execute(input, cvaResult, cdResult, veResult, aeResult) {
    const prompt = this.buildPrompt(input, cvaResult, cdResult, veResult, aeResult);
    const systemPrompt = this.getSystemPrompt();

    const response = await this.llmClient.generate(prompt, systemPrompt);
    const result = this.parseJSON(response.content);

    // Validate result
    if (typeof result.safety_issue !== 'boolean') {
      throw new Error('Invalid SCO result: safety_issue must be boolean');
    }

    return result;
  }

  getSystemPrompt() {
    return `You are the Safety & Compliance Officer (SCO) for a video generation company.

Your responsibilities:
1. Check copyright risk (unauthorized use of copyrighted material)
2. Check personal-image misuse risk (using someone's image without permission)
3. Check deepfake risk (manipulating faces/voices in harmful ways)
4. Validate user instructions for safety concerns
5. If risky → mark safety_issue = true + propose safe alternative

You must output a JSON object with this structure:
{
  "safety_issue": false,
  "safety_reason": null,
  "copyright_risk": false,
  "personal_image_risk": false,
  "deepfake_risk": false,
  "safe_alternative": {
    "modified_instructions": { ... },
    "warnings": ["warning 1", "warning 2"]
  }
}

Safety guidelines:
- Copyright risk: Using copyrighted images, music, or content without license
- Personal image risk: Using identifiable people's images without consent
- Deepfake risk: Manipulating faces/voices to misrepresent or harm
- Be conservative: If uncertain, flag as potential risk
- Provide actionable alternatives when flagging issues`;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @param {import('../core/types.js').CDResult} cdResult
   * @param {import('../core/types.js').VEResult} veResult
   * @param {import('../core/types.js').AEResult} aeResult
   * @returns {string}
   */
  buildPrompt(input, cvaResult, cdResult, veResult, aeResult) {
    const assetsList = input.assets
      .map(asset => `  - ${asset.id} (${asset.type}): ${asset.src}`)
      .join('\n');

    return `Perform safety and compliance check for this video project:

PROJECT: ${input.project_id}

ASSETS:
${assetsList}

INSTRUCTIONS:
${JSON.stringify(input.instructions, null, 2)}

VIDEO CONTENT:
- Duration: ${cvaResult.structure.total_duration}s
- Segments: ${cvaResult.structure.segments.length}
- Style: ${cdResult.creative_direction.style}
- Voiceover: ${input.instructions.voiceover ? 'Yes' : 'No'}

AUDIO TRACKS:
${aeResult.audio_tracks.map(track => `  - ${track.id}: ${track.src}`).join('\n')}

Check for:
1. Copyright violations (unauthorized use of copyrighted material)
2. Personal image misuse (using identifiable people without consent)
3. Deepfake risks (harmful face/voice manipulation)
4. Any other safety or compliance concerns

If you identify risks, provide:
- Clear safety_issue flag
- Detailed safety_reason
- Safe alternative with modified instructions if possible

Output your safety assessment as JSON following the required structure.`;
  }

  /**
   * @template T
   * @param {string} response
   * @returns {T}
   */
  parseJSON(response) {
    return LLMClient.parseJSON(response);
  }
}

