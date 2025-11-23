/**
 * Input/output validation using Zod
 */

import { z } from 'zod';

// Video settings schema
const VideoSettingsSchema = z.object({
  resolution: z.string().regex(/^\d+x\d+$/),
  fps: z.number().int().positive(),
  format: z.string(),
  codec: z.string(),
  crf: z.number().int().min(0).max(51),
});

// Asset schema
const AssetSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'audio', 'video']),
  src: z.string().url(),
});

// Voiceover schema
const VoiceoverSchema = z.object({
  type: z.enum(['tts', 'file']),
  language: z.string().optional(),
  text: z.string().optional(),
  src: z.string().optional(),
});

// Instructions schema
const InstructionsSchema = z.object({
  style: z.string().optional(),
  camera_movement: z.string().optional(),
  transitions: z.string().optional(),
  target_duration: z.number().positive().optional(),
  voiceover: VoiceoverSchema.optional(),
});

// Input schema
export const VideoGenerationInputSchema = z.object({
  project_id: z.string().min(1),
  video_settings: VideoSettingsSchema,
  assets: z.array(AssetSchema).min(1),
  instructions: InstructionsSchema,
});

/**
 * Validate video generation input
 * @param {unknown} input
 * @returns {import('./types.js').VideoGenerationInput}
 */
export function validateInput(input) {
  return VideoGenerationInputSchema.parse(input);
}

/**
 * Validate video generation output (basic structure check)
 * @param {unknown} output
 * @returns {import('./types.js').VideoGenerationOutput}
 */
export function validateOutput(output) {
  // Basic validation - full schema would be more complex
  if (typeof output !== 'object' || output === null) {
    throw new Error('Output must be an object');
  }

  const out = output;

  if (!out.version || !out.project_id || !out.video_settings) {
    throw new Error('Output missing required fields: version, project_id, or video_settings');
  }

  if (!Array.isArray(out.timeline) || !Array.isArray(out.assets)) {
    throw new Error('Output timeline and assets must be arrays');
  }

  return out;
}

