/**
 * Audio Engineer (AE) Agent
 * Responsibilities: Manage music, TTS, voiceover, ducking, normalize audio levels
 */

import { LLMClient } from '../core/llm-client.js';

const { parseJSON } = LLMClient;

export class AE {
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
   * @returns {Promise<import('../core/types.js').AEResult>}
   */
  async execute(input, cvaResult, cdResult, veResult) {
    const prompt = this.buildPrompt(input, cvaResult, cdResult, veResult);
    const systemPrompt = this.getSystemPrompt();

    const response = await this.llmClient.generate(prompt, systemPrompt);
    const result = this.parseJSON(response.content);

    // Validate result
    if (!result.audio_tracks || !Array.isArray(result.audio_tracks)) {
      throw new Error('Invalid AE result: missing audio_tracks array');
    }

    return result;
  }

  getSystemPrompt() {
    return `You are the Audio Engineer (AE) for a video generation company.

Your responsibilities:
1. Manage music, TTS, voiceover tracks
2. Normalize audio levels
3. Compute ducking rules (lower music when voiceover plays)
4. Suggest final LUFS (Loudness Units relative to Full Scale)
5. Generate audio mixing instructions

You must output a JSON object with this structure:
{
  "audio_tracks": [
    {
      "id": "music_1",
      "src": "<audio source>",
      "start_time": 0,
      "duration": 12,
      "volume": 0.7,
      "ducking": {
        "when": "voiceover",
        "target_volume": 0.3,
        "fade_duration": 0.5
      }
    },
    {
      "id": "voiceover_1",
      "src": "<tts or file>",
      "start_time": 0,
      "duration": 10,
      "volume": 1.0
    }
  ],
  "ducking_rules": [
    {
      "track_id": "music_1",
      "when": "voiceover",
      "target_volume": 0.3,
      "fade_duration": 0.5
    }
  ],
  "music_loop": {
    "start": 0,
    "end": 12
  },
  "target_lufs": -16,
  "mixing_instructions": "<text description of mixing approach>"
}

Audio guidelines:
- Volume: 0.0 to 1.0 (1.0 = full volume)
- Music typically: 0.6-0.8 when solo, 0.2-0.4 when ducked
- Voiceover: 0.9-1.0
- Target LUFS: -16 to -14 for web content
- Ducking: Lower music volume when voiceover is active
- Fade duration: 0.3-0.8 seconds for smooth transitions`;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @param {import('../core/types.js').CDResult} cdResult
   * @param {import('../core/types.js').VEResult} veResult
   * @returns {string}
   */
  buildPrompt(input, cvaResult, cdResult, veResult) {
    const audioAssets = input.assets.filter(a => a.type === 'audio');
    const totalDuration = cvaResult.structure.total_duration;

    const audioList = audioAssets
      .map(asset => `  - ${asset.id}: ${asset.src}`)
      .join('\n');

    return `Create audio mix for this video:

PROJECT: ${input.project_id}

VIDEO DURATION: ${totalDuration} seconds

AUDIO ASSETS:
${audioList || '  - None provided'}

VOICEOVER INSTRUCTIONS:
${input.instructions.voiceover ? JSON.stringify(input.instructions.voiceover, null, 2) : '  - None'}

TIMELINE (from VE):
- Total segments: ${veResult.timeline.length}
- Timeline spans: ${veResult.timeline[0]?.start_ms || 0}ms to ${veResult.timeline[veResult.timeline.length - 1]?.end_ms || 0}ms

Create audio mix that:
1. Uses all provided audio assets (music, etc.)
2. Handles voiceover (TTS or file) if specified
3. Implements ducking (lower music when voiceover plays)
4. Loops music if needed to fill duration
5. Sets appropriate volume levels
6. Provides target LUFS for normalization

Output your audio mix plan as JSON following the required structure.`;
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

