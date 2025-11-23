/**
 * Type definitions for the video generation multi-agent system
 * 
 * @typedef {'openai' | 'anthropic' | 'ollama'} LLMProvider
 * 
 * @typedef {Object} LLMConfig
 * @property {LLMProvider} provider
 * @property {string} apiKey
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [maxTokens]
 * 
 * @typedef {Object} VideoSettings
 * @property {string} resolution
 * @property {number} fps
 * @property {string} format
 * @property {string} codec
 * @property {number} crf
 * 
 * @typedef {Object} Asset
 * @property {string} id
 * @property {'image' | 'audio' | 'video'} type
 * @property {string} src
 * 
 * @typedef {Object} Voiceover
 * @property {'tts' | 'file'} type
 * @property {string} [language]
 * @property {string} [text]
 * @property {string} [src]
 * 
 * @typedef {Object} Instructions
 * @property {string} [style]
 * @property {string} [camera_movement]
 * @property {string} [transitions]
 * @property {number} [target_duration]
 * @property {Voiceover} [voiceover]
 * 
 * @typedef {Object} VideoGenerationInput
 * @property {string} project_id
 * @property {VideoSettings} video_settings
 * @property {Asset[]} assets
 * @property {Instructions} instructions
 * 
 * @typedef {Object} KenBurnsPath
 * @property {{x: number, y: number, scale: number}} start
 * @property {{x: number, y: number, scale: number}} end
 * 
 * @typedef {Object} Segment
 * @property {string} id
 * @property {string} asset_id
 * @property {number} start_time
 * @property {number} duration
 * @property {KenBurnsPath} [ken_burns]
 * @property {string} [caption]
 * @property {string} [transition]
 * 
 * @typedef {Object} TimelineEvent
 * @property {string} segment_id
 * @property {number} start_ms
 * @property {number} end_ms
 * @property {Object} transform
 * @property {{start: number, end: number}} [transform.zoom]
 * @property {{start: {x: number, y: number}, end: {x: number, y: number}}} [transform.pan]
 * @property {number} [transform.rotation]
 * @property {Object} [transition]
 * @property {string} transition.type
 * @property {number} transition.duration_ms
 * @property {number} transition.offset_ms
 * 
 * @typedef {Object} AudioTrack
 * @property {string} id
 * @property {string} src
 * @property {number} start_time
 * @property {number} [duration]
 * @property {number} volume
 * @property {Object} [ducking]
 * @property {string} ducking.when
 * @property {number} ducking.target_volume
 * @property {number} ducking.fade_duration
 * 
 * @typedef {Object} AudioMix
 * @property {AudioTrack[]} tracks
 * @property {number} master_volume
 * @property {number} [target_lufs]
 * 
 * @typedef {Object} Subtitle
 * @property {string} id
 * @property {number} start_time
 * @property {number} end_time
 * @property {string} text
 * @property {Object} [style]
 * @property {string} [style.font]
 * @property {number} [style.size]
 * @property {string} [style.color]
 * @property {{x: number, y: number}} [style.position]
 * 
 * @typedef {Object} FFmpegCommand
 * @property {string} command
 * @property {string} description
 * 
 * @typedef {Object} ReactTimeline
 * @property {Array<{id: string, start: number, end: number, asset: string, transforms: any, caption?: string}>} segments
 * @property {Array<{id: string, start: number, end: number, src: string, volume: number}>} audio
 * @property {Array<{id: string, start: number, end: number, text: string}>} subtitles
 * 
 * @typedef {Object} VideoGenerationOutput
 * @property {string} version
 * @property {string} generated_at
 * @property {string} project_id
 * @property {VideoSettings} video_settings
 * @property {Asset[]} assets
 * @property {TimelineEvent[]} timeline
 * @property {AudioMix} audio_mix
 * @property {Subtitle[]} subtitles
 * @property {FFmpegCommand[]} ffmpeg_commands
 * @property {ReactTimeline} react_timeline
 * @property {string[]} assumptions
 * @property {boolean} safety_issue
 * @property {string | null} safety_reason
 * @property {number} total_duration
 * 
 * @typedef {Object} FinalOutput
 * @property {VideoGenerationOutput} json_output
 * @property {string} human_summary
 * 
 * @typedef {Object} CVAResult
 * @property {Object} structure
 * @property {number} structure.total_duration
 * @property {Array<{id: string, asset_id: string, duration: number, order: number}>} structure.segments
 * @property {string} reasoning
 * 
 * @typedef {Object} CDResult
 * @property {Object} creative_direction
 * @property {string} creative_direction.style
 * @property {string} creative_direction.mood
 * @property {string} creative_direction.feel
 * @property {Array<{asset_id: string, ken_burns?: KenBurnsPath, caption?: string, mood_notes?: string, style_notes?: string}>} per_image
 * @property {string[]} transitions
 * @property {Array<{asset_id: string, text: string, timing: {start: number, end: number}}>} captions
 * 
 * @typedef {Object} VEResult
 * @property {TimelineEvent[]} timeline
 * @property {Array<{segment_id: string, transform: {zoom?: {start: number, end: number}, pan?: {start: {x: number, y: number}, end: {x: number, y: number}}, rotation?: number}}>} transforms
 * @property {Array<{segment_id: string, offset_ms: number}>} transition_offsets
 * 
 * @typedef {Object} AEResult
 * @property {AudioTrack[]} audio_tracks
 * @property {Array<{track_id: string, when: string, target_volume: number, fade_duration: number}>} ducking_rules
 * @property {{start: number, end: number}} [music_loop]
 * @property {number} target_lufs
 * @property {string} mixing_instructions
 * 
 * @typedef {Object} SCOResult
 * @property {boolean} safety_issue
 * @property {string | null} safety_reason
 * @property {boolean} copyright_risk
 * @property {boolean} personal_image_risk
 * @property {boolean} deepfake_risk
 * @property {Object} [safe_alternative]
 * @property {Instructions} [safe_alternative.modified_instructions]
 * @property {string[]} [safe_alternative.warnings]
 * 
 * @typedef {Object} OCResult
 * @property {VideoGenerationOutput} output
 * @property {string} human_summary
 */

// Export empty object to maintain module structure
export {};

