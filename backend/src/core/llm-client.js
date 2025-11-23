/**
 * Configurable LLM client abstraction for multiple providers
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * @typedef {Object} LLMResponse
 * @property {string} content
 * @property {Object} [usage]
 * @property {number} [usage.prompt_tokens]
 * @property {number} [usage.completion_tokens]
 * @property {number} [usage.total_tokens]
 */

export class LLMClient {
  /**
   * @param {import('./types.js').LLMConfig} config
   */
  constructor(config) {
    this.config = config;
    
    if (config.provider === 'openai') {
      this.openaiClient = new OpenAI({
        apiKey: config.apiKey,
      });
    } else if (config.provider === 'anthropic') {
      this.anthropicClient = new Anthropic({
        apiKey: config.apiKey,
      });
    } else if (config.provider === 'ollama') {
      // Ollama runs locally, no API key needed
      this.ollamaBaseUrl = config.baseUrl || 'http://localhost:11434';
    }
  }

  /**
   * @param {string} prompt
   * @param {string} [systemPrompt]
   * @returns {Promise<LLMResponse>}
   */
  async generate(prompt, systemPrompt) {
    const temperature = this.config.temperature ?? 0.7;
    const maxTokens = this.config.maxTokens ?? 4000;

    if (this.config.provider === 'openai') {
      return this.generateOpenAI(prompt, systemPrompt, temperature, maxTokens);
    } else if (this.config.provider === 'anthropic') {
      return this.generateAnthropic(prompt, systemPrompt, temperature, maxTokens);
    } else if (this.config.provider === 'ollama') {
      return this.generateOllama(prompt, systemPrompt, temperature, maxTokens);
    } else {
      throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * @param {string} prompt
   * @param {string | undefined} systemPrompt
   * @param {number} temperature
   * @param {number} maxTokens
   * @returns {Promise<LLMResponse>}
   */
  async generateOpenAI(prompt, systemPrompt, temperature, maxTokens) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const model = this.config.model || 'gpt-4o';
    
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });

    const response = await this.openaiClient.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage ? {
      prompt_tokens: response.usage.prompt_tokens,
      completion_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens,
    } : undefined;

