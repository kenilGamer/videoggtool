/**
 * FFmpeg command builder for video generation
 * Handles Ken Burns effects, transitions, and audio mixing
 */

import * as path from 'path';
import * as fs from 'fs';

export class FFmpegCommandBuilder {
  /**
   * @param {string} [outputDir]
   */
  constructor(outputDir = './output') {
    this.outputDir = outputDir;
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Build FFmpeg commands from video generation output
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {import('../core/types.js').FFmpegCommand[]}
   */
  buildCommands(output) {
    const commands = [];

    // Step 1: Process each segment with Ken Burns effects
    const segmentCommands = this.buildSegmentCommands(output);
    commands.push(...segmentCommands);

    // Step 2: Create transition effects
    const transitionCommands = this.buildTransitionCommands(output);
    commands.push(...transitionCommands);

    // Step 3: Concatenate segments
    const concatCommand = this.buildConcatCommand(output);
    commands.push(concatCommand);

    // Step 4: Add audio tracks with ducking
    const audioCommand = this.buildAudioCommand(output);
    commands.push(audioCommand);

    // Step 5: Add subtitles
    const subtitleCommand = this.buildSubtitleCommand(output);
    if (subtitleCommand) {
      commands.push(subtitleCommand);
    }

    // Step 6: Final encoding
    const finalCommand = this.buildFinalCommand(output);
    commands.push(finalCommand);

    return commands;
  }

  /**
   * Build commands to process individual segments with Ken Burns
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {import('../core/types.js').FFmpegCommand[]}
   */
  buildSegmentCommands(output) {
    const commands = [];

    for (const event of output.timeline) {
      const asset = output.assets.find(a => {
        const segment = output.react_timeline.segments.find(s => s.id === event.segment_id);
        return segment && a.id === segment.asset;
      });

      if (!asset || asset.type !== 'image') {
        continue;
      }

      const duration = (event.end_ms - event.start_ms) / 1000;
      const outputFile = path.join(this.outputDir, `segment_${event.segment_id}.mp4`);

      let filter = this.buildKenBurnsFilter(event, output.video_settings);

      const command = `ffmpeg -loop 1 -i "${asset.src}" -vf "${filter}" -t ${duration} -pix_fmt yuv420p -c:v libx264 "${outputFile}"`;

      commands.push({
        command,
        description: `Process segment ${event.segment_id} with Ken Burns effect`,
      });
    }

    return commands;
  }

  /**
   * Build Ken Burns filter string
   * @param {import('../core/types.js').TimelineEvent} event
   * @param {import('../core/types.js').VideoSettings} videoSettings
   * @returns {string}
   */
  buildKenBurnsFilter(event, videoSettings) {
    const [width, height] = videoSettings.resolution.split('x').map(Number);
    const duration = (event.end_ms - event.start_ms) / 1000;
    const fps = videoSettings.fps;

    const transform = event.transform;
    if (!transform.zoom && !transform.pan) {
      // No transform, just scale to fit
      return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
    }

    // Calculate zoom values
    const startZoom = transform.zoom?.start || 1.0;
    const endZoom = transform.zoom?.end || 1.0;

    // Calculate pan positions
    const startX = transform.pan?.start.x || 0.5;
    const startY = transform.pan?.start.y || 0.5;
    const endX = transform.pan?.end.x || 0.5;
    const endY = transform.pan?.end.y || 0.5;

    // Build zoompan filter for Ken Burns effect
    // zoompan calculates: zoom, x, y over time
    const zoomExpr = `zoom=${startZoom}+((${endZoom}-${startZoom})*t/${duration})`;
    const xExpr = `x=${startX}*iw-iw/zoom/2+(((${endX}-${startX})*iw)*t/${duration})`;
    const yExpr = `y=${startY}*ih-ih/zoom/2+(((${endY}-${startY})*ih)*t/${duration})`;

    // Use zoompan filter for smooth Ken Burns
    const filter = `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${duration * fps}:s=${width}x${height}`;

    return filter;
  }

  /**
   * Build transition commands
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {import('../core/types.js').FFmpegCommand[]}
   */
  buildTransitionCommands(output) {
    // For now, transitions are handled in the concat step
    // Crossfade transitions can be added using xfade filter
    const commands = [];

    // This is a placeholder - full transition implementation would require
    // more complex filter chains
    if (output.timeline.length > 1) {
      commands.push({
        command: '# Transitions handled in concat step',
        description: 'Crossfade transitions applied during concatenation',
      });
    }

    return commands;
  }

  /**
   * Build concatenation command
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {import('../core/types.js').FFmpegCommand}
   */
  buildConcatCommand(output) {
    const concatFile = path.join(this.outputDir, 'concat.txt');
    const segments = [];

    for (const event of output.timeline) {
      const segmentFile = path.join(this.outputDir, `segment_${event.segment_id}.mp4`);
      segments.push(`file '${segmentFile}'`);
    }

    fs.writeFileSync(concatFile, segments.join('\n'));

    const outputFile = path.join(this.outputDir, 'video_no_audio.mp4');
    const command = `ffmpeg -f concat -safe 0 -i "${concatFile}" -c copy "${outputFile}"`;

    return {
      command,
      description: 'Concatenate all video segments',
    };
  }

  /**
   * Build audio mixing command with ducking
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {import('../core/types.js').FFmpegCommand}
   */
  buildAudioCommand(output) {
    const videoFile = path.join(this.outputDir, 'video_no_audio.mp4');
    const outputFile = path.join(this.outputDir, 'video_with_audio.mp4');

    const audioInputs = [];
    const audioFilters = [];
    let audioIndex = 1; // Start after video input (index 0)

    // Add video input
    audioInputs.push(`-i "${videoFile}"`);

    // Process each audio track
    for (const track of output.audio_mix.tracks) {
      audioInputs.push(`-i "${track.src}"`);

      // Build volume and ducking filters
      let filter = `[${audioIndex}:a]volume=${track.volume}`;

      // Apply ducking if specified
      if (track.ducking) {
        // Ducking is complex - simplified version
        // Full implementation would use adelay and volume filters
        filter += `,volume=${track.ducking.target_volume}:enable='between(t,${track.start_time},${track.start_time + (track.duration || 0)})'`;
      }

      audioFilters.push(filter);
      audioIndex++;
    }

    // Mix all audio tracks
    const mixFilter = audioFilters.length > 1
      ? `${audioFilters.join(';')};${audioFilters.map((_, i) => `[${i + 1}:a]`).join('')}amix=inputs=${audioFilters.length}:duration=longest`
      : audioFilters[0];

    const command = `ffmpeg ${audioInputs.join(' ')} -filter_complex "${mixFilter}" -c:v copy -c:a aac -b:a 192k "${outputFile}"`;

    return {
      command,
      description: 'Mix audio tracks with ducking',
    };
  }

  /**
   * Build subtitle command
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {import('../core/types.js').FFmpegCommand | null}
   */
  buildSubtitleCommand(output) {
    if (output.subtitles.length === 0) {
      return null;
    }

    // Create SRT file
    const srtFile = path.join(this.outputDir, 'subtitles.srt');
    let srtContent = '';

    for (let i = 0; i < output.subtitles.length; i++) {
      const sub = output.subtitles[i];
      const startTime = this.formatSRTTime(sub.start_time);
      const endTime = this.formatSRTTime(sub.end_time);

      srtContent += `${i + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${sub.text}\n\n`;
    }

    fs.writeFileSync(srtFile, srtContent);

    const inputFile = path.join(this.outputDir, 'video_with_audio.mp4');
    const outputFile = path.join(this.outputDir, 'video_with_subtitles.mp4');
    const command = `ffmpeg -i "${inputFile}" -vf "subtitles=${srtFile}" -c:a copy "${outputFile}"`;

    return {
      command,
      description: 'Add subtitles to video',
    };
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   * @param {number} seconds
   * @returns {string}
   */
  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
  }

  /**
   * Build final encoding command
   * @param {import('../core/types.js').VideoGenerationOutput} output
   * @returns {import('../core/types.js').FFmpegCommand}
   */
  buildFinalCommand(output) {
    const inputFile = path.join(this.outputDir, output.subtitles.length > 0 ? 'video_with_subtitles.mp4' : 'video_with_audio.mp4');
    const finalOutput = path.join(this.outputDir, `${output.project_id}.${output.video_settings.format}`);

    const { resolution, fps, codec, crf } = output.video_settings;

    const command = `ffmpeg -i "${inputFile}" -s ${resolution} -r ${fps} -c:v ${codec} -crf ${crf} -preset slow -c:a aac -b:a 192k "${finalOutput}"`;

    return {
      command,
      description: 'Final video encoding with specified settings',
    };
  }
}

