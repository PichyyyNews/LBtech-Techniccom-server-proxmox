import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import {
  Terminal,
  Minimize2,
  Maximize2,
  ExternalLink,
  RotateCw,
  X,
  ChevronUp,
  Activity,
  CheckCircle2,
  Wifi,
  WifiOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface EmbeddedTerminalProps {
  server: {
    vmid: number | string
    name: string
    os: string
    ip: string
    status: string
    containerId?: string
  }
  mode: 'embedded' | 'minimized' | 'fullscreen'
  onModeChange: (mode: 'embedded' | 'minimized' | 'fullscreen') => void
  onClose: () => void
  className?: string
}

export function EmbeddedTerminal({
  server,
  mode,
  onModeChange,
  onClose,
  className
}: EmbeddedTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstance = useRef<XTerm | null>(null)
  const fitAddonInstance = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pingTimerRef = useRef<any>(null)

  const [connStatus, setConnStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')

  // Open Popout Window
  const handleOpenNewWindow = () => {
    const popUrl = `/terminal/${server.vmid}`
    window.open(popUrl, `terminal_${server.vmid}`, 'width=960,height=600,menubar=no,toolbar=no,location=no,status=no')
  }

  // Connect WebSocket & Init Terminal
  const connectTerminal = () => {
    if (!terminalRef.current) return

    // Clean up prior instance
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (xtermInstance.current) {
      xtermInstance.current.dispose()
      xtermInstance.current = null
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: isMobile ? 11 : 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace, "Noto Sans Thai"',
      letterSpacing: 0.5,
      lineHeight: isMobile ? 1.2 : 1.25,
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)

    terminalRef.current.innerHTML = ''
    term.open(terminalRef.current)

    // Initial fit
    setTimeout(() => {
      try { fitAddon.fit() } catch {}
    }, 100)

    xtermInstance.current = term
    fitAddonInstance.current = fitAddon

    // Establish WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/ct/terminal/${server.vmid}`

    setConnStatus('connecting')
    term.writeln(`\x1b[90mConnecting to web terminal at ${wsUrl}...\x1b[0m`)

    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      setConnStatus('connected')
      try {
        fitAddon.fit()
        ws.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows
        }))
      } catch {}

      // Keepalive heartbeat every 20s to prevent Cloudflare / Nginx idle connection drop
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 20000)
    }

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        term.write(event.data)
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      }
    }

    ws.onerror = () => {
      setConnStatus('error')
      term.writeln(`\r\n\x1b[31m[WebSocket Error] ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Terminal ได้\x1b[0m\r\n`)
    }

    ws.onclose = () => {
      setConnStatus('disconnected')
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
      term.writeln(`\r\n\x1b[33m[Connection Closed] การเชื่อมต่อถูกปิด (หมดเวลา Idle หรือไม่มีการส่งข้อมูล)\x1b[0m`)
      term.writeln(`\x1b[90m💡 กดปุ่ม [Enter] บนคีย์บอร์ด หรือคลิกปุ่มรีคอนเน็กต์ที่มุมบนขวา เพื่อเชื่อมต่อใหม่ทันที\x1b[0m\r\n`)
    }

    // Forward user key input to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        // Auto-reconnect when pressing Enter if terminal was closed
        if (data === '\r' || data === '\n') {
          connectTerminal()
        }
      }
    })
  }

  // Handle Resize
  useEffect(() => {
    if (mode === 'minimized') return

    const handleResize = () => {
      if (fitAddonInstance.current && xtermInstance.current && wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          fitAddonInstance.current.fit()
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: xtermInstance.current.cols,
            rows: xtermInstance.current.rows
          }))
        } catch {}
      }
    }

    const timer = setTimeout(handleResize, 150)
    window.addEventListener('resize', handleResize)

    // Also observe container DOM element resize
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && terminalRef.current) {
      ro = new ResizeObserver(() => {
        handleResize()
      })
      ro.observe(terminalRef.current)
    }

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handleResize)
      if (ro) ro.disconnect()
    }
  }, [mode])

  // Initialize terminal on mount
  useEffect(() => {
    connectTerminal()
    return () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (xtermInstance.current) {
        xtermInstance.current.dispose()
        xtermInstance.current = null
      }
    }
  }, [server.vmid])

  // MINIMIZED BAR VIEW (At bottom of screen)
  if (mode === 'minimized') {
    return (
      <div className="fixed bottom-4 right-4 z-40 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl px-3.5 py-2 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${connStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : connStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'}`} />
          <Terminal className="h-4 w-4 text-zinc-300" />
          <span className="text-xs font-semibold text-zinc-100 font-mono">
            {server.name}
          </span>
          <span className="text-[10px] text-zinc-400">
            ({connStatus})
          </span>
        </div>

        <div className="flex items-center gap-1 border-l border-zinc-700/80 pl-2">
          <button
            type="button"
            onClick={() => onModeChange('embedded')}
            className="p-1 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="เปิดหน้าต่างคอนโซลปกติ"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onModeChange('fullscreen')}
            className="p-1 rounded-md text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="ขยายเต็มจอ (Full Screen)"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="ปิด Terminal"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // FULLSCREEN OR EMBEDDED CONTAINER STYLES
  const containerClasses = mode === 'fullscreen'
    ? 'fixed inset-0 z-50 bg-[#0d1117] flex flex-col'
    : `border-0 sm:border border-zinc-800 rounded-none sm:rounded-xl overflow-hidden bg-[#0d1117] shadow-none sm:shadow-xs flex flex-col w-full ${className || 'h-[65vh] sm:h-full min-h-[380px] sm:min-h-[580px]'}`

  const terminalHeight = mode === 'fullscreen'
    ? 'flex-1 h-full'
    : 'flex-1 w-full min-h-[340px] sm:min-h-[460px]'

  return (
    <div className={containerClasses}>
      {/* Top Header Bar - Clean Monochrome Engineering Grade */}
      <div className="flex items-center justify-between px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-zinc-900 border-b border-zinc-800 text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 font-mono min-w-0">
            <Terminal className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <span className="font-semibold text-zinc-100 tracking-tight truncate max-w-[110px] sm:max-w-none">{server.name}</span>
            <span className="text-[11px] text-zinc-400 hidden md:inline">({server.os})</span>
          </div>

          <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium shrink-0 ${
            connStatus === 'connected'
              ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
              : connStatus === 'connecting'
              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              : 'bg-zinc-800 text-zinc-500 border border-zinc-700/60'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connStatus === 'connected' ? 'bg-zinc-100' : connStatus === 'connecting' ? 'bg-zinc-400 animate-pulse' : 'bg-zinc-600'}`} />
            {connStatus === 'connected' ? 'Connected' : connStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 text-zinc-400 shrink-0">
          {/* Reconnect */}
          <button
            type="button"
            onClick={connectTerminal}
            className="p-1 sm:p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title="รีคอนเน็กต์ (Reconnect)"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>

          {/* New Tab / Window Popout */}
          <button
            type="button"
            onClick={handleOpenNewWindow}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer hidden sm:inline-flex"
            title="เปิดในหน้าต่างใหม่ (New Window Popout)"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>

          {/* Minimize */}
          <button
            type="button"
            onClick={() => onModeChange('minimized')}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer hidden sm:inline-flex"
            title="ย่อขนาดเก็บไว้ที่แถบล่าง (Minimize)"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>

          {/* Full Screen Toggle */}
          <button
            type="button"
            onClick={() => onModeChange(mode === 'fullscreen' ? 'embedded' : 'fullscreen')}
            className="p-1 sm:p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title={mode === 'fullscreen' ? 'คืนค่าขนาดเดิม' : 'ขยายเต็มหน้าจอ (Full Screen)'}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition-colors cursor-pointer ml-0.5 sm:ml-1"
            title="ปิดคอนโซล"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Canvas */}
      <div
        ref={terminalRef}
        className={`${terminalHeight} p-1 sm:p-2 bg-[#0d1117] overflow-hidden`}
        style={{ minHeight: '320px' }}
      />
    </div>
  )
}
