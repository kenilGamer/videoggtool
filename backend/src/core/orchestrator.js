/**
 * Main orchestrator that executes agents sequentially and manages data flow
 */

import { createLLMClientFromEnv } from './llm-client.js';
import { validateInput } from './validation.js';
import { CVA } from '../agents/cva.js';
import { CD } from '../agents/cd.js';
import { VE } from '../agents/ve.js';
import { AE } from '../agents/ae.js';
import { SCO } from '../agents/sco.js';
import { OC } from '../agents/oc.js';

export class VideoGenerationOrchestrator {
  /**
   * @param {import('./llm-client.js').LLMClient} [llmClient]
   */
  constructor(llmClient) {
    const client = llmClient || createLLMClientFromEnv();
    
    this.cva = new CVA(client);
    this.cd = new CD(client);
    this.ve = new VE(client);
    this.ae = new AE(client);
    this.sco = new SCO(client);
    this.oc = new OC(client);
  }

  /**
   * Execute the full video generation pipeline
   * @param {import('./types.js').VideoGenerationInput} input
   * @returns {Promise<import('./types.js').FinalOutput>}
   */
  async execute(input) {
    try {
      // Validate input
      validateInput(input);

      // Role 1: Chief Video Architect
      console.log('🎬 Role 1: Chief Video Architect (CVA) - Planning video structure...');
      const cvaResult = await this.cva.execute(input);

      // Role 2: Creative Director
      console.log('🎨 Role 2: Creative Director (CD) - Creating creative direction...');
      const cdResult = await this.cd.execute(input, cvaResult);

      // Role 3: Video Engineer
      console.log('⚙️  Role 3: Video Engineer (VE) - Building technical timeline...');
      const veResult = await this.ve.execute(input, cvaResult, cdResult);

      // Role 4: Audio Engineer
      console.log('🎵 Role 4: Audio Engineer (AE) - Mixing audio tracks...');
      const aeResult = await this.ae.execute(input, cvaResult, cdResult, veResult);

      // Role 5: Safety & Compliance Officer
      console.log('🛡️  Role 5: Safety & Compliance Officer (SCO) - Checking safety...');
      const scoResult = await this.sco.execute(input, cvaResult, cdResult, veResult, aeResult);

      // If safety issues found, log warning but continue
      if (scoResult.safety_issue) {
        console.warn('⚠️  Safety issues detected:', scoResult.safety_reason);
      }

      // Role 6: Output Compiler
      console.log('📦 Role 6: Output Compiler (OC) - Compiling final output...');
      const finalOutput = await this.oc.execute(
        input,
        cvaResult,
        cdResult,
        veResult,
        aeResult,
        scoResult
      );

      console.log('✅ Video generation pipeline completed successfully!');
      return finalOutput;
    } catch (error) {
      console.error('❌ Error in video generation pipeline:', error);
      throw error;
    }
  }
}

