import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Users,
  Server,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  RefreshCw,
  Cpu,
  HardDrive,
  Activity,
  Play,
  Square,
  RotateCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Database,
  Radio,
  FileDown,
  ExternalLink,
  MessageSquare,
  HelpCircle,
  Send,
  Sparkles,
  Layers,
  Zap,
  BarChart3,
  Gauge,
  X,
  ShieldAlert,
  Flame,
  Globe
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { renderOSLogo } from '@/components/OSLogos'

export interface ProcessItem {
  user: string
  pid: number
  cpu: number
  mem: number
  vsz: string
  rss: string
  stat: string
  time: string
  command: string
  vmid?: number
  serverName?: string
  studentId?: string
}

export interface PoolServerItem {
  vmid: number
  studentId: string
  serverName: string
  containerId: string
  containerName: string
  os: string
  osKey?: string
  ip: string
  status: 'running' | 'stopped'
  vcpu: number
  ram: number
  disk: number
  customDomain?: string
  webPort?: number
  stats: {
    running: boolean
    cpuPercent: number
    memPercent: number
    memUsageMB: number
    memLimitMB: number
    diskUsageMB: number
    diskLimitGB: number
    diskPercent: number
    diskQuotaExceeded: boolean
    pids: number
  }
  processCount: number
  topProcess: ProcessItem | null
}

export interface PoolData {
  success: boolean
  timestamp: string
  nodeInfo: {
    nodeName: string
    model: string
    ncpu: number
    hostMemTotalMB: number
    dockerVersion: string
    os: string
    containersRunning: number
    containersTotal: number
  }
  poolSummary: {
    totalServers: number
    runningServers: number
    stoppedServers: number
    totalCpuPercent: number
    avgCpuPercent: number
    totalUsedRamMB: number
    totalAllocatedRamMB: number
    hostMemTotalMB: number
    ramPercentOfHost: number
    totalUsedDiskMB: number
    totalAllocatedDiskGB: number
    totalAllocatedVcpu: number
  }
  servers: PoolServerItem[]
  topProcesses: ProcessItem[]
}

export interface EnrichedStudent {
  studentId: string
  fullName: string
  projectTitle: string
  department: string
  password: string
  token: string
  influxBucket?: string
  influxToken?: string
  mqttUsername?: string
  mqttTopicPrefix?: string
  createdAt?: string
  servers?: Array<{
    vmid: number
    name: string
    ip: string
    os: string
    status: string
  }>
  requests?: Array<{
    id: string
    serverName: string
    status: string
  }>
}

export interface AdminPanelProps {
  adminPin: string
  onLock: () => void
  onApproveRequest: (req: any) => Promise<void>
  onRejectRequest: (id: string, reason?: string) => Promise<void>
  onTogglePower: (vmid: number) => Promise<void>
  onReboot: (vmid: number) => Promise<void>
  onDestroyServer: (vmid: number) => Promise<void>
  onOpenTerminal: (server: any) => void
  ctRequests: any[]
  ctServers: any[]
}

export interface SupportTicket {
  id: string
  studentId: string
  studentName?: string
  category: string
  subject: string
  description: string
  status: 'pending' | 'in_progress' | 'resolved'
  adminReply?: string
  createdAt: string
  updatedAt: string
}

