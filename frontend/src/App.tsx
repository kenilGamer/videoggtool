import { useState } from 'react'
import TimelinePlayer from './components/TimelinePlayer'

export interface VideoTimeline {
  segments: Array<{
    id: string
    start: number
    end: number
    asset: string
    transforms: any
    caption?: string
  }>
  audio: Array<{
    id: string
    start: number
    end: number
    src: string
    volume: number
  }>
  subtitles: Array<{
    id: string
    start: number
    end: number
    text: string
  }>
}

function App() {
  const [timeline, setTimeline] = useState<VideoTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Example: Load timeline from API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: 'demo-001',
          video_settings: {
            resolution: '1920x1080',
            fps: 30,
            format: 'mp4',
            codec: 'libx264',
            crf: 18,
          },
          assets: [
            { id: 'img1', type: 'image', src: 'https://example.com/image1.jpg' },
          ],
          instructions: {
            style: 'cinematic',
            camera_movement: 'kenburns',
            transitions: 'crossfade',
            target_duration: 10,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate video')
      }

      const data = await response.json()
      if (data.json_output?.react_timeline) {
        setTimeline(data.json_output.react_timeline)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col">
      <header className="p-8 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <h1 className="text-4xl font-bold mb-2">Video Generation Tool</h1>
        <p className="opacity-90">Multi-agent video generation system</p>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <button 
            onClick={handleGenerate} 
            disabled={loading}
            className="px-8 py-4 text-lg bg-indigo-500 text-white rounded-lg border-none cursor-pointer transition-colors hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate Video'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-8">
            Error: {error}
          </div>
        )}

        {timeline && (
          <TimelinePlayer timeline={timeline} />
        )}
      </main>
    </div>
  )
}

export default App

