'use client'
import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
  twinkleSpeed: number
  twinklePhase: number
}

interface Nebula {
  x: number
  y: number
  rx: number
  ry: number
  color: string
  opacity: number
  driftX: number
  driftY: number
}

export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let time = 0

    // Generate stars
    const stars: Star[] = Array.from({ length: 220 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 1.8 + 0.3,
      speed: Math.random() * 0.02 + 0.005,
      opacity: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinklePhase: Math.random() * Math.PI * 2,
    }))

    // Generate nebula blobs
    const nebulae: Nebula[] = [
      { x: 0.15, y: 0.2, rx: 350, ry: 200, color: '#c026d3', opacity: 0.04, driftX: 0.00008, driftY: 0.00003 },
      { x: 0.75, y: 0.7, rx: 400, ry: 250, color: '#22d3ee', opacity: 0.035, driftX: -0.00005, driftY: 0.00006 },
      { x: 0.5, y: 0.5, rx: 500, ry: 300, color: '#4f46e5', opacity: 0.025, driftX: 0.00003, driftY: -0.00004 },
      { x: 0.85, y: 0.15, rx: 280, ry: 180, color: '#a3e635', opacity: 0.02, driftX: -0.00006, driftY: 0.00005 },
    ]

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw() {
      const w = canvas!.width
      const h = canvas!.height
      ctx!.clearRect(0, 0, w, h)

      // Deep space background
      ctx!.fillStyle = '#0a0a0f'
      ctx!.fillRect(0, 0, w, h)

      // Nebulae
      nebulae.forEach((n) => {
        const nx = ((n.x + n.driftX * time) % 1.3 - 0.15) * w
        const ny = ((n.y + n.driftY * time) % 1.3 - 0.15) * h

        const grad = ctx!.createRadialGradient(nx, ny, 0, nx, ny, Math.max(n.rx, n.ry))
        grad.addColorStop(0, n.color + Math.round(n.opacity * 255).toString(16).padStart(2, '0'))
        grad.addColorStop(1, 'transparent')

        ctx!.save()
        ctx!.scale(1, n.ry / n.rx)
        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.ellipse(nx, ny * (n.rx / n.ry), n.rx, n.rx, 0, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.restore()
      })

      // Stars
      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed * 60 + star.twinklePhase) * 0.4 + 0.6
        const alpha = star.opacity * twinkle

        // Star glow
        if (star.size > 1.2) {
          const grd = ctx!.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 3)
          grd.addColorStop(0, `rgba(200, 220, 255, ${alpha * 0.4})`)
          grd.addColorStop(1, 'transparent')
          ctx!.fillStyle = grd
          ctx!.beginPath()
          ctx!.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2)
          ctx!.fill()
        }

        ctx!.fillStyle = `rgba(210, 230, 255, ${alpha})`
        ctx!.beginPath()
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx!.fill()
      })

      time++
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -1 }}
    />
  )
}
