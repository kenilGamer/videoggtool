/**
 * Chief Video Architect (CVA) Agent
 * Responsibilities: Understand user intent, define video structure, determine timeline length, segment flow
 */

import { LLMClient } from '../core/llm-client.js';

export class CVA {
  /**
   * @param {LLMClient} llmClient
   */
  constructor(llmClient) {
    this.llmClient = llmClient;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @returns {Promise<import('../core/types.js').CVAResult>}
   */
  async execute(input) {
    const prompt = this.buildPrompt(input);
    const systemPrompt = this.getSystemPrompt();

    const response = await this.llmClient.generate(prompt, systemPrompt);
    const result = this.parseJSON(response.content);

    // Validate result structure
    if (!result.structure || !result.structure.segments) {
      throw new Error('Invalid CVA result: missing structure or segments');
    }

    return result;
  }

  getSystemPrompt() {
    return `You are the Chief Video Architect (CVA) for a video generation company.

Your responsibilities:
1. Understand the user's intent from their instructions
2. Define the structure of the video
3. Determine timeline length and segment flow
4. Plan transitions and pacing
5. Assign tasks to other roles

You must output ONLY valid JSON (no markdown, no code blocks, no explanations outside the JSON). Use this exact structure:
{
  "structure": {
    "total_duration": <number in seconds>,
    "segments": [
      {
        "id": "segment_1",
        "asset_id": "img1",
        "duration": <number in seconds>,
        "order": 1
      }
    ]
  },
  "reasoning": "<explanation of your decisions>"
}

CRITICAL RULES:
1. Output ONLY the JSON object - no markdown, no code blocks, no text before or after
2. All strings must be on a single line (no newlines inside string values)
3. All property names must be in double quotes
4. All string values must be in double quotes (not single quotes)
5. Use commas to separate all properties
6. Do not include trailing commas before closing braces or brackets
7. The JSON must be valid and parseable

Consider:
- Target duration from instructions
- Number of assets available
- Natural pacing (typically 3-5 seconds per image)
- Smooth flow between segments
- User's style preferences`;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @returns {string}
   */
  buildPrompt(input) {
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

Output your plan as JSON following the required structure.`;
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

