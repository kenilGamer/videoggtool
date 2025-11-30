/**
 * Chief Video Architect (CVA) Agent
 * Responsibilities: Understand user intent, define video structure, determine timeline length, segment flow
 */

import { LLMClient } from '../core/llm-client.js';
import { generateVideoStructure } from '../core/video-orchestrator.js';

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
    // Use the new orchestrator with automatic repair/retry
    const result = await generateVideoStructure(this.llmClient, input, 3);

    // Ensure reasoning field exists (for backward compatibility)
    if (!result.reasoning) {
      result.reasoning = 'Video structure generated successfully.';
    }

    return result;
  }
}

