# Video Generation Multi-Agent System

A Node.js/TypeScript system that processes video generation requests through 6 coordinated agent roles, each powered by configurable LLM providers. The system generates structured video plans with FFmpeg commands for creating videos with Ken Burns effects, transitions, audio mixing, and more.

## Project Structure

```
videoggtool/
├── backend/          # Backend API and CLI
│   ├── src/
│   │   ├── agents/   # 6 agent implementations
│   │   ├── core/     # Orchestrator, LLM client, types
│   │   ├── ffmpeg/   # FFmpeg command builder
│   │   ├── api/      # REST API server
│   │   ├── cli/      # CLI interface
│   │   └── index.ts  # Library export
│   ├── package.json
│   └── tsconfig.json
├── frontend/         # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── components/
│   │       └── TimelinePlayer.tsx
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

## Features

- **6 Sequential Agent Roles**: CVA, CD, VE, AE, SCO, OC working together
- **Configurable LLM Providers**: OpenAI and Anthropic support
- **FFmpeg Integration**: Automatic command generation and optional execution
- **Multiple Interfaces**: CLI, REST API, and library
- **React Frontend**: Interactive timeline player and visualization
- **Safety Checks**: Built-in compliance and safety validation
- **Ken Burns Effects**: Automatic motion path generation
- **Audio Mixing**: Ducking, normalization, and multi-track support

## Installation

### Backend

```bash
cd backend
npm install
npm run build
```

### Frontend

```bash
cd frontend
npm install
```

## Configuration

Create a `.env` file in the `backend/` directory:

```env
# LLM Provider Configuration
# Options: "ollama" (FREE local), "openai", or "anthropic"
LLM_PROVIDER=ollama

# Model name
# For Ollama: llama3.2, llama3.1, gemma2:2b, etc.
# For OpenAI: gpt-4o, gpt-4-turbo, etc.
# For Anthropic: claude-3-5-sonnet-20241022, claude-3-opus, etc.
LLM_MODEL=llama3.2

# Temperature (0 = deterministic, higher = more creative)
# IMPORTANT: Use 0 for JSON generation to avoid truncation/errors
LLM_TEMPERATURE=0

# Maximum tokens for LLM response (default: 4000)
# Increase if your video specs are huge
LLM_MAX_TOKENS=1024

# Ollama Configuration (only needed if LLM_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434

# OpenAI Configuration (only needed if LLM_PROVIDER=openai)
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Configuration (only needed if LLM_PROVIDER=anthropic)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# FFmpeg Configuration
FFMPEG_PATH=
OUTPUT_DIR=./output

# API Server Configuration
PORT=3000
```

### Using Ollama (FREE Local LLM)

1. Install Ollama from https://ollama.ai
2. Pull a model: `ollama pull llama3.2`
3. Set `LLM_PROVIDER=ollama` and `LLM_TEMPERATURE=0` in your `.env` file
4. The system will automatically connect to Ollama running on `localhost:11434`

## Usage

### Backend CLI Interface

**Generate video from JSON file:**
```bash
cd backend
npm run build
node dist/cli/index.js generate -i example-input.json -o output.json
```

**Generate and execute FFmpeg commands:**
```bash
node dist/cli/index.js generate -i example-input.json --execute-ffmpeg
```

**Dry run (generate commands without executing):**
```bash
node dist/cli/index.js generate -i example-input.json --dry-run
```

**Validate input:**
```bash
node dist/cli/index.js validate example-input.json
```

### Backend REST API

**Start the server:**
```bash
cd backend
npm run build
npm start
```

**Generate video:**
```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d @example-input.json
```

**Generate and execute FFmpeg:**
```bash
curl -X POST "http://localhost:3000/generate?execute=true" \
  -H "Content-Type: application/json" \
  -d @example-input.json
```

### Frontend Development

**Start the frontend development server:**
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173` and will proxy API requests to the backend at `http://localhost:3000`.

**Build for production:**
```bash
cd frontend
npm run build
```

### Library Usage

```typescript
import { generateVideo, VideoGenerationInput } from './backend/src/index';

const input: VideoGenerationInput = {
  project_id: "my-video-001",
  video_settings: {
    resolution: "1920x1080",
    fps: 30,
    format: "mp4",
    codec: "libx264",
    crf: 18
  },
  assets: [
    { id: "img1", type: "image", src: "https://example.com/image1.jpg" },
    { id: "img2", type: "image", src: "https://example.com/image2.jpg" },
    { id: "music1", type: "audio", src: "https://example.com/music.mp3" }
  ],
  instructions: {
    style: "cinematic, smooth, emotional",
    camera_movement: "kenburns",
    transitions: "crossfade",
    target_duration: 12,
    voiceover: {
      type: "tts",
      language: "en",
      text: "Welcome to our cinematic story."
    }
  }
};

const result = await generateVideo(input, {
  executeFfmpeg: false,
  verbose: true
});

console.log(result.human_summary);
console.log(JSON.stringify(result.json_output, null, 2));
```

## Input Format

```json
{
  "project_id": "my-video-001",
  "video_settings": {
    "resolution": "1920x1080",
    "fps": 30,
    "format": "mp4",
    "codec": "libx264",
    "crf": 18
  },
  "assets": [
    {
      "id": "img1",
      "type": "image",
      "src": "https://example.com/image1.jpg"
    },
    {
      "id": "music1",
      "type": "audio",
      "src": "https://example.com/music.mp3"
    }
  ],
  "instructions": {
    "style": "cinematic, smooth, emotional",
    "camera_movement": "kenburns",
    "transitions": "crossfade",
    "target_duration": 12,
    "voiceover": {
      "type": "tts",
      "language": "en",
      "text": "Welcome to our cinematic story."
    }
  }
}
```

## Output Format

The system outputs a structured JSON with:

- `json_output`: Complete video generation plan
  - `version`: Version identifier
  - `generated_at`: ISO8601 timestamp
  - `project_id`: Project identifier
  - `video_settings`: Video configuration
  - `assets`: Asset list
  - `timeline`: Precise timeline events with transforms
  - `audio_mix`: Audio track configuration
  - `subtitles`: Subtitle tracks
  - `ffmpeg_commands`: Generated FFmpeg commands
  - `react_timeline`: React-compatible timeline data
  - `assumptions`: Processing assumptions
  - `safety_issue`: Safety flag
  - `safety_reason`: Safety issue description
  - `total_duration`: Total video duration in seconds
- `human_summary`: Human-readable summary (max 25 words)

## Frontend Features

The React frontend provides:

- **Timeline Visualization**: Visual representation of video segments, audio tracks, and subtitles
- **Interactive Player**: Play/pause controls and timeline scrubbing
- **Real-time Preview**: See current segment, subtitles, and active audio tracks
- **API Integration**: Connect to backend API for video generation

## Agent Roles

1. **Chief Video Architect (CVA)**: Plans video structure and segment flow
2. **Creative Director (CD)**: Creates creative direction and Ken Burns paths
3. **Video Engineer (VE)**: Builds technical timeline with millisecond precision
4. **Audio Engineer (AE)**: Mixes audio tracks with ducking and normalization
5. **Safety & Compliance Officer (SCO)**: Validates safety and compliance
6. **Output Compiler (OC)**: Compiles final JSON output

## Requirements

- Node.js 18+
- FFmpeg (for video generation)
- LLM API key (OpenAI or Anthropic)

## Development

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run CLI in development
npm run dev generate -i example-input.json

# Start API server
npm start
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Full Stack Development

1. Start the backend API server:
   ```bash
   cd backend
   npm start
   ```

2. Start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser

## License

MIT
