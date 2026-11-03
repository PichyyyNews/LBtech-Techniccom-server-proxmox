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
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { renderOSLogo } from '@/components/OSLogos'

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
  const [activeSubTab, setActiveSubTab] = useState<'passwords' | 'queue' | 'servers'>('passwords')
  const [students, setStudents] = useState<EnrichedStudent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [revealedPasswords, setRevealedPasswords] = useState<{ [id: string]: boolean }>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null)

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

  useEffect(() => {
    fetchStudents()
  }, [adminPin])

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
      {/* HEADER BANNER */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  แผงควบคุมอาจารย์และผู้ดูแลระบบ
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
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
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('passwords')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
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
      </div>

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
                      <span className="font-bold text-zinc-900 dark:text-white text-sm">{req.serverName}</span>
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
                        await onApproveRequest(req)
                        setIsApprovingId(null)
                        fetchStudents()
                      }}
                      disabled={isApprovingId === req.id}
                      className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isApprovingId === req.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          กำลังสร้าง CT บน Proxmox...
                        </>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenTerminal(server)}
                      className="h-7 text-xs border-zinc-300 dark:border-zinc-700"
                    >
                      <Terminal className="h-3 w-3 mr-1" />
                      Web Terminal
                    </Button>

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
    </div>
  )
}
