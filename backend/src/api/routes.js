/**
 * API route handlers
 */

import { Router } from 'express';
import { VideoGenerationOrchestrator } from '../core/orchestrator.js';
import { FFmpegExecutor } from '../ffmpeg/executor.js';

const router = Router();

/**
 * POST /generate
 * Generate video from input JSON
 */
router.post('/generate', async (req, res) => {
  try {
    const input = req.body;

    // Validate input
    if (!input.project_id || !input.video_settings || !input.assets || !input.instructions) {
      return res.status(400).json({
        error: 'Invalid input: missing required fields',
        required: ['project_id', 'video_settings', 'assets', 'instructions'],
      });
    }

    // Create orchestrator
    const orchestrator = new VideoGenerationOrchestrator();

    // Execute pipeline
    const result = await orchestrator.execute(input);

    // Check if FFmpeg execution is requested
    const executeFfmpeg = req.query.execute === 'true' || req.body.execute_ffmpeg === true;
    const dryRun = req.query.dry_run === 'true' || req.body.dry_run === true;

    if (executeFfmpeg || dryRun) {
      const executor = new FFmpegExecutor({
        dryRun,
        verbose: req.query.verbose === 'true',
        ffmpegPath: process.env.FFMPEG_PATH,
      });

      const available = await executor.checkFFmpegAvailable();
      if (!available && !dryRun) {
        result.json_output.assumptions.push('FFmpeg not available - commands generated but not executed');
      } else {
        try {
          await executor.executeCommands(result.json_output.ffmpeg_commands);
          result.json_output.assumptions.push('FFmpeg commands executed successfully');
        } catch (error) {
          result.json_output.assumptions.push(`FFmpeg execution error: ${error.message}`);
        }
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /generate:', error);
    res.status(500).json({
      error: 'Video generation failed',
      message: error.message,
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;

