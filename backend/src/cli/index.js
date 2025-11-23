#!/usr/bin/env node

/**
 * CLI interface for video generation tool
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { VideoGenerationOrchestrator } from '../core/orchestrator.js';
import { FFmpegExecutor } from '../ffmpeg/executor.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('videoggtool')
  .description('Multi-agent video generation system')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate video from JSON input')
  .option('-i, --input <file>', 'Input JSON file (or use stdin)')
  .option('-o, --output <file>', 'Output JSON file (default: stdout)')
  .option('--execute-ffmpeg', 'Execute FFmpeg commands automatically', false)
  .option('--dry-run', 'Generate commands without executing', false)
  .option('--verbose', 'Verbose output', false)
  .action(async (options) => {
    try {
      // Read input
      let inputData;
      if (options.input) {
        inputData = fs.readFileSync(options.input, 'utf-8');
      } else {
        // Read from stdin
        inputData = await readStdin();
      }

      const input = JSON.parse(inputData);

      // Create orchestrator
      const orchestrator = new VideoGenerationOrchestrator();

      // Execute pipeline
      console.log('Starting video generation pipeline...\n');
      const result = await orchestrator.execute(input);

      // Update FFmpeg commands in output if needed
      if (options.executeFfmpeg || options.dryRun) {
        const executor = new FFmpegExecutor({
          dryRun: options.dryRun,
          verbose: options.verbose,
          ffmpegPath: process.env.FFMPEG_PATH,
        });

        const available = await executor.checkFFmpegAvailable();
        if (!available && !options.dryRun) {
          console.warn('⚠️  FFmpeg not found. Commands generated but not executed.');
        } else {
          console.log('\n📹 Executing FFmpeg commands...\n');
          await executor.executeCommands(result.json_output.ffmpeg_commands);
        }
      }

      // Output result
      const outputJson = JSON.stringify(result, null, 2);
      
      if (options.output) {
        fs.writeFileSync(options.output, outputJson, 'utf-8');
        console.log(`\n✅ Output written to ${options.output}`);
      } else {
        console.log('\n📄 Output:\n');
        console.log(outputJson);
      }

      // Print summary
      console.log(`\n📊 Summary: ${result.human_summary}`);
      if (result.json_output.safety_issue) {
        console.log(`\n⚠️  Safety Issue: ${result.json_output.safety_reason}`);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate input JSON file')
  .argument('<file>', 'Input JSON file to validate')
  .action((file) => {
    try {
      const inputData = fs.readFileSync(file, 'utf-8');
      const input = JSON.parse(inputData);

      // Basic validation
      if (!input.project_id) {
        throw new Error('Missing project_id');
      }
      if (!input.video_settings) {
        throw new Error('Missing video_settings');
      }
      if (!input.assets || input.assets.length === 0) {
        throw new Error('Missing or empty assets array');
      }
      if (!input.instructions) {
        throw new Error('Missing instructions');
      }

      console.log('✅ Input JSON is valid');
    } catch (error) {
      console.error('❌ Validation error:', error.message);
      process.exit(1);
    }
  });

// Helper function to read from stdin
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data);
    });
    
    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}

// Parse command line arguments
program.parse();

