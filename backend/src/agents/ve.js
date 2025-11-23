/**
 * Video Engineer (VE) Agent
 * Responsibilities: Convert creative direction into technical timeline events with millisecond precision
 */

import { LLMClient } from '../core/llm-client.js';

const { parseJSON } = LLMClient;

export class VE {
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
   * @returns {Promise<import('../core/types.js').VEResult>}
   */
  async execute(input, cvaResult, cdResult) {
    const prompt = this.buildPrompt(input, cvaResult, cdResult);
    const systemPrompt = this.getSystemPrompt();

    const response = await this.llmClient.generate(prompt, systemPrompt);
    const result = this.parseJSON(response.content);

    // Validate result
    if (!result.timeline || !Array.isArray(result.timeline)) {
      throw new Error('Invalid VE result: missing timeline array');
    }

    return result;
  }

  getSystemPrompt() {
    return `You are the Video Engineer (VE) for a video generation company.

Your responsibilities:
1. Convert creative direction into technical timeline events
2. Assign segment timings to the millisecond
3. Handle transitions, offsets, overlaps
4. Generate FFmpeg-friendly transform data

You must output a JSON object with this structure:
{
  "timeline": [
    {
      "segment_id": "segment_1",
      "start_ms": 0,
      "end_ms": 3000,
      "transform": {
        "zoom": { "start": 1.0, "end": 1.2 },
        "pan": { "start": { "x": 0.5, "y": 0.5 }, "end": { "x": 0.6, "y": 0.4 } },
        "rotation": 0
      },
      "transition": {
        "type": "crossfade",
        "duration_ms": 500,
        "offset_ms": 2500
      }
    }
  ],
  "transforms": [
    {
      "segment_id": "segment_1",
      "transform": { ... }
    }
  ],
  "transition_offsets": [
    {
      "segment_id": "segment_1",
      "offset_ms": 2500
    }
  ]
}

Important:
- All times in milliseconds (ms)
- Transitions should overlap segments (offset_ms is when transition starts relative to segment start)
- Zoom values: 1.0 = no zoom, >1.0 = zoom in
- Pan coordinates: 0.0-1.0 (0.5 is center)
- Ensure no gaps between segments (end_ms of one = start_ms of next)`;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @param {import('../core/types.js').CDResult} cdResult
   * @returns {string}
   */
  buildPrompt(input, cvaResult, cdResult) {
    const segmentsList = cvaResult.structure.segments
      .map(seg => `  - ${seg.id}: ${seg.asset_id} (${seg.duration}s, order ${seg.order})`)
      .join('\n');

    const kenBurnsList = cdResult.per_image
      .filter(img => img.ken_burns)
      .map(img => `  - ${img.asset_id}: ${JSON.stringify(img.ken_burns)}`)
      .join('\n');

    return `Create precise technical timeline for this video:

PROJECT: ${input.project_id}

VIDEO SETTINGS:
- FPS: ${input.video_settings.fps}
- Resolution: ${input.video_settings.resolution}

SEGMENTS (from CVA):
${segmentsList}

CREATIVE DIRECTION (from CD):
- Style: ${cdResult.creative_direction.style}
- Mood: ${cdResult.creative_direction.mood}
- Transitions: ${cdResult.transitions.join(', ')}

KEN BURNS PATHS:
${kenBurnsList || '  - None specified'}

Create a precise timeline with:
1. Exact millisecond timings for each segment
2. Transform data (zoom, pan) based on Ken Burns paths
3. Transition offsets and durations
4. No gaps or overlaps (except intentional transition overlaps)

Output your technical timeline as JSON following the required structure.`;
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

