/**
 * Output Compiler (OC) Agent
 * Responsibilities: Merge results from all previous roles, produce strict JSON output
 */

import { LLMClient } from '../core/llm-client.js';
import { FFmpegCommandBuilder } from '../ffmpeg/command-builder.js';

export class OC {
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
   * @param {import('../core/types.js').AEResult} aeResult
   * @param {import('../core/types.js').SCOResult} scoResult
   * @returns {Promise<import('../core/types.js').FinalOutput>}
   */
  async execute(input, cvaResult, cdResult, veResult, aeResult, scoResult) {
    // Build the output structure
    const output = this.buildOutput(input, cvaResult, cdResult, veResult, aeResult, scoResult);
    
    // Generate human summary
    const summary = await this.generateSummary(input, output);
    
    return {
      json_output: output,
      human_summary: summary,
    };
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @param {import('../core/types.js').CDResult} cdResult
   * @param {import('../core/types.js').VEResult} veResult
   * @param {import('../core/types.js').AEResult} aeResult
   * @param {import('../core/types.js').SCOResult} scoResult
   * @returns {import('../core/types.js').VideoGenerationOutput}
   */
  buildOutput(input, cvaResult, cdResult, veResult, aeResult, scoResult) {
    // Build subtitles from CD captions
    const subtitles = cdResult.captions.map((caption, index) => ({
      id: `subtitle_${index + 1}`,
      start_time: caption.timing.start,
      end_time: caption.timing.end,
      text: caption.text,
    }));

    // Build React timeline
    const reactTimeline = {
      segments: veResult.timeline.map(event => {
        const segment = cvaResult.structure.segments.find(s => s.id === event.segment_id);
        const imageData = cdResult.per_image.find(img => img.asset_id === segment?.asset_id);
        const caption = cdResult.captions.find(c => c.asset_id === segment?.asset_id);
        
        return {
          id: event.segment_id,
          start: event.start_ms / 1000,
          end: event.end_ms / 1000,
          asset: segment?.asset_id || '',
          transforms: event.transform,
          caption: caption?.text,
        };
      }),
      audio: aeResult.audio_tracks.map(track => ({
        id: track.id,
        start: track.start_time,
        end: track.start_time + (track.duration || 0),
        src: track.src,
        volume: track.volume,
      })),
      subtitles: subtitles.map(sub => ({
        id: sub.id,
        start: sub.start_time,
        end: sub.end_time,
        text: sub.text,
      })),
    };

    // Build output object first (without ffmpeg_commands)
    const output = {
      version: 'v3.0-company',
      generated_at: new Date().toISOString(),
      project_id: input.project_id,
      video_settings: input.video_settings,
      assets: input.assets,
      timeline: veResult.timeline,
      audio_mix: {
        tracks: aeResult.audio_tracks,
        master_volume: 1.0,
        target_lufs: aeResult.target_lufs,
      },
      subtitles,
      ffmpeg_commands: [], // Will be populated below
      react_timeline: reactTimeline,
      assumptions: this.buildAssumptions(cvaResult, cdResult, veResult, aeResult),
      safety_issue: scoResult.safety_issue,
      safety_reason: scoResult.safety_reason,
      total_duration: cvaResult.structure.total_duration,
    };

    // Build FFmpeg commands using command builder
    const commandBuilder = new FFmpegCommandBuilder(process.env.OUTPUT_DIR || './output');
    output.ffmpeg_commands = commandBuilder.buildCommands(output);

    return output;
  }

  /**
   * @param {import('../core/types.js').CVAResult} cvaResult
   * @param {import('../core/types.js').CDResult} cdResult
   * @param {import('../core/types.js').VEResult} veResult
   * @param {import('../core/types.js').AEResult} aeResult
   * @returns {string[]}
   */
  buildAssumptions(cvaResult, cdResult, veResult, aeResult) {
    const assumptions = [];
    
    assumptions.push(`Video duration set to ${cvaResult.structure.total_duration}s based on ${cvaResult.structure.segments.length} segments`);
    assumptions.push(`Creative style: ${cdResult.creative_direction.style}, mood: ${cdResult.creative_direction.mood}`);
    assumptions.push(`Timeline contains ${veResult.timeline.length} events with precise millisecond timing`);
    assumptions.push(`Audio mix includes ${aeResult.audio_tracks.length} tracks with target LUFS of ${aeResult.target_lufs}`);
    
    return assumptions;
  }

  /**
   * @param {import('../core/types.js').VideoGenerationInput} input
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {Promise<string>}
   */
  async generateSummary(input, output) {
    const prompt = `Generate a concise human-readable summary (max 25 words) for this video generation project:

Project: ${input.project_id}
Duration: ${output.total_duration}s
Segments: ${output.timeline.length}
Style: ${input.instructions.style || 'default'}
Safety: ${output.safety_issue ? 'Issues flagged' : 'Clean'}

Summary (max 25 words):`;

    const response = await this.llmClient.generate(prompt);
    return response.content.trim().substring(0, 150); // Ensure reasonable length
  }
}

