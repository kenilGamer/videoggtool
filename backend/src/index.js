/**
 * Main library export for programmatic use
 */

export { VideoGenerationOrchestrator } from './core/orchestrator.js';
export { LLMClient, createLLMClientFromEnv } from './core/llm-client.js';
export { FFmpegCommandBuilder } from './ffmpeg/command-builder.js';
export { FFmpegExecutor } from './ffmpeg/executor.js';

/**
 * Main function for programmatic video generation
 */
import { VideoGenerationOrchestrator } from './core/orchestrator.js';
import { LLMClient } from './core/llm-client.js';

/** 
 * 
 * @typedef {Object} GenerateVideoOptions
 * @property {import('./core/types.js').LLMConfig} [llmConfig]
 * @property {boolean} [executeFfmpeg]
 * @property {boolean} [dryRun]
 * @property {boolean} [verbose]
 * @property {string} [outputDir]
 */

/**
 * Generate video from input
 * @param {import('./core/types.js').VideoGenerationInput} input
 * @param {GenerateVideoOptions} [options]
 * @returns {Promise<import('./core/types.js').FinalOutput>}
 */
export async function generateVideo(input, options = {}) {
  // Create LLM client if config provided
  let llmClient;
  if (options.llmConfig) {
    llmClient = new LLMClient(options.llmConfig);
  }

  // Create orchestrator
  const orchestrator = new VideoGenerationOrchestrator(llmClient);

  // Execute pipeline
  const result = await orchestrator.execute(input);

  // Execute FFmpeg if requested
  if (options.executeFfmpeg || options.dryRun) {
    const { FFmpegExecutor } = await import('./ffmpeg/executor.js');
    const executor = new FFmpegExecutor({
      dryRun: options.dryRun,
      verbose: options.verbose,
      ffmpegPath: process.env.FFMPEG_PATH,
    });

    const available = await executor.checkFFmpegAvailable();
    if (available || options.dryRun) {
      await executor.executeCommands(result.json_output.ffmpeg_commands);
    } else {
      result.json_output.assumptions.push('FFmpeg not available - commands generated but not executed');
    }
  }

  return result;
}

