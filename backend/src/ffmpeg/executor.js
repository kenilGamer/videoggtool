/**
 * FFmpeg execution wrapper
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * @typedef {Object} ExecutionOptions
 * @property {string} [ffmpegPath]
 * @property {boolean} [dryRun]
 * @property {boolean} [verbose]
 */

export class FFmpegExecutor {
  /**
   * @param {ExecutionOptions} [options]
   */
  constructor(options = {}) {
    this.ffmpegPath = options.ffmpegPath || 'ffmpeg';
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
  }

  /**
   * Execute a single FFmpeg command
   * @param {import('../core/types.js').FFmpegCommand} command
   * @returns {Promise<void>}
   */
  async executeCommand(command) {
    if (this.dryRun) {
      console.log(`[DRY RUN] ${command.description}`);
      console.log(`Command: ${command.command}`);
      return;
    }

    if (this.verbose) {
      console.log(`Executing: ${command.description}`);
      console.log(`Command: ${command.command}`);
    }

    try {
      const { stdout, stderr } = await execAsync(command.command);
      
      if (this.verbose && stdout) {
        console.log(stdout);
      }
      
      if (stderr && this.verbose) {
        console.error(stderr);
      }
    } catch (error) {
      console.error(`Error executing command: ${command.description}`);
      console.error(`Command: ${command.command}`);
      throw new Error(`FFmpeg execution failed: ${error.message}`);
    }
  }

  /**
   * Execute multiple FFmpeg commands sequentially
   * @param {import('../core/types.js').FFmpegCommand[]} commands
   * @returns {Promise<void>}
   */
  async executeCommands(commands) {
    for (const command of commands) {
      await this.executeCommand(command);
    }
  }

  /**
   * Check if FFmpeg is available
   * @returns {Promise<boolean>}
   */
  async checkFFmpegAvailable() {
    try {
      await execAsync(`${this.ffmpegPath} -version`);
      return true;
    } catch {
      return false;
    }
  }
}

