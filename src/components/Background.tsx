import { useEffect, useRef, useState } from 'react'
import { useStore, Theme } from '../store/useStore'
import blackholeVideo from '../../vid/blackhole.mp4'
import blackholeStill from '../assets/blackhole.jpg'

const FALLBACK: Record<Theme, string> = {
  void: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(56,189,248,0.15), transparent 60%), #050508',
  pulse: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(168,85,247,0.18), transparent 60%), #050508',
  neon: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.18), transparent 60%), #050508',
}

export default function Background() {
  const { theme, backgrounds, liveWallpaper } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  // Precedence: custom theme image → live black hole → static still → gradient.
  const customActive = Boolean(backgrounds[theme])
  const showVideo = liveWallpaper && !customActive && !reducedMotion
  const showStill = !customActive && !showVideo

  // Respect prefers-reduced-motion and only animate while the window is visible.
  // (backgroundThrottling is disabled app-wide, so the video would otherwise
  // keep playing in the tray.)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const play = () => {
      if (!showVideo || document.visibilityState !== 'visible') return
      video.play().catch(() => {})
    }
    const pause = () => video.pause()
    const onVisibility = () => (document.visibilityState === 'visible' ? play() : pause())
    document.addEventListener('visibilitychange', onVisibility)
    play()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      pause()
    }
  }, [showVideo])

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#050508]">
      {/* Base: themed radial glow (also the fallback if nothing above loads) */}
      <div className="absolute inset-0" style={{ background: FALLBACK[theme] }} />

      {/* Live black-hole wallpaper (vid/blackhole.mp4) */}
      <video
        ref={videoRef}
        src={blackholeVideo}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
        style={{ opacity: showVideo ? 1 : 0 }}
      />

      {/* Static black-hole still when the video is off or motion is reduced */}
      <img
        src={blackholeStill}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out${showStill ? ' bh-fade-in' : ''}`}
        style={{ opacity: showStill ? 1 : 0 }}
      />

      {/* Per-theme custom images, crossfading with the active theme */}
      {(['void', 'pulse', 'neon'] as Theme[]).map(t => {
        const src = backgrounds[t]
        const active = theme === t
        if (!src) return null
        return (
          <div
            key={t}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: active ? 1 : 0 }}
          >
            <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )
      })}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
    </div>
  )
}
