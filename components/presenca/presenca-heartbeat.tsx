'use client'

import { useEffect } from 'react'

async function ping() {
  try {
    await fetch('/api/presenca', { method: 'POST' })
  } catch {
    // silencioso: presença não pode quebrar a UI
  }
}

export function PresencaHeartbeat() {
  useEffect(() => {
    let interval: number | null = null

    // ping inicial
    ping()

    const start = () => {
      if (interval) window.clearInterval(interval)
      interval = window.setInterval(ping, 30_000)
    }

    const stop = () => {
      if (interval) window.clearInterval(interval)
      interval = null
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping()
        start()
      } else {
        stop()
      }
    }

    start()
    window.addEventListener('focus', ping)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      window.removeEventListener('focus', ping)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}

