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
   * Get common prefix between two strings
   * @param {string} str1
   * @param {string} str2
   * @returns {string}
   */
  static getCommonPrefix(str1, str2) {
    let i = 0;
    while (i < str1.length && i < str2.length && str1[i] === str2[i]) {
      i++;
    }
    return str1.substring(0, i);
  }

  /**
   * Parse JSON from LLM response, handling markdown code blocks,
   * duplicate‑line streaming glitches and common formatting problems.
   *
   * @template T
   * @param {string} response  raw text returned by the LLM
   * @returns {T}
   */
  static parseJSON(response) {
   
    const rawLines = response.split("\n");
    const trimmedLines = rawLines
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const keep = new Set(); // indices we will keep
    const processed = new Set(); // indices already examined

    const WINDOW = 6; // look‑ahead distance (few lines is enough for Ollama)

    for (let i = 0; i < trimmedLines.length; i++) {
      if (processed.has(i)) continue;
      const line = trimmedLines[i];
      let bestIdx = i;
      let bestLine = line;
      const relatedIndices = [i];

      // Scan forward a few lines for a superset version
      for (let j = i + 1; j < Math.min(i + WINDOW + 1, trimmedLines.length); j++) {
        if (processed.has(j)) continue;
        const cand = trimmedLines[j];

        // ---------------------------------------------------------
        // 1️⃣  Exact duplicate → mark for removal
        // ---------------------------------------------------------
        if (cand === line) {
          relatedIndices.push(j);
          continue;
        }

        // ---------------------------------------------------------
        // 2️⃣  Superset detection – cand starts with line AND ends
        //     with a proper JSON delimiter
        // ---------------------------------------------------------
        const endsWithDelimiter = /[},\]]$/.test(cand);
        if (cand.startsWith(line) && cand.length > line.length && endsWithDelimiter) {
          // We have a strictly longer, syntactically‑complete version.
          bestIdx = j;
          bestLine = cand;
          relatedIndices.push(j);
          continue;
        }

        // ---------------------------------------------------------
        // 3️⃣  Reverse check: if line starts with cand and is longer,
        //     cand is a prefix (truncated version)
        // ---------------------------------------------------------
        if (line.startsWith(cand) && line.length > cand.length) {
          const lineEndsWithDelimiter = /[},\]]$/.test(line);
          if (lineEndsWithDelimiter) {
            // Current line is more complete, mark cand as related
            relatedIndices.push(j);
          }
        }
        // Also check if cand is a prefix of line but line is incomplete
        // and cand is more complete (has proper closing)
        else if (cand.startsWith(line) && cand.length > line.length) {
          const candEndsWithDelimiter = /[},\]]$/.test(cand);
          const lineEndsWithDelimiter = /[},\]]$/.test(line);
          // If cand is more complete (ends with delimiter) and line doesn't, prefer cand
          if (candEndsWithDelimiter && !lineEndsWithDelimiter) {
            bestIdx = j;
            bestLine = cand;
            relatedIndices.push(j);
          }
        }
        // Check if both lines share a prefix but one is clearly more complete
        // This handles cases where we have: "scale": 1.0} vs "scale": 1.0}}, "end"
        else {
          const commonPrefix = this.getCommonPrefix(line, cand);
          if (commonPrefix.length > 20 && commonPrefix.length >= Math.min(line.length, cand.length) * 0.8) {
            const candEndsWithDelimiter = /[},\]]$/.test(cand);
            const lineEndsWithDelimiter = /[},\]]$/.test(line);
            // Prefer the one that ends with a delimiter (more complete)
            if (candEndsWithDelimiter && !lineEndsWithDelimiter && cand.length > line.length) {
              bestIdx = j;
              bestLine = cand;
              relatedIndices.push(j);
            } else if (lineEndsWithDelimiter && !candEndsWithDelimiter && line.length > cand.length) {
              relatedIndices.push(j);
            }
          }
        }
      }

      // ---------------------------------------------------------
      // 4️⃣  Mark all related indices as processed and keep only the best
      // ---------------------------------------------------------
      relatedIndices.forEach(idx => processed.add(idx));
      keep.add(bestIdx);
    }

    // -------------------------------------------------------------
    // 5️⃣  Remove *obviously* incomplete lines that end with a colon
    //     or a dangling quote – they're almost always a streaming cut‑off.
    //     BUT preserve standalone braces { and } as they're valid JSON.
    // -------------------------------------------------------------
    const finalLines = Array.from(keep)
      .sort((a, b) => a - b) // preserve original order
      .map((idx) => trimmedLines[idx])
      .filter((ln) => {
        // Preserve standalone braces - they're valid JSON
        if (ln === '{' || ln === '}' || ln === '[' || ln === ']') return true;
        // Discard if it ends with a lone colon or a stray quote
        if (/[:"]\s*$/.test(ln)) return false;
        // Discard if it looks like `"key"` (missing colon/value)
        if (/^"[^"]+"$/.test(ln)) return false;
        return true;
      });

    // Re‑assemble the cleaned response
    let cleanedResponse = finalLines.join("\n");

    /* ------------------------------------------------------------------
     * 1️⃣  Extract raw JSON block (strip markdown fences, find first/last brace)
     * ------------------------------------------------------------------ */
    const jsonMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let jsonString = jsonMatch ? jsonMatch[1] : cleanedResponse.trim();

    if (!jsonMatch) {
      const objectMatch = jsonString.match(/\{[\s\S]*\}/);
      if (objectMatch) jsonString = objectMatch[0];
    }

    const firstBrace = jsonString.indexOf("{");
    const lastBrace = jsonString.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    /* ------------------------------------------------------------------
     * 1.5️⃣  CRITICAL: Fix missing opening braces for objects in arrays
     *     This handles cases where duplicate line removal removed opening braces
     *     Pattern: "segments": [\n"id": -> "segments": [\n{"id":
     *     BUT: Don't add braces after ] when the property belongs to parent object
     * ------------------------------------------------------------------ */
    // Fix missing opening braces before property names in arrays
    // But be careful: ], "property" should NOT become ], {"property" if property
    // belongs to the parent object (like "voiceover_duration" after segments array)
    jsonString = jsonString
      // Fix: [\n"property" -> [\n{"property" (missing opening brace for first object in array)
      .replace(/\[\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '[\n      {"$1":')
      // Fix: },\n"property" -> },\n{"property" (missing opening brace between objects in array)
      .replace(/}\s*,\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '},\n      {"$1":')
      // Fix: [ "property" -> [ {"property" (same line)
      .replace(/\[\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '[ {"$1":')
      // DON'T fix: ], "property" - this is correct, property belongs to parent object
      // Remove any incorrectly added braces after ] that we might have added
      .replace(/\]\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '], "$1":')
      .replace(/\]\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '], "$1":');

    /* ------------------------------------------------------------------
     * 2️⃣  Fix broken strings (URLs, unfinished literals) – same as before
     * ------------------------------------------------------------------ */
    for (let pass = 0; pass < 3; pass++) {
      jsonString = jsonString
        .replace(/(":\s*"https:)\s*\n\s*"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1//example.com/",\n      "$2":')
        .replace(/(":\s*"https:)\s*\n\s*"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1//example.com/",\n      "$2":')
        .replace(/"https:\s*\n\s*"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '"https://example.com/",\n      "$1":')
        .replace(/(":\s*")([^"]+?)\n\s+"([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1$2",\n      "$3":')
        .replace(/"https:\s*\n\s*"([^"]+)":/g, '"https://example.com/",\n      "$1":')
        .replace(/"https:\s*\n/g, '"https://example.com/",\n');
    }

    /* ------------------------------------------------------------------
     * 3️⃣  Character‑by‑character fix for control characters & broken strings
     * ------------------------------------------------------------------ */
    let inString = false,
      escaped = false,
      result = "",
      stringStart = -1;

    for (let i = 0; i < jsonString.length; i++) {
      const ch = jsonString[i];
      if (!escaped && ch === '"') {
        if (inString) {
          const afterQuote = jsonString.substring(i + 1).match(/^\s+"([a-zA-Z_][a-zA-Z0-9_]*)":/);
          if (afterQuote && stringStart >= 0) {
            const content = jsonString.substring(stringStart + 1, i);
            if (content.includes("\n") || content.endsWith("https:")) {
              result += '",\n      "' + afterQuote[1] + '":';
              i += afterQuote[0].length - 1;
              inString = false;
              stringStart = -1;
              continue;
            }
          }
          inString = false;
          stringStart = -1;
        } else {
          inString = true;
          stringStart = i;
        }
        result += ch;
        escaped = false;
      } else if (!escaped && ch === "\\") {
        escaped = true;
        result += ch;
      } else if (inString && !escaped) {
        if (ch === "\n") {
          const afterNew = jsonString.substring(i + 1).match(/^\s+"([a-zA-Z_][a-zA-Z0-9_]*)":/);
          const content = jsonString.substring(stringStart + 1, i);
          if (afterNew) {
            if (content.endsWith("https:") || content.endsWith("http:")) {
              result += '://example.com/",\n      "' + afterNew[1] + '":';
              i += afterNew[0].length;
              inString = false;
              stringStart = -1;
              continue;
            }
            result += '",\n      "' + afterNew[1] + '":';
            i += afterNew[0].length;
            inString = false;
            stringStart = -1;
            continue;
          }
          result += "\\n";
        } else if (ch === "\r") result += "\\r";
        else if (ch === "\t") result += "\\t";
        else if (ch === "\f") result += "\\f";
        else if (ch === "\b") result += "\\b";
        else result += ch;
        escaped = false;
      } else {
        result += ch;
        escaped = false;
      }
    }
    jsonString = result;

    /* ------------------------------------------------------------------
     * 3.5️⃣  CRITICAL: Fix missing closing braces before array brackets
     *     This handles the most common error: "order": 3], -> "order": 3}],
     * ------------------------------------------------------------------ */
    for (let bracePass = 0; bracePass < 5; bracePass++) {
      const before = jsonString;
      jsonString = jsonString
        // Fix: "order": number], -> "order": number}], (most common pattern)
        .replace(/"order"\s*:\s*(\d+\.?\d*)\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"order": $1}], "$2":')
        // Fix: number], -> number}], (missing closing brace before array close)
        .replace(/(\d+\.?\d*)\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}], "$2":')
        // Fix: "string"], -> "string"}], (missing closing brace before array close)
        .replace(/"([^"]+)"\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"$1"}], "$2":')
        // Fix: true/false/null], -> true/false/null}],
        .replace(/(true|false|null)\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}], "$2":')
        // Same fixes but with newlines
        .replace(/"order"\s*:\s*(\d+\.?\d*)\s*\n\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"order": $1}\n    ], "$2":')
        .replace(/(\d+\.?\d*)\s*\n\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}\n    ], "$2":')
        .replace(/"([^"]+)"\s*\n\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"$1"}\n    ], "$2":')
        .replace(/(true|false|null)\s*\n\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}\n    ], "$2":')
        // CRITICAL: Fix cases where ], { was incorrectly added (remove { and add missing })
        // Pattern: "order": 3], {"property" -> "order": 3}], "property"
        .replace(/"order"\s*:\s*(\d+\.?\d*)\s*\]\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"order": $1}], "$2":')
        .replace(/(\d+\.?\d*)\s*\]\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}], "$2":')
        .replace(/(true|false|null)\s*\]\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}], "$2":')
        // Same but with newlines
        .replace(/"order"\s*:\s*(\d+\.?\d*)\s*\]\s*,\s*\{\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"order": $1}],\n      "$2":')
        .replace(/(\d+\.?\d*)\s*\]\s*,\s*\{\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}],\n      "$2":')
        // Fix missing closing braces in nested objects: "scale": 1.0}, {"end" -> "scale": 1.0}}, "end"
        // This handles cases where an object property ends with a value followed by }, {"next_property"
        // The }, { pattern suggests a nested object should close before the next property
        .replace(/(\d+\.?\d*)\s*\}\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}}, "$2":')
        .replace(/"([^"]+)"\s*\}\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"$1"}}, "$2":')
        .replace(/(true|false|null)\s*\}\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}}, "$2":')
        // Same with newlines
        .replace(/(\d+\.?\d*)\s*\}\s*,\s*\{\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}},\n      "$2":')
        .replace(/"([^"]+)"\s*\}\s*,\s*\{\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"$1"}},\n      "$2":')
        .replace(/(true|false|null)\s*\}\s*,\s*\{\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}},\n      "$2":')
        // Fix incomplete coordinate objects: "scale": 1.0} -> "scale": 1.0}} (missing closing brace)
        // Pattern: "scale": 1.0} followed by }, "end" or }, {"end"
        .replace(/"scale"\s*:\s*(\d+\.?\d*)\s*\}\s*,\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"scale": $1}}, "$2":')
        .replace(/"scale"\s*:\s*(\d+\.?\d*)\s*\}\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"scale": $1}}, "$2":')
        // Fix incomplete coordinate objects that end with just } (missing closing brace for parent)
        // Pattern: "scale": 1.0} followed by newline or end of object - add missing }
        // BUT: Only if it's not already followed by another } or ]
        .replace(/"scale"\s*:\s*(\d+\.?\d*)\s*\}\s*(?![\}\]])\s*$/gm, '"scale": $1}}')
        .replace(/"scale"\s*:\s*(\d+\.?\d*)\s*\}\s*(?![\}\]])\s*\n/g, '"scale": $1}}\n')
        // Fix incomplete "start" objects: "start": { "x": 0.5, "y": 0.5, "scale": 1.0} -> add }
        // This handles cases where the coordinate object is missing its closing brace
        // BUT: Only if it's not already followed by another } or ]
        .replace(/"start"\s*:\s*\{\s*"x"\s*:\s*([\d.]+)\s*,\s*"y"\s*:\s*([\d.]+)\s*,\s*"scale"\s*:\s*([\d.]+)\s*\}\s*(?![\}\]])\s*$/gm, '"start": { "x": $1, "y": $2, "scale": $3}}')
        .replace(/"start"\s*:\s*\{\s*"x"\s*:\s*([\d.]+)\s*,\s*"y"\s*:\s*([\d.]+)\s*,\s*"scale"\s*:\s*([\d.]+)\s*\}\s*(?![\}\]])\s*\n/g, '"start": { "x": $1, "y": $2, "scale": $3}}\n')
        // More general: any number followed by } and then }, "property" or }, {"property"
        .replace(/(\d+\.?\d*)\s*\}\s*\}\s*,\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}}}, "$2":')
        .replace(/(\d+\.?\d*)\s*\}\s*\}\s*,\s*\{\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}}}, "$2":')
        // Fix: Remove extra closing braces before property names (corruption fix)
        // Pattern: }}}, "property" -> }, "property" (when there are too many braces)
        .replace(/(\d+\.?\d*)\s*\}\}\}\s*,\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1}, "$2":')
        .replace(/"order"\s*:\s*(\d+\.?\d*)\s*\}\}\}\s*,\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '"order": $1}, "$2":');
      
      if (jsonString === before) break;
    }

    /* ------------------------------------------------------------------
     * 4️⃣  Systematic missing‑comma fixes (run a few passes)
     * ------------------------------------------------------------------ */
    for (let pass = 0; pass < 10; pass++) {
      const before = jsonString;
      jsonString = jsonString
        .replace(/}\s*\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '}], "$1":')
        .replace(/\]\s*,?\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '], "$1":')
        .replace(/}\s*{/g, '}, {')
        .replace(/}\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '}, "$1":')
        .replace(/"\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '", "$1":')
        .replace(/(\d+\.?\d*)\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1, "$2":')
        .replace(/(true|false|null)\s+"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1, "$2":')
        .replace(/"\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '",\n      "$1":')
        .replace(/(\d+\.?\d*)\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1,\n      "$2":')
        .replace(/}\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '},\n      "$1":')
        .replace(/\]\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '],\n      "$1":')
        .replace(/(true|false|null)\s*\n\s*"([a-zA-Z_$][a-zA-Z0-9_$]*)"\s*:/g, '$1,\n      "$2":')
        .replace(/}\s*\n\s*{/g, '},\n      {')
        .replace(/\]\s*\n\s*{/g, '],\n      {')
        .replace(/}\s*\n\s*\[/g, '},\n      [')
        .replace(/\]\s*\n\s*\[/g, '],\n      [');

      if (jsonString === before) break;
    }

    /* ------------------------------------------------------------------
     * 5️⃣  Clean up stray commas, unquoted keys, comments, etc.
     * ------------------------------------------------------------------ */
    jsonString = jsonString
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/([{:,\s])'/g, '$1"')
      .replace(/'(?=\s*[,}\]])/g, '"')
      .replace(/'(?=\s*:)/g, '"')
      .replace(/([":])\s{2,}/g, "$1 ")
      .replace(/\s+([}\]])/g, "$1")
      .replace(/,\s{2,}/g, ", ");

    /* ------------------------------------------------------------------
     * 6️⃣  Final “balance brackets” fallback – if we still have a mismatch,
     *     add the missing closing symbols before parsing.
     * ------------------------------------------------------------------ */
    const openCurly = (jsonString.match(/{/g) || []).length;
    const closeCurly = (jsonString.match(/}/g) || []).length;
    const openSquare = (jsonString.match(/\[/g) || []).length;
    const closeSquare = (jsonString.match(/]/g) || []).length;

    if (openCurly > closeCurly) jsonString += "}".repeat(openCurly - closeCurly);
    if (openSquare > closeSquare) jsonString += "]".repeat(openSquare - closeSquare);

    /* ------------------------------------------------------------------
     * 7️⃣  Parse – if this still throws we provide a *very* detailed
     *     diagnostic (same as the original implementation) and re‑throw.
     * ------------------------------------------------------------------ */
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return JSON.parse(jsonString);
    } catch (error) {
      // ---------------------------------------------------------
      // Fancy diagnostic (unchanged – prints surrounding text)
      // ---------------------------------------------------------
      const errMsg = error.message;
      const posMatch = errMsg.match(/position (\d+)/);
      const pos = posMatch ? Number(posMatch[1]) : -1;

      if (pos >= 0) {
        const start = Math.max(0, pos - 300);
        const end = Math.min(jsonString.length, pos + 300);
        const snippet = jsonString.substring(start, end);
        const lines = snippet.split("\n");
        const before = jsonString.substring(0, pos).split("\n").length;

        console.error("\n⚠️  JSON parse error:", errMsg);
        console.error(`\nAround line ${before}, position ${pos}:`);
        console.error("─".repeat(80));
        lines.forEach((ln, idx) => {
          const lineNum = before - lines.length + idx + 1;
          console.error(`${String(lineNum).padStart(3, " ")} | ${ln.replace(/\t/g, "→").replace(/ /g, "·")}`);
        });
        console.error("─".repeat(80));
        console.error(`\nRaw characters: ${JSON.stringify(jsonString.substring(Math.max(0, pos - 50), Math.min(jsonString.length, pos + 50)))}`);
        console.error("\nFull JSON (first 2000 chars):");
        console.error("─".repeat(80));
        console.error(jsonString.substring(0, 2000));
        if (jsonString.length > 2000) console.error(`\n... (${jsonString.length - 2000} more characters)`);
        console.error("─".repeat(80));
      }

      // Re‑throw a friendlier wrapper
      throw new Error(`Failed to parse JSON from LLM response: ${errMsg}`);
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