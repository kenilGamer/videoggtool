#!/usr/bin/env node

/**
 * Simple application entry point for video generation
 * Usage: node app.js [input-file]
 */

import { generateVideo } from './src/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Get input file from command line or use default
    const inputFile = process.argv[2] || 'example-input.json';
    
    console.log(`📖 Reading input from: ${inputFile}\n`);
    
    // Check if file exists
    if (!fs.existsSync(inputFile)) {
      console.error(`❌ Error: Input file not found: ${inputFile}`);
      console.log('\nUsage: node app.js [input-file]');
      console.log('Example: node app.js example-input.json');
      process.exit(1);
    }

    // Read and parse input
    const inputData = fs.readFileSync(inputFile, 'utf-8');
    const input = JSON.parse(inputData);

    console.log('🚀 Starting video generation...\n');

    // Generate video
    const result = await generateVideo(input, {
      executeFfmpeg: false, // Set to true to execute FFmpeg commands
      dryRun: false,
      verbose: true,
    });

    // Output result
    const outputFile = `output-${input.project_id}.json`;
    const outputJson = JSON.stringify(result, null, 2);
    
    fs.writeFileSync(outputFile, outputJson, 'utf-8');
    
    console.log(`\n✅ Video generation completed!`);
    console.log(`📄 Output written to: ${outputFile}`);
    console.log(`\n📊 Summary: ${result.human_summary}`);
    
    if (result.json_output.safety_issue) {
      console.log(`\n⚠️  Safety Issue: ${result.json_output.safety_reason}`);
    }

    console.log(`\n🎬 Timeline: ${result.json_output.timeline.length} segments`);
    console.log(`🎵 Audio tracks: ${result.json_output.audio_mix.tracks.length}`);
    console.log(`📝 Subtitles: ${result.json_output.subtitles.length}`);
    console.log(`⚙️  FFmpeg commands: ${result.json_output.ffmpeg_commands.length}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Provide helpful guidance for common errors
    if (error.message.includes('OPENAI_API_KEY')) {
      console.error('\n💡 To fix this:');
      console.error('   1. Create a .env file in the backend directory');
      console.error('   2. Add your API key: OPENAI_API_KEY=your-key-here');
      console.error('   3. Or use Anthropic: LLM_PROVIDER=anthropic');
      console.error('      ANTHROPIC_API_KEY=your-key-here');
      console.error('\n   Example .env file:');
      console.error('   LLM_PROVIDER=openai');
      console.error('   OPENAI_API_KEY=sk-...');
    } else if (error.message.includes('ANTHROPIC_API_KEY')) {
      console.error('\n💡 To fix this:');
      console.error('   1. Create a .env file in the backend directory');
      console.error('   2. Add your API key: ANTHROPIC_API_KEY=your-key-here');
    } else if (error.message.includes('model') && error.message.includes('does not exist')) {
      console.error('\n💡 Model not found. To fix this:');
      console.error('   1. Check your .env file and set a valid model:');
      console.error('      LLM_MODEL=gpt-4o          # Latest model (recommended)');
      console.error('      LLM_MODEL=gpt-4-turbo     # Alternative');
      console.error('      LLM_MODEL=gpt-4           # Stable version');
      console.error('   2. Or use Anthropic:');
      console.error('      LLM_PROVIDER=anthropic');
      console.error('      LLM_MODEL=claude-3-5-sonnet-20241022');
    } else if (error.message.includes('quota') || error.message.includes('429') || error.code === 'insufficient_quota') {
      console.error('\n💡 Quota/Rate Limit Error. To fix this:');
      console.error('   1. Use Ollama (FREE - local LLM, no API costs):');
      console.error('      Install: https://ollama.ai');
      console.error('      Run: ollama pull llama3.2');
      console.error('      In your .env file:');
      console.error('      LLM_PROVIDER=ollama');
      console.error('   2. Check your OpenAI account billing:');
      console.error('      https://platform.openai.com/account/billing');
      console.error('   3. Or use a cheaper model:');
      console.error('      LLM_MODEL=gpt-4o-mini     # Cheaper alternative');
      console.error('      LLM_MODEL=gpt-3.5-turbo   # Most affordable');
    } else if (error.message.includes('Ollama') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Ollama Connection Error. To fix this:');
      console.error('   1. Install Ollama: https://ollama.ai');
      console.error('   2. Start Ollama (it should run automatically)');
      console.error('   3. Pull a model: ollama pull llama3.2');
      console.error('   4. Verify it works: ollama run llama3.2');
      console.error('   5. Check OLLAMA_BASE_URL in .env (default: http://localhost:11434)');
    }
    
    if (process.env.DEBUG && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the application
main();

