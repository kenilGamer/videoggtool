import { useState, useEffect, useRef } from 'react'

export interface TimelinePlayerProps {
  timeline: {
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
}

export default function TimelinePlayer({ timeline }: TimelinePlayerProps) {
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const intervalRef = useRef<number | null>(null)

  // Calculate total duration from segments
  useEffect(() => {
    const maxEnd = Math.max(
      ...timeline.segments.map(seg => seg.end),
      ...timeline.audio.map(a => a.end),
      ...timeline.subtitles.map(s => s.end)
    )
    setDuration(maxEnd)
  }, [timeline])

  // Playback control
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.1
          if (next >= duration) {
            setIsPlaying(false)
            return duration
          }
          return next
        })
      }, 100)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, duration])

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get current segment
  const currentSegment = timeline.segments.find(
    seg => currentTime >= seg.start && currentTime <= seg.end
  )

  // Get current subtitle
  const currentSubtitle = timeline.subtitles.find(
    sub => currentTime >= sub.start && currentTime <= sub.end
  )

  // Get active audio tracks
  const activeAudio = timeline.audio.filter(
    audio => currentTime >= audio.start && currentTime <= audio.end
  )

  return (
    <div className="bg-white rounded-xl p-8 shadow-lg text-gray-800">
      <div className="flex items-center gap-4 mb-4">
        <button 
          onClick={togglePlay} 
          className="w-12 h-12 rounded-full border-none bg-indigo-500 text-white text-2xl flex items-center justify-center transition-colors hover:bg-indigo-600 cursor-pointer"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        <div className="font-mono text-lg text-gray-600">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="mb-8">
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 rounded bg-gray-200 outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-indigo-500 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer"
        />
      </div>

      <div className="mb-8">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="min-w-[120px] font-semibold text-gray-600 text-right pt-2">
              Video Segments
            </div>
            <div className="flex-1 relative h-10 bg-gray-100 rounded overflow-hidden">
              {timeline.segments.map(seg => (
                <div
                  key={seg.id}
                  className={`absolute h-full bg-indigo-500 rounded flex items-center justify-center text-white text-sm font-medium transition-all cursor-pointer border-2 ${
                    currentSegment?.id === seg.id 
                      ? 'bg-purple-600 border-purple-800 shadow-[0_0_0_3px_rgba(118,75,162,0.3)] -translate-y-0.5' 
                      : 'border-transparent hover:border-indigo-600 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                  style={{
                    left: `${(seg.start / duration) * 100}%`,
                    width: `${((seg.end - seg.start) / duration) * 100}%`,
                  }}
                  title={`${seg.asset} (${formatTime(seg.start)} - ${formatTime(seg.end)})`}
                >
                  <span className="px-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    {seg.asset}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="min-w-[120px] font-semibold text-gray-600 text-right pt-2">
              Audio
            </div>
            <div className="flex-1 relative h-10 bg-gray-100 rounded overflow-hidden">
              {timeline.audio.map(audio => (
                <div
                  key={audio.id}
                  className={`absolute h-full bg-green-500 rounded flex items-center justify-center text-white text-sm font-medium transition-all cursor-pointer border-2 ${
                    activeAudio.some(a => a.id === audio.id)
                      ? 'bg-green-600 border-green-800'
                      : 'border-transparent hover:border-green-600 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                  style={{
                    left: `${(audio.start / duration) * 100}%`,
                    width: `${((audio.end - audio.start) / duration) * 100}%`,
                    opacity: audio.volume,
                  }}
                  title={`${audio.src} (${formatTime(audio.start)} - ${formatTime(audio.end)})`}
                >
                  <span className="px-2">🎵</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-indigo-500">
        {currentSegment && (
          <div className="mb-2 last:mb-0">
            <strong className="text-indigo-500 mr-2">Current Segment:</strong> {currentSegment.asset}
            {currentSegment.caption && (
              <div className="mt-2 p-2 bg-white rounded italic text-gray-600">
                {currentSegment.caption}
              </div>
            )}
          </div>
        )}
        {currentSubtitle && (
          <div className="mb-2 last:mb-0">
            <strong className="text-indigo-500 mr-2">Subtitle:</strong> {currentSubtitle.text}
          </div>
        )}
        {activeAudio.length > 0 && (
          <div className="mb-2 last:mb-0">
            <strong className="text-indigo-500 mr-2">Audio Tracks:</strong> {activeAudio.length} active
          </div>
        )}
      </div>
    </div>
  )
}