export function AdminPanel({
  adminPin,
  onLock,
  onApproveRequest,
  onRejectRequest,
  onTogglePower,
  onReboot,
  onDestroyServer,
  onOpenTerminal,
  ctRequests,
  ctServers
}: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'pool' | 'servers' | 'passwords' | 'queue' | 'tickets'>('pool')
  const [students, setStudents] = useState<EnrichedStudent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [revealedPasswords, setRevealedPasswords] = useState<{ [id: string]: boolean }>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null)

  // Real-time Cluster / Pool Streaming State
  const [poolData, setPoolData] = useState<PoolData | null>(null)
  const [isPoolStreamConnected, setIsPoolStreamConnected] = useState(false)
  const [poolFilterQuery, setPoolFilterQuery] = useState('')

  // Single Server Process Inspector Modal State
  const [selectedProcessServer, setSelectedProcessServer] = useState<any | null>(null)
  const [serverProcessStreamData, setServerProcessStreamData] = useState<{
    stats?: any
    processes?: ProcessItem[]
  } | null>(null)
  const [isProcessStreamConnected, setIsProcessStreamConnected] = useState(false)
  const [processSearchQuery, setProcessSearchQuery] = useState('')
  const [isKillingPid, setIsKillingPid] = useState<number | null>(null)
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')

  // Connect to Pool SSE Stream
  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: any = null
    let isCancelled = false

    const connectPoolStream = () => {
      if (isCancelled) return
      try {
        es = new EventSource(`/api/admin/pool/stream?pin=${encodeURIComponent(adminPin)}`)
        es.onopen = () => {
          if (!isCancelled) setIsPoolStreamConnected(true)
        }
        es.onmessage = (event) => {
          if (isCancelled) return
          try {
            const data = JSON.parse(event.data)
            if (data && data.poolSummary) {
              setPoolData(data)
              setIsPoolStreamConnected(true)
            }
          } catch (e) {
            console.error('Pool SSE parse error:', e)
          }
        }
        es.onerror = () => {
          if (isCancelled) return
          setIsPoolStreamConnected(false)
          es?.close()
          reconnectTimer = setTimeout(connectPoolStream, 3000)
        }
      } catch (err) {
        setIsPoolStreamConnected(false)
      }
    }

    connectPoolStream()

    return () => {
      isCancelled = true
      if (es) es.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [adminPin])

  // Connect to Single Server Stream when modal opens
  useEffect(() => {
    if (!selectedProcessServer) {
      setServerProcessStreamData(null)
      setIsProcessStreamConnected(false)
      return
    }

    let es: EventSource | null = null
    let isCancelled = false

    const connectServerStream = () => {
      if (isCancelled) return
      try {
        const vmid = selectedProcessServer.vmid
        es = new EventSource(`/api/admin/servers/${vmid}/stream?pin=${encodeURIComponent(adminPin)}`)
        es.onopen = () => {
          if (!isCancelled) setIsProcessStreamConnected(true)
        }
        es.onmessage = (event) => {
          if (isCancelled) return
          try {
            const data = JSON.parse(event.data)
            if (data && data.success) {
              setServerProcessStreamData({
                stats: data.stats,
                processes: data.processes || []
              })
              setIsProcessStreamConnected(true)
            }
          } catch (e) {
            console.error('Server SSE parse error:', e)
          }
        }
        es.onerror = () => {
          if (!isCancelled) setIsProcessStreamConnected(false)
        }
      } catch {
        setIsProcessStreamConnected(false)
      }
    }

    connectServerStream()

    return () => {
      isCancelled = true
      if (es) es.close()
    }
  }, [selectedProcessServer, adminPin])

  const handleKillProcess = async (vmid: number, pid: number, cmd: string) => {
    if (!confirm(`ยืนยันการบังคับปิดโปรเซส PID ${pid} (${cmd.slice(0, 40)})?`)) {
      return
    }
    setIsKillingPid(pid)
    try {
      const res = await fetch(`/api/admin/servers/${vmid}/processes/${pid}/kill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin
        }
      })
      const data = await res.json()
      if (res.ok) {
        setActionSuccessMsg(`ยุติโปรเซส PID ${pid} สำเร็จแล้ว`)
        setTimeout(() => setActionSuccessMsg(''), 3000)
        if (serverProcessStreamData) {
          setServerProcessStreamData(prev => prev ? {
            ...prev,
            processes: (prev.processes || []).filter(p => p.pid !== pid)
          } : null)
        }
      } else {
        alert(data.error || 'ไม่สามารถยุติโปรเซสได้')
      }
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setIsKillingPid(null)
    }
  }

  // Support Tickets State
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketFilter, setTicketFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all')
  const [replyDrafts, setReplyDrafts] = useState<{ [id: string]: string }>({})
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null)

  // Fetch students from backend admin API
  const fetchStudents = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/students', {
        headers: { 'x-admin-pin': adminPin }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.students) {
          setStudents(data.students)
        }
      }
    } catch (err) {
      console.warn('[AdminPanel] Could not fetch from /api/admin/students:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets')
      if (res.ok) {
        const data = await res.json()
        if (data.tickets) {
          setTickets(data.tickets)
        }
      }
    } catch (err) {
      console.warn('[AdminPanel] Could not fetch tickets:', err)
    }
  }

  useEffect(() => {
    fetchStudents()
    fetchTickets()
  }, [adminPin])

  const handleUpdateTicket = async (id: string, newStatus: string) => {
    setUpdatingTicketId(id)
    try {
      const reply = replyDrafts[id] !== undefined ? replyDrafts[id] : (tickets.find(t => t.id === id)?.adminReply || '')
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, adminReply: reply })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ticket) {
          setTickets(prev => prev.map(t => t.id === id ? data.ticket : t))
        }
      }
    } catch (err) {
      console.error('Error updating ticket:', err)
    } finally {
      setUpdatingTicketId(null)
    }
  }

  // Copy to clipboard helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Toggle reveal password for single student
  const toggleReveal = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Toggle reveal all passwords
  const toggleRevealAll = () => {
    const allRevealed = students.every((s) => revealedPasswords[s.studentId])
    const nextState: { [id: string]: boolean } = {}
    students.forEach((s) => {
      nextState[s.studentId] = !allRevealed
    })
    setRevealedPasswords(nextState)
  }

  // Export CSV of student accounts
  const handleExportCsv = () => {
    const headers = ['รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'ชื่อโครงงาน', 'สาขาวิชา', 'รหัสผ่าน (Password)', 'InfluxDB Bucket', 'Influx Token', 'MQTT Topic']
    const rows = students.map((s) => [
      s.studentId,
      `"${s.fullName}"`,
      `"${s.projectTitle}"`,
      `"${s.department}"`,
      `"${s.password}"`,
      s.influxBucket || '',
      s.influxToken || '',
      s.mqttTopicPrefix || ''
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `lbtech_students_accounts_${new Date().toISOString().substring(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter students
  const filteredStudents = students.filter((s) => {
    const q = searchQuery.toLowerCase().trim()
    return (
      s.studentId.toLowerCase().includes(q) ||
      s.fullName.toLowerCase().includes(q) ||
      s.projectTitle.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q)
    )
  })

  const pendingRequests = ctRequests.filter((r) => r.status === 'pending')

  return (
    <div className="space-y-6">
      {/* HEADER BANNER - Clean Neutral Surface */}
      <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  แผงควบคุมอาจารย์และผู้ดูแลระบบ
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 uppercase">
                  Admin Master
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                ศูนย์กลางอนุมัติเครื่องเสมือน (Proxmox VE) ตรวจสอบรหัสผ่านนักศึกษา และมอนิเตอร์คลัสเตอร์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStudents}
              disabled={isLoading}
              className="h-8 text-xs border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              รีเฟรชข้อมูล
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onLock}
              className="h-8 text-xs bg-red-600/80 hover:bg-red-600 text-white"
            >
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              ล็อกโหมดอาจารย์
            </Button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-zinc-800/80">
          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>นักศึกษาในระบบ</span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {students.length} <span className="text-xs text-zinc-400 font-normal">คน</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>คำขอรออนุมัติ</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400 font-mono mt-1">
              {pendingRequests.length} <span className="text-xs text-zinc-400 font-normal">คำขอ</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>เครื่อง CT บน Proxmox</span>
              <Server className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-sky-400 font-mono mt-1">
              {ctServers.length} <span className="text-xs text-zinc-400 font-normal">เครื่อง</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Proxmox Node</span>
              <Activity className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-sm font-semibold text-emerald-400 font-mono mt-1 truncate">
              techniccom <span className="text-[10px] text-zinc-400">(DL20 Gen9)</span>
            </div>
          </div>
        </div>

        {/* QUICK ADMIN CONSOLES */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] text-zinc-400 font-medium mr-1">คอนโซลผู้ดูแลระบบ:</span>
          <a
            href="https://emqx.pichyy.qzz.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 hover:text-white transition-colors"
          >
            <Radio className="h-3 w-3 text-emerald-400" />
            <span>EMQX Broker Console</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
          <a
            href="https://influx.pichyy.qzz.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 hover:text-white transition-colors"
          >
            <Database className="h-3 w-3 text-purple-400" />
            <span>InfluxDB Admin UI</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
          <a
            href="https://100.125.250.85:8006"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-200 hover:text-white transition-colors"
          >
            <Server className="h-3 w-3 text-sky-400" />
            <span>Proxmox VE (Host)</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('pool')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all shrink-0 ${
            activeSubTab === 'pool'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span>ภาพรวม Resource Pool & โปรเซส</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('passwords')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all shrink-0 ${
            activeSubTab === 'passwords'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span>ทะเบียนนักศึกษา & รหัสผ่าน</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono">
            {students.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('queue')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            activeSubTab === 'queue'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>คิวคำขอเครื่องเซิร์ฟเวอร์</span>
          {pendingRequests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-mono animate-pulse">
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('servers')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            activeSubTab === 'servers'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>เครื่อง CT ที่ออนไลน์ทั้งหมด</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono">
            {ctServers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('tickets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
            activeSubTab === 'tickets'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>คำร้อง & ช่วยเหลือ</span>
          {tickets.filter(t => t.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-mono animate-pulse">
              {tickets.filter(t => t.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* ACTION SUCCESS NOTIFICATION */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg('')} className="text-zinc-400 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 0: CLUSTER RESOURCE POOL & PROCESS STREAM                    */}
      {/* ==================================================================== */}
      {activeSubTab === 'pool' && (
        <div className="space-y-6">
          {/* POOL HEADER & LIVE SSE STREAM STATUS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  สตรีมทรัพยากรคลัสเตอร์ & โปรเซส (Realtime Pool Stream)
                </h2>
                {isPoolStreamConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE SSE (2s)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950/80 border border-amber-800 text-amber-400">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    กำลังเชื่อมต่อสตรีม...
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                มอนิเตอร์การใช้งาน CPU, RAM, Disk และโปรเซสของคอนเทนเนอร์นักศึกษาแบบเรียลไทม์ พร้อมระบบสั่งยุติโปรเซส
              </p>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono">
              <span>โฮสต์: {poolData?.nodeInfo?.model || 'HP DL20 Gen9'}</span>
              <span>•</span>
              <span>{poolData?.nodeInfo?.ncpu || 2} Cores</span>
              <span>•</span>
              <span>{poolData?.nodeInfo?.hostMemTotalMB || 8192} MB</span>
            </div>
          </div>

          {/* 4 POOL SUMMARY METRIC CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* CPU POOL */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>CPU Pool โหลดเฉลี่ย</span>
                <Cpu className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-white">
                  {poolData?.poolSummary?.avgCpuPercent ?? 0}%
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, poolData?.poolSummary?.avgCpuPercent || 0)}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400 font-mono mt-1.5 block">
                  จัดสรร: {poolData?.poolSummary?.totalAllocatedVcpu || 0} vCPUs จาก {poolData?.nodeInfo?.ncpu || 2} คอร์
                </span>
              </div>
            </div>

            {/* RAM POOL */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>RAM คอนเทนเนอร์ที่ใช้จริง</span>
                <Activity className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-sky-400">
                  {poolData?.poolSummary?.totalUsedRamMB ?? 0}{' '}
                  <span className="text-xs text-zinc-400 font-normal">MB</span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, poolData?.poolSummary?.ramPercentOfHost || 0)}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400 font-mono mt-1.5 block">
                  {poolData?.poolSummary?.ramPercentOfHost ?? 0}% ของโฮสต์ ({poolData?.poolSummary?.hostMemTotalMB || 8192} MB)
                </span>
              </div>
            </div>

            {/* DISK POOL */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>พื้นที่ Workspace รวม</span>
                <HardDrive className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-amber-400">
                  {(poolData?.poolSummary?.totalUsedDiskMB || 0) > 1024
                    ? `${((poolData?.poolSummary?.totalUsedDiskMB || 0) / 1024).toFixed(2)} GB`
                    : `${poolData?.poolSummary?.totalUsedDiskMB || 0} MB`}
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (((poolData?.poolSummary?.totalUsedDiskMB || 0) /
                          ((poolData?.poolSummary?.totalAllocatedDiskGB || 10) * 1024)) *
                          100)
                      )}%`
                    }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400 font-mono mt-1.5 block">
                  โควตารวม: {poolData?.poolSummary?.totalAllocatedDiskGB || 0} GB NVMe
                </span>
              </div>
            </div>

            {/* CONTAINERS ONLINE */}
            <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 text-xs">
                <span>คอนเทนเนอร์ที่ทำงานอยู่</span>
                <Server className="h-4 w-4 text-purple-400" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-white">
                  {poolData?.poolSummary?.runningServers ?? ctServers.filter(s => s.status === 'running').length}
                  <span className="text-xs text-zinc-400 font-normal">
                    {' '}/ {poolData?.poolSummary?.totalServers ?? ctServers.length} เครื่อง
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500 rounded-full"
                    style={{
                      width: `${
                        (poolData?.poolSummary?.totalServers || 1) > 0
                          ? Math.round(
                              ((poolData?.poolSummary?.runningServers || 0) /
                                (poolData?.poolSummary?.totalServers || 1)) *
                                100
                            )
                          : 0
                      }%`
                    }}
                  />
                </div>
                <span className="text-[10px] text-zinc-400 font-mono mt-1.5 block">
                  {poolData?.poolSummary?.stoppedServers || 0} เครื่องปิดพักอยู่
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: LIVE CONTAINER STATS & PROCESS OVERVIEW */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5 text-emerald-400" />
                  <span>สถานะทรัพยากรเครื่องนักศึกษาแบบสด ({poolData?.servers?.length || ctServers.length} เครื่อง)</span>
                </h3>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="ค้นหาเครื่อง หรือรหัสนักศึกษา..."
                  value={poolFilterQuery}
                  onChange={(e) => setPoolFilterQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-200"
                />
              </div>
            </div>

            {/* CONTAINER LIST */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(poolData?.servers || ctServers)
                .filter((srv) => {
                  const q = poolFilterQuery.toLowerCase().trim()
                  if (!q) return true
                  return (
                    String(srv.vmid).includes(q) ||
                    (srv.serverName || srv.name || '').toLowerCase().includes(q) ||
                    (srv.studentId || '').toLowerCase().includes(q)
                  )
                })
                .map((server: any) => {
                  const stats = server.stats || {
                    running: server.status === 'running',
                    cpuPercent: 0,
                    memUsageMB: 0,
                    memLimitMB: server.ram || 1024,
                    memPercent: 0,
                    diskUsageMB: 0,
                    diskLimitGB: server.disk || 10,
                    diskPercent: 0,
                    pids: 0
                  }
                  const isRunning = server.status === 'running' || stats.running

                  return (
                    <div
                      key={server.vmid}
                      className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 text-xs"
                    >
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                          {renderOSLogo(server.osKey || 'debian-12', 'h-4 w-4')}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-white text-xs">
                                CT {server.vmid}
                              </span>
                              <span className="text-zinc-400 font-medium truncate max-w-[150px]">
                                {server.serverName || server.name}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block">
                              ID: {server.studentId}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${
                              isRunning
                                ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-400'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                              }`}
                            />
                            {isRunning ? 'RUNNING' : 'STOPPED'}
                          </span>
                        </div>
                      </div>

                      {/* Resource Meters Row */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* CPU */}
                        <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>CPU</span>
                            <span className="font-mono font-bold text-zinc-200">
                              {stats.cpuPercent}%
                            </span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                stats.cpuPercent > 80
                                  ? 'bg-red-500'
                                  : stats.cpuPercent > 50
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, stats.cpuPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* RAM */}
                        <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>RAM</span>
                            <span className="font-mono font-bold text-sky-400">
                              {stats.memUsageMB} MB
                            </span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, stats.memPercent)}%` }}
                            />
                          </div>
                        </div>

                        {/* DISK */}
                        <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80">
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>ดิสก์</span>
                            <span className="font-mono font-bold text-amber-400">
                              {stats.diskUsageMB} MB
                            </span>
                          </div>
                          <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, stats.diskPercent)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Top Process Preview & PIDs */}
                      <div className="flex items-center justify-between text-[11px] bg-zinc-950/40 p-2 rounded-lg border border-zinc-800/60">
                        <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                          <Flame className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span className="text-zinc-400 text-[10px]">โปรเซสหลัก:</span>
                          <span className="font-mono text-[10px] text-zinc-200 truncate">
                            {server.topProcess
                              ? `${server.topProcess.command.slice(0, 32)} (PID ${server.topProcess.pid})`
                              : isRunning
                              ? 'bash / sshd'
                              : 'เครื่องปิดอยู่'}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {stats.pids || 0} PIDs
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedProcessServer(server)}
                          className="h-7 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                        >
                          <Activity className="h-3 w-3 mr-1.5 text-emerald-400" />
                          ตรวจสอบโปรเซส (Live)
                        </Button>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenTerminal(server)}
                            className="h-7 text-xs text-zinc-400 hover:text-white"
                            title="เปิด Terminal"
                          >
                            <Terminal className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onTogglePower(server.vmid)}
                            className="h-7 text-xs text-zinc-400 hover:text-white"
                            title={isRunning ? 'ปิดเครื่อง' : 'เปิดเครื่อง'}
                          >
                            {isRunning ? (
                              <Square className="h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <Play className="h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onReboot(server.vmid)}
                            className="h-7 text-xs text-zinc-400 hover:text-white"
                            title="รีบูต"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* SECTION 2: TOP RESOURCE-CONSUMING PROCESSES ACROSS POOL */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-red-400" />
                <span>โปรเซสที่มีการใช้งานทรัพยากรสูงสุดในคลัสเตอร์ (Top Pool Processes)</span>
              </h3>
              <span className="text-[11px] text-zinc-400 font-mono">
                {poolData?.topProcesses?.length || 0} โปรเซส
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/90">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider bg-zinc-950/60 font-mono">
                    <th className="py-2.5 px-3">เครื่อง / นศ.</th>
                    <th className="py-2.5 px-3">PID</th>
                    <th className="py-2.5 px-3">USER</th>
                    <th className="py-2.5 px-3">%CPU</th>
                    <th className="py-2.5 px-3">%MEM</th>
                    <th className="py-2.5 px-3">เวลา</th>
                    <th className="py-2.5 px-3">คำสั่งที่รัน (Command)</th>
                    <th className="py-2.5 px-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 font-mono text-[11px]">
                  {!poolData?.topProcesses || poolData.topProcesses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-500 font-sans">
                        ไม่มีโปรเซสที่กำลังทำงานในเครื่องนักเรียนขณะนี้
                      </td>
                    </tr>
                  ) : (
                    poolData.topProcesses.map((p, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-white">CT {p.vmid}</span>
                          <span className="text-zinc-500 block text-[10px]">
                            {p.studentId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-300 font-bold">{p.pid}</td>
                        <td className="py-2.5 px-3 text-zinc-400">{p.user}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              p.cpu > 50
                                ? 'bg-red-950/80 text-red-400 border border-red-800'
                                : p.cpu > 20
                                ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                                : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {p.cpu}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-sky-400">{p.mem}%</td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[10px]">{p.time}</td>
                        <td className="py-2.5 px-3 text-zinc-200 max-w-xs truncate" title={p.command}>
                          {p.command}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleKillProcess(p.vmid || 0, p.pid, p.command)}
                            disabled={isKillingPid === p.pid}
                            className="h-6 text-[10px] px-2 bg-red-600/80 hover:bg-red-600 text-white cursor-pointer"
                          >
                            {isKillingPid === p.pid ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              'ยุติ (Kill)'
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 1: STUDENT PASSWORDS VIEWER TABLE                             */}
      {/* ==================================================================== */}
      {activeSubTab === 'passwords' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                placeholder="ค้นหาตามรหัสนักศึกษา, ชื่อ-นามสกุล, หรือโครงงาน..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleRevealAll}
                className="h-9 text-xs border-zinc-300 dark:border-zinc-700"
              >
                {students.every((s) => revealedPasswords[s.studentId]) ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                    ซ่อนรหัสผ่านทั้งหมด
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    แสดงรหัสผ่านทั้งหมด
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-9 text-xs border-zinc-300 dark:border-zinc-700"
              >
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                ส่งออก CSV
              </Button>
            </div>
          </div>

          {/* TABLE */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-3.5">รหัสนักศึกษา</th>
                    <th className="py-3 px-3.5">ชื่อ - นามสกุล</th>
                    <th className="py-3 px-3.5">ชื่อโครงงาน</th>
                    <th className="py-3 px-3.5">🔑 รหัสผ่าน (Password)</th>
                    <th className="py-3 px-3.5">InfluxDB Bucket & Token</th>
                    <th className="py-3 px-3.5">เครื่อง CT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 italic">
                        {isLoading ? 'กำลังโหลดข้อมูลจากฐานข้อมูล...' : 'ไม่พบข้อมูลนักศึกษาที่ค้นหา'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st) => {
                      const isRevealed = revealedPasswords[st.studentId]
                      return (
                        <tr key={st.studentId} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                          {/* Student ID */}
                          <td className="py-3 px-3.5 font-mono font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                            {st.studentId}
                          </td>

                          {/* Full Name */}
                          <td className="py-3 px-3.5 font-medium text-zinc-800 dark:text-zinc-200">
                            {st.fullName}
                            <span className="block text-[10px] text-zinc-400 font-normal">
                              {st.department || 'เทคโนโลยีคอมพิวเตอร์'}
                            </span>
                          </td>

                          {/* Project Title */}
                          <td className="py-3 px-3.5 text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate" title={st.projectTitle}>
                            {st.projectTitle}
                          </td>

                          {/* Password */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-mono text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-bold ${
                                  isRevealed ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 tracking-widest'
                                }`}
                              >
                                {isRevealed ? st.password : '••••••••'}
                              </span>

                              <button
                                type="button"
                                onClick={() => toggleReveal(st.studentId)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                title={isRevealed ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                              >
                                {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopy(st.password, `pass_${st.studentId}`)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                title="คัดลอกรหัสผ่าน"
                              >
                                {copiedKey === `pass_${st.studentId}` ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* InfluxDB & MQTT */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-[11px] text-zinc-700 dark:text-zinc-300 font-mono">
                                <Database className="h-3 w-3 text-purple-400 shrink-0" />
                                <span className="truncate max-w-[120px]">{st.influxBucket || `telemetry-${st.studentId}`}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                                <Radio className="h-2.5 w-2.5 text-sky-400 shrink-0" />
                                <span>lbtech/{st.studentId}/#</span>
                              </div>
                            </div>
                          </td>

                          {/* CT Servers */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {st.servers && st.servers.length > 0 ? (
                              <div className="space-y-1">
                                {st.servers.map((srv) => (
                                  <span
                                    key={srv.vmid}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                                  >
                                    CT {srv.vmid} ({srv.ip})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-[11px] italic">ยังไม่มีเครื่อง</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 2: CT REQUESTS QUEUE                                         */}
      {/* ==================================================================== */}
      {activeSubTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <span>คำขอที่รอการตรวจสอบ ({pendingRequests.length} รายการ)</span>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">ไม่มีคำขอค้างอยู่</div>
              <p className="text-xs text-zinc-400 mt-1">คำขอเครื่องเซิร์ฟเวอร์ทั้งหมดได้รับการพิจารณาครบถ้วนแล้ว</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">
                        {req.serverName && req.serverName.replace(/^[-_.]+|[-_.]+$/g, '')
                          ? req.serverName.replace(/^[-_.]+|[-_.]+$/g, '')
                          : 'web-node (ชื่ออัตโนมัติ)'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {req.os}
                      </span>
                    </div>
                    <span className="text-zinc-400 text-[11px]">ยื่นเมื่อ: {req.createdAt}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-zinc-400 block">ผู้ขอ / รหัส:</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 font-mono">
                        {req.fullName} ({req.studentId})
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">โครงงาน:</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate block">
                        {req.projectTitle}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">สเปกที่ขอ:</span>
                      <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {req.vcpu} vCPU • {req.ram} MB RAM • {req.disk} GB NVMe
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                    <span className="font-semibold block text-zinc-400 mb-0.5">วัตถุประสงค์การใช้งาน:</span>
                    {req.purpose}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRejectRequest(req.id)}
                      className="h-8 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900"
                    >
                      ปฏิเสธคำขอ
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        setIsApprovingId(req.id)
                        try {
                          await onApproveRequest(req)
                        } finally {
                          setIsApprovingId(null)
                          fetchStudents()
                        }
                      }}
                      disabled={isApprovingId !== null}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer disabled:opacity-60"
                    >
                      {isApprovingId === req.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          กำลังสร้าง CT บน Proxmox...
                        </>
                      ) : isApprovingId !== null ? (
                        <span>รอคิวสร้างเครื่อง...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          อนุมัติและสร้าง CT บน Proxmox ทันที
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 3: ACTIVE CT SERVERS ON PROXMOX                              */}
      {/* ==================================================================== */}
      {activeSubTab === 'servers' && (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            เครื่องเซิร์ฟเวอร์ที่ทำงานอยู่บน HP ProLiant DL20 Gen9 ({ctServers.length} เครื่อง)
          </div>

          {ctServers.length === 0 ? (
            <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <Server className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
              <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">ยังไม่มีเครื่องเซิร์ฟเวอร์ที่ถูกจัดสรร</div>
              <p className="text-xs text-zinc-400 mt-1">เมื่ออนุมัติคำขอในคิว เครื่องจะปรากฏในหน้านี้</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ctServers.map((server) => (
                <div
                  key={server.vmid}
                  className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      {renderOSLogo(server.osKey || 'debian-12', 'h-5 w-5')}
                      <div>
                        <span className="font-bold text-zinc-900 dark:text-white font-mono">CT {server.vmid}</span>
                        <span className="ml-1.5 text-zinc-500 font-medium">({server.name})</span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        server.status === 'running'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${server.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                      {server.status === 'running' ? 'Running' : 'Stopped'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-zinc-400 block">IP Address (vmbr1):</span>
                      <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{server.ip}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">ผู้ถือครอง (Student ID):</span>
                      <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{server.studentId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">ทรัพยากร:</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        {server.vcpu} Core • {server.ram} MB • {server.disk} GB
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">Root Password:</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{server.rootPassword || '07072569'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedProcessServer(server)}
                        className="h-7 text-xs border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
                      >
                        <Activity className="h-3 w-3 mr-1 text-emerald-500" />
                        โปรเซส & กราฟสด
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenTerminal(server)}
                        className="h-7 text-xs border-zinc-300 dark:border-zinc-700"
                      >
                        <Terminal className="h-3 w-3 mr-1" />
                        Web Terminal
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTogglePower(server.vmid)}
                        className="h-7 text-xs"
                      >
                        {server.status === 'running' ? (
                          <>
                            <Square className="h-3 w-3 mr-1 text-amber-500" />
                            Stop
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1 text-emerald-500" />
                            Start
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onReboot(server.vmid)}
                        className="h-7 text-xs"
                      >
                        <RotateCw className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDestroyServer(server.vmid)}
                        className="h-7 text-xs bg-red-600/80 hover:bg-red-600 text-white"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 4: SUPPORT TICKETS & STUDENT ASSISTANCE                       */}
      {/* ==================================================================== */}
      {activeSubTab === 'tickets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium">กรองสถานะ:</span>
              {(['all', 'pending', 'in_progress', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTicketFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    ticketFilter === f
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {f === 'all' && `ทั้งหมด (${tickets.length})`}
                  {f === 'pending' && `รอตรวจสอบ (${tickets.filter(t => t.status === 'pending').length})`}
                  {f === 'in_progress' && `กำลังทำ (${tickets.filter(t => t.status === 'in_progress').length})`}
                  {f === 'resolved' && `เสร็จสิ้น (${tickets.filter(t => t.status === 'resolved').length})`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={fetchTickets}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>รีเฟรชคำร้อง</span>
            </button>
          </div>

          {tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              <HelpCircle className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">ไม่มีคำร้องหรือการแจ้งปัญหาในหมวดหมู่นี้</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets
                .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                .map(t => (
                  <div
                    key={t.id}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            t.status === 'pending'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : t.status === 'in_progress'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {t.status === 'pending' ? 'รอตรวจสอบ' : t.status === 'in_progress' ? 'กำลังดำเนินการ' : 'แก้ไขเสร็จสิ้น'}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">{t.id}</span>
                          <span className="text-[11px] text-zinc-400">• {new Date(t.createdAt).toLocaleString('th-TH')}</span>
                        </div>
                        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mt-1">
                          {t.subject}
                        </h4>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          นักศึกษา: <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{t.studentId}</span>
                          {t.studentName && <span className="ml-1.5">({t.studentName})</span>}
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono">{t.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed border border-zinc-100 dark:border-zinc-800">
                      {t.description}
                    </div>

                    {/* Admin Reply & Action */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="พิมพ์ข้อความตอบกลับหรือคำแนะนำให้นักศึกษา..."
                          value={replyDrafts[t.id] !== undefined ? replyDrafts[t.id] : (t.adminReply || '')}
                          onChange={(e) => setReplyDrafts(prev => ({ ...prev, [t.id]: e.target.value }))}
                          className="text-xs h-8"
                        />
                        <Button
                          size="sm"
                          disabled={updatingTicketId === t.id}
                          onClick={() => handleUpdateTicket(t.id, t.status)}
                          className="h-8 text-xs shrink-0 cursor-pointer"
                        >
                          บันทึกคำตอบ
                        </Button>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[11px] text-zinc-400">เปลี่ยนสถานะ:</span>
                        <div className="flex items-center gap-1.5">
                          {t.status !== 'in_progress' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateTicket(t.id, 'in_progress')}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border border-blue-200 dark:border-blue-900 cursor-pointer"
                            >
                              ตั้งเป็นกำลังทำ
                            </button>
                          )}
                          {t.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateTicket(t.id, 'resolved')}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900 cursor-pointer"
                            >
                              เสร็จสิ้น (Resolved)
                            </button>
                          )}
                          {t.status === 'resolved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateTicket(t.id, 'pending')}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 cursor-pointer"
                            >
                              เปิดใหม่ (Reopen)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SINGLE CONTAINER PROCESS & RESOURCE INSPECTOR MODAL                  */}
      {/* ==================================================================== */}
      {selectedProcessServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-emerald-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm sm:text-base">
                      มอนิเตอร์โปรเซส: CT {selectedProcessServer.vmid} ({selectedProcessServer.serverName || selectedProcessServer.name})
                    </h3>
                    {isProcessStreamConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE (2s)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-950/80 border border-amber-800 text-amber-400">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        เชื่อมต่อสตรีม...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    นักศึกษา: {selectedProcessServer.studentId} • IP: {selectedProcessServer.ip}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenTerminal(selectedProcessServer)}
                  className="h-8 text-xs border-zinc-700 bg-zinc-800 text-zinc-200"
                >
                  <Terminal className="h-3.5 w-3.5 mr-1" />
                  Terminal
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedProcessServer(null)}
                  className="h-8 w-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Live Metrics Row */}
            {serverProcessStreamData?.stats && (
              <div className="grid grid-cols-4 gap-2.5 p-4 border-b border-zinc-800 bg-zinc-950/40 text-xs">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">CPU การใช้งาน</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {serverProcessStreamData.stats.cpuPercent}%
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">RAM การใช้งาน</span>
                  <span className="text-lg font-bold font-mono text-sky-400">
                    {serverProcessStreamData.stats.memUsageMB} MB
                    <span className="text-xs text-zinc-500 font-normal ml-1">
                      ({serverProcessStreamData.stats.memPercent}%)
                    </span>
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">พื้นที่ Workspace</span>
                  <span className="text-lg font-bold font-mono text-amber-400">
                    {serverProcessStreamData.stats.diskUsageMB} MB
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="text-zinc-400 text-[10px] block">จำนวน PIDs</span>
                  <span className="text-lg font-bold font-mono text-purple-400">
                    {serverProcessStreamData.stats.pids || 0}
                  </span>
                </div>
              </div>
            )}

            {/* Search Filter & Table Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-900">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="กรองโปรเซสตาม PID หรือชื่อคำสั่ง..."
                  value={processSearchQuery}
                  onChange={(e) => setProcessSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-zinc-200"
                />
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                {serverProcessStreamData?.processes?.length || 0} โปรเซส
              </span>
            </div>

            {/* Process Table Body */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                    <th className="py-2 px-2.5">PID</th>
                    <th className="py-2 px-2.5">USER</th>
                    <th className="py-2 px-2.5">%CPU</th>
                    <th className="py-2 px-2.5">%MEM</th>
                    <th className="py-2 px-2.5">STAT</th>
                    <th className="py-2 px-2.5">TIME</th>
                    <th className="py-2 px-2.5">COMMAND</th>
                    <th className="py-2 px-2.5 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                  {!serverProcessStreamData?.processes || serverProcessStreamData.processes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-500 font-sans">
                        {isProcessStreamConnected ? 'ไม่พบโปรเซสที่กำลังทำงาน' : 'กำลังดึงรายการโปรเซสจากคอนเทนเนอร์...'}
                      </td>
                    </tr>
                  ) : (
                    serverProcessStreamData.processes
                      .filter((p) => {
                        const q = processSearchQuery.toLowerCase().trim()
                        if (!q) return true
                        return (
                          String(p.pid).includes(q) ||
                          p.command.toLowerCase().includes(q) ||
                          p.user.toLowerCase().includes(q)
                        )
                      })
                      .map((p) => (
                        <tr key={p.pid} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2.5 px-2.5 font-bold text-white">{p.pid}</td>
                          <td className="py-2.5 px-2.5 text-zinc-400">{p.user}</td>
                          <td className="py-2.5 px-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                p.cpu > 50
                                  ? 'bg-red-950/80 text-red-400 border border-red-800'
                                  : p.cpu > 20
                                  ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                                  : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                              }`}
                            >
                              {p.cpu}%
                            </span>
                          </td>
                          <td className="py-2.5 px-2.5 text-sky-400">{p.mem}%</td>
                          <td className="py-2.5 px-2.5 text-zinc-500 text-[10px]">{p.stat}</td>
                          <td className="py-2.5 px-2.5 text-zinc-400 text-[10px]">{p.time}</td>
                          <td className="py-2.5 px-2.5 text-zinc-200 max-w-md truncate" title={p.command}>
                            {p.command}
                          </td>
                          <td className="py-2.5 px-2.5 text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleKillProcess(selectedProcessServer.vmid, p.pid, p.command)}
                              disabled={isKillingPid === p.pid}
                              className="h-6 text-[10px] px-2 bg-red-600/80 hover:bg-red-600 text-white cursor-pointer"
                            >
                              {isKillingPid === p.pid ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                'ยุติ (Kill)'
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs text-zinc-400">
              <span className="text-[11px]">
                คำสั่ง `kill -9` จะส่งสัญญาณ SIGKILL บังคับปิดโปรเซสทันทีเพื่อคืนทรัพยากร
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedProcessServer(null)}
                className="h-7 text-xs border-zinc-700 bg-zinc-900 text-zinc-200"
              >
                ปิดหน้าต่าง
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