    return { content, usage };
  }

  /**
   * @param {string} prompt
   * @param {string | undefined} systemPrompt
   * @param {number} temperature
   * @param {number} maxTokens
   * @returns {Promise<LLMResponse>}
   */
  async generateAnthropic(prompt, systemPrompt, temperature, maxTokens) {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    const model = this.config.model || 'claude-3-5-sonnet-20241022';
    
    const response = await this.anthropicClient.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt || '',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const usage = response.usage ? {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    } : undefined;

    return { content, usage };
  }

  /**
   * Generate response using Ollama (FREE - local LLM)
   * @param {string} prompt
   * @param {string | undefined} systemPrompt
   * @param {number} temperature
   * @param {number} maxTokens
   * @returns {Promise<LLMResponse>}
   */
  async generateOllama(prompt, systemPrompt, temperature, maxTokens) {
    const model = this.config.model || 'llama3.2';
    const baseUrl = this.ollamaBaseUrl || 'http://localhost:11434';

    // Combine system prompt and user prompt
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        // If model not found, try to pull it automatically
        if (response.status === 404 && errorData.error && errorData.error.includes('not found')) {
          console.log(`\n📥 Model '${model}' not found. Attempting to pull it...`);
          try {
            const pullResponse = await fetch(`${baseUrl}/api/pull`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: model,
                stream: false,
              }),
            });
            
            if (pullResponse.ok) {
              console.log(`✅ Model '${model}' pulled successfully! Retrying...\n`);
              // Retry the original request
              return this.generateOllama(prompt, systemPrompt, temperature, maxTokens);
            } else {
              throw new Error(`Failed to pull model: ${await pullResponse.text()}`);
            }
          } catch (pullError) {
            throw new Error(
              `Model '${model}' not found and could not be pulled automatically.\n` +
              `Please run manually: ollama pull ${model}\n` +
              `Or install Ollama from: https://ollama.ai`
            );
          }
        }
        
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.response || '';

      return {
        content,
        usage: {
          prompt_tokens: data.prompt_eval_count || 0,
          completion_tokens: data.eval_count || 0,
          total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
      };
    } catch (error) {
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `Cannot connect to Ollama at ${baseUrl}. ` +
          `Make sure Ollama is running. Install from: https://ollama.ai\n` +
          `Then run: ollama pull ${model}`
        );
      }
      throw error;
    }
  }

  /**
   * Parse JSON from LLM response, handling markdown code blocks and common formatting issues
   * @template T
   * @param {string} response
   * @returns {T}
   */
  static parseJSON(response) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let jsonString = jsonMatch ? jsonMatch[1] : response.trim();
    
    // Try to find JSON object in the response if no code block found
    if (!jsonMatch) {
      const objectMatch = jsonString.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonString = objectMatch[0];
      }
    }
    
    // Clean up common JSON formatting issues
    // First, extract just the JSON object (remove any text before/after)
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }
    
    // Fix incomplete/broken string values that have newlines before closing quote
    // This must be done BEFORE the character-by-character processing
    
    // Fix broken URLs and incomplete strings BEFORE character processing
    // Pattern 1: "https:\n      "property" -> "https://example.com/",\n      "property"
    // This handles the specific case where URLs are broken by newlines
    jsonString = jsonString.replace(/"https:\s*\n\s+"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '"https://example.com/",\n      "$1":');
    
    // Pattern 2: Any incomplete string value: "value\n      "next_key" -> "value",\n      "next_key"
    // Match: colon, quote, value (no quote), newline, whitespace, quote, property name
    jsonString = jsonString.replace(/(":\s*")([^"]+?)\n\s+"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1$2",\n      "$3":');
    
    // Pattern 3: Standalone broken https: (not followed by property)
    jsonString = jsonString.replace(/"https:\s*\n/g, '"https://example.com/",\n');
    
    // Fix newlines and control characters inside string values
    // Process character by character to properly handle escaped sequences
    // Also detect and fix broken strings (incomplete strings with newlines)
    let inString = false;
    let escaped = false;
    let result = '';
    let stringStart = -1;
    
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i];
      const nextChars = jsonString.substring(i, Math.min(i + 20, jsonString.length));
      
      if (!escaped && char === '"') {
        if (inString) {
          // Closing quote - check if this was a broken string
          // Look ahead to see if there's a property name after whitespace
          const afterQuote = jsonString.substring(i + 1).match(/^\s+"([a-zA-Z_][a-zA-Z0-9_]*)":/);
          if (afterQuote && stringStart >= 0) {
            // This might be a broken string - check if we had a newline
            const stringContent = jsonString.substring(stringStart + 1, i);
            if (stringContent.includes('\n') || stringContent.endsWith('https:')) {
              // Broken string detected - close it and add comma
              result += '",\n      "' + afterQuote[1] + '":';
              i += afterQuote[0].length - 1; // Skip the matched part
              inString = false;
              stringStart = -1;
              continue;
            }
          }
          inString = false;
          stringStart = -1;
        } else {
          // Opening quote
          inString = true;
          stringStart = i;
        }
        result += char;
        escaped = false;
      } else if (!escaped && char === '\\') {
        escaped = true;
        result += char;
      } else if (inString && !escaped) {
        // Inside a string
        // Check if this is a newline that should close the string (broken string)
        if (char === '\n') {
          // Look ahead to see if there's a property name
          const afterNewline = jsonString.substring(i + 1).match(/^\s+"([a-zA-Z_][a-zA-Z0-9_]*)":/);
          if (afterNewline) {
            // This is a broken string - close it
            result += '",\n      "' + afterNewline[1] + '":';
            i += afterNewline[0].length; // Skip the matched part
            inString = false;
            stringStart = -1;
            continue;
          } else {
            // Normal newline in string - escape it
            result += '\\n';
          }
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else if (char === '\f') {
          result += '\\f';
        } else if (char === '\b') {
          result += '\\b';
        } else {
          result += char;
        }
        escaped = false;
      } else {
        result += char;
        escaped = false;
      }
    }
    
    jsonString = result;
    
    // Fix missing commas - do multiple passes to catch all cases
    for (let pass = 0; pass < 3; pass++) {
      jsonString = jsonString
        // CRITICAL: Fix missing commas between objects in arrays
        // Pattern 1: }} { -> }}, { (nested object closing followed by next array element)
        .replace(/}}\s*{/g, '}}, {')
        // Pattern 2: } { -> }, { (simple case, but avoid property assignments like "key": {...})
        // Only match when } is NOT preceded by : (which would be a property assignment)
        .replace(/([^:])\s*}\s*{/g, '$1}, {')
        // Pattern: "value"\n      "key" -> "value",\n      "key"
        .replace(/"\s*\n\s+"/g, '",\n      "')
        // Pattern: number\n      "key" -> number,\n      "key"
        .replace(/(\d+\.?\d*)\s*\n\s+"/g, '$1,\n      "')
        // Pattern: }\n      "key" -> },\n      "key" (for nested objects)
        .replace(/}\s*\n\s+"/g, '},\n      "')
        // Pattern: ]\n      "key" -> ],\n      "key" (for arrays)
        .replace(/\]\s*\n\s+"/g, '],\n      "')
        // Pattern: true/false/null\n      "key" -> true/false/null,\n      "key"
        .replace(/(true|false|null)\s*\n\s+"/g, '$1,\n      "')
        // Pattern: }\n      { -> },\n      { (for objects in arrays) - redundant now but keep for safety
        .replace(/}\s*\n\s+{/g, '},\n      {')
        // Pattern: ]\n      { -> ],\n      { (for objects after arrays)
        .replace(/\]\s*\n\s+{/g, '],\n      {')
        // Pattern: }\n      [ -> },\n      [ (for arrays after objects)
        .replace(/}\s*\n\s+\[/g, '},\n      [')
        // Pattern: ]\n      [ -> ],\n      [ (for arrays after arrays)
        .replace(/\]\s*\n\s+\[/g, '],\n      [')
        // Fix missing commas on the same line (not just across newlines)
        // Pattern: "value" "key" -> "value", "key" (same line)
        .replace(/"\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '", "$1":')
        // Pattern: number "key" -> number, "key" (same line)
        .replace(/(\d+\.?\d*)\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1, "$2":')
        // Pattern: } "key" -> }, "key" (same line)
        .replace(/}\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '}, "$1":')
        // Pattern: ] "key" -> ], "key" (same line)
        .replace(/\]\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '], "$1":')
        // Pattern: true/false/null "key" -> true/false/null, "key" (same line)
        .replace(/(true|false|null)\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1, "$2":');
    }
    
    // Clean up trailing whitespace that might cause issues
    jsonString = jsonString
      // Remove excessive trailing whitespace after property values (but keep single spaces)
      .replace(/([":])\s{2,}/g, '$1 ')
      // Remove trailing whitespace before closing braces/brackets
      .replace(/\s+([}\]])/g, '$1')
      // Remove trailing whitespace after commas
      .replace(/,\s{2,}/g, ', ')
      // Remove trailing commas before closing braces/brackets (multiple passes for nested)
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/,(\s*[}\]])/g, '$1')  // Second pass for nested structures
      // Fix unquoted property names (do this before quote replacement)
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
      // Remove comments (JSON doesn't support comments)
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Fix single quotes to double quotes (careful with apostrophes in strings)
      .replace(/([{:,\s])'/g, '$1"')  // Opening quotes after braces, colons, commas
      .replace(/'(?=\s*[,}\]])/g, '"') // Closing quotes before punctuation
      .replace(/'(?=\s*:)/g, '"');     // Quotes before colons
    
    // Try to extract just the JSON object if there's extra content (check again after cleaning)
    const jsonFirstBrace = jsonString.indexOf('{');
    const jsonLastBrace = jsonString.lastIndexOf('}');
    if (jsonFirstBrace !== -1 && jsonLastBrace !== -1 && jsonLastBrace > jsonFirstBrace) {
      // Check if there's content after the last brace
      const afterLastBrace = jsonString.substring(jsonLastBrace + 1).trim();
      if (afterLastBrace.length > 0 && !afterLastBrace.match(/^[,\s]*$/)) {
        // There's extra content, extract just the JSON object
        jsonString = jsonString.substring(jsonFirstBrace, jsonLastBrace + 1);
      }
    }
    
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      // Always log the error for debugging
      const errorPos = parseInt(error.message.match(/position (\d+)/)?.[1] || '0');
      console.error('\n⚠️  JSON parse error:', error.message);
      
      // Show the problematic area with line numbers
      if (errorPos > 0 && errorPos < jsonString.length) {
        const start = Math.max(0, errorPos - 300);
        const end = Math.min(jsonString.length, errorPos + 300);
        const problematic = jsonString.substring(start, end);
        const lines = problematic.split('\n');
        const beforeError = jsonString.substring(0, errorPos).split('\n').length;
        const posInArea = errorPos - start;
        const lineStart = problematic.lastIndexOf('\n', posInArea) + 1;
        const col = posInArea - lineStart;
        
        console.error(`\nAround line ${beforeError}, position ${errorPos} (total length: ${jsonString.length}):`);
        console.error('─'.repeat(80));
        lines.forEach((line, idx) => {
          const lineNum = beforeError - lines.length + idx + 1;
          // Show whitespace as visible characters for debugging
          const visibleLine = line.replace(/\t/g, '→').replace(/ /g, '·');
          console.error(`${lineNum.toString().padStart(3, ' ')} | ${visibleLine}`);
        });
        console.error('     ' + ' '.repeat(Math.max(0, col)) + '^');
        console.error('─'.repeat(80));
        
        // Also show the raw characters around the error
        const charStart = Math.max(0, errorPos - 50);
        const charEnd = Math.min(jsonString.length, errorPos + 50);
        console.error(`\nRaw characters around error (pos ${charStart}-${charEnd}):`);
        console.error(JSON.stringify(jsonString.substring(charStart, charEnd)));
      } else {
        // If we can't determine position, show the full JSON
        console.error('\nFull JSON (first 2000 chars):');
        console.error('─'.repeat(80));
        console.error(jsonString.substring(0, 2000));
        if (jsonString.length > 2000) {
          console.error(`\n... (${jsonString.length - 2000} more characters)`);
        }
        console.error('─'.repeat(80));
      }
      // Try more aggressive fixes
      try {
        // Try to fix common issues with escaped quotes
        jsonString = jsonString.replace(/\\"/g, '\\"');
        return JSON.parse(jsonString);
      } catch (e) {
        // Last resort: try to extract just the JSON structure
        try {
          // Find the first complete JSON object
          let depth = 0;
          let start = -1;
          let end = -1;
          
          for (let i = 0; i < jsonString.length; i++) {
            if (jsonString[i] === '{') {
              if (start === -1) start = i;
              depth++;
            } else if (jsonString[i] === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                end = i + 1;
                break;
              }
            }
          }
          
          if (start !== -1 && end !== -1) {
            const extracted = jsonString.substring(start, end);
            return JSON.parse(extracted);
          }
        } catch (finalError) {
          // If all else fails, log the problematic JSON for debugging
          const errorPos = parseInt(error.message.match(/position (\d+)/)?.[1] || '0');
          
          console.error('\n❌ Failed to parse JSON. Full response:');
          console.error('='.repeat(80));
          console.error(jsonString);
          console.error('='.repeat(80));
          console.error(`\nError at position ${errorPos} (${error.message})`);
          
          // Show the problematic area with line numbers
          if (errorPos > 0) {
            const start = Math.max(0, errorPos - 150);
            const end = Math.min(jsonString.length, errorPos + 150);
            const problematicArea = jsonString.substring(start, end);
            const lines = problematicArea.split('\n');
            const beforeError = jsonString.substring(0, errorPos).split('\n').length;
            
            console.error('\nProblematic area (around line ' + beforeError + '):');
            lines.forEach((line, idx) => {
              const lineNum = beforeError - lines.length + idx + 1;
              console.error(`${lineNum.toString().padStart(3, ' ')} | ${line}`);
            });
            const posInArea = errorPos - start;
            const lineStart = problematicArea.lastIndexOf('\n', posInArea) + 1;
            const col = posInArea - lineStart;
            console.error('     ' + ' '.repeat(col) + '^');
          }
          
          throw new Error(`Failed to parse JSON from LLM response: ${error.message}`);
        }
      }
      throw new Error(`Failed to parse JSON from LLM response: ${error.message}`);
    }
  }
}

/**
 * Create LLM client from environment variables
 * @returns {LLMClient}
 */
export function createLLMClientFromEnv() {
  const provider = (process.env.LLM_PROVIDER || 'openai');
  
  // Ollama is FREE - runs locally, no API key needed
  if (provider === 'ollama') {
    console.log('🆓 Using Ollama (FREE local LLM)');
    return new LLMClient({
      provider: 'ollama',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.LLM_MODEL || 'llama3.2',
      temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
      maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : undefined,
    });
  }
  
  let apiKey;
  if (provider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  } else if (provider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
  } else {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  return new LLMClient({
    provider,
    apiKey,
    model: process.env.LLM_MODEL,
    temperature: process.env.LLM_TEMPERATURE ? parseFloat(process.env.LLM_TEMPERATURE) : undefined,
    maxTokens: process.env.LLM_MAX_TOKENS ? parseInt(process.env.LLM_MAX_TOKENS, 10) : undefined,
  });
}

