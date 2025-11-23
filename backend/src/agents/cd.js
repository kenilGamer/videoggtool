/**
 * Creative Director (CD) Agent
 * Responsibilities: Create creative direction, generate Ken Burns motion paths, suggest transitions, captions
 */

import { LLMClient } from '../core/llm-client.js';

const { parseJSON } = LLMClient;

export class CD {
  /**
   * @param {LLMClient} llmClient
   */
  constructor(llmClient) {
    this.llmClient = llmClient;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @returns {Promise<import('../core/types.js').CDResult>}
   */
  async execute(input, cvaResult) {
    const prompt = this.buildPrompt(input, cvaResult);
    const systemPrompt = this.getSystemPrompt();

    const response = await this.llmClient.generate(prompt, systemPrompt);
    const result = this.parseJSON(response.content);

    // Validate result
    if (!result.creative_direction || !result.per_image) {
      throw new Error('Invalid CD result: missing creative_direction or per_image');
    }

    return result;
  }

  getSystemPrompt() {
    return `You are the Creative Director (CD) for a video generation company.

Your responsibilities:
1. Create the creative direction: style, mood, feel
2. Generate Ken Burns motion paths for images
3. Suggest transitions and layouts
4. Create captions and emotional storytelling direction

You must output a JSON object with this structure:
{
  "creative_direction": {
    "style": "<style description>",
    "mood": "<mood description>",
    "feel": "<emotional feel>"
  },
  "per_image": [
    {
      "asset_id": "img1",
      "ken_burns": {
        "start": { "x": 0.5, "y": 0.5, "scale": 1.0 },
        "end": { "x": 0.6, "y": 0.4, "scale": 1.2 }
      },
      "caption": "<optional caption text>",
      "mood_notes": "<mood notes for this image>",
      "style_notes": "<style notes for this image>"
    }
  ],
  "transitions": ["crossfade", "fade", ...],
  "captions": [
    {
      "asset_id": "img1",
      "text": "<caption text>",
      "timing": { "start": 0, "end": 3 }
    }
  ]
}

Ken Burns coordinates:
- x, y: 0.0 to 1.0 (0.5 is center)
- scale: 1.0 = no zoom, >1.0 = zoom in, <1.0 = zoom out
- Typical Ken Burns: start at center (0.5, 0.5) scale 1.0, end with slight pan and zoom (1.1-1.3x)`;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @returns {string}
   */
  buildPrompt(input, cvaResult) {
    const segmentsList = cvaResult.structure.segments
      .map(seg => `  - ${seg.id}: ${seg.asset_id} (${seg.duration}s)`)
      .join('\n');

    const imageAssets = input.assets.filter(a => a.type === 'image');

    return `Create the creative direction for this video:

PROJECT: ${input.project_id}

VIDEO STRUCTURE (from CVA):
- Total Duration: ${cvaResult.structure.total_duration}s
- Segments:
${segmentsList}

USER INSTRUCTIONS:
- Style: ${input.instructions.style || 'not specified'}
- Camera Movement: ${input.instructions.camera_movement || 'kenburns'}
- Transitions: ${input.instructions.transitions || 'crossfade'}

IMAGES TO PROCESS:
${imageAssets.map(img => `  - ${img.id}: ${img.src}`).join('\n')}

For each image:
1. Create Ken Burns motion path (if camera_movement is kenburns)
2. Generate appropriate caption if needed
3. Define mood and style notes
4. Suggest transition type

Output your creative direction as JSON following the required structure.`;
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

