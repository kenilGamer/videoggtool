/**
 * Zod schemas for video structure validation
 */

import { z } from 'zod';

export const SegmentSchema = z.object({
  id: z.string(),
  asset_id: z.string(),
  duration: z.number().positive(),
  order: z.number().int().positive(),
  transition_type: z.string().nullable().optional(),
});

export const StructureSchema = z.object({
  total_duration: z.number().positive(),
  segments: z.array(SegmentSchema).nonempty(),
  voiceover_duration: z.number().nonnegative(),
  voiceover_start: z.number().nonnegative(),
});

export const RootSchema = z.object({
  structure: StructureSchema,
  reasoning: z.string().optional(),
});

