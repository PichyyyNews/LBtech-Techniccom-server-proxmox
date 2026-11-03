import React, { useState, useEffect, useRef } from 'react'
import {
  Wifi,
  Radio,
  Database,
  Globe,
  Code2,
  Layers,
  LogOut,
  Sliders,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Eye,
  EyeOff,
  Activity,
  Terminal,
  Send,
  Search,
  Settings,
  Bookmark,
  FileCode,
  FolderGit2,
  CheckCircle2,
  Sun,
  Moon,
  Monitor,
  Server,
  Cpu,
  HardDrive,
  Play,
  Square,
  RotateCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  Key,
  Plus,
  Minus,
  ArrowLeft,
  ChevronUp,
  BookOpen,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { DebianLogo, UbuntuLogo, AlpineLogo, InfluxDBLogo, EMQXLogo, renderOSLogo } from '@/components/OSLogos'
import { AdminPanel } from '@/components/AdminPanel'
import { EmbeddedTerminal } from '@/components/EmbeddedTerminal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CodeViewer } from '@/components/CodeViewer'
import mqtt from 'mqtt'

interface StudentSession {
  studentId: string
  fullName: string
  projectTitle: string
  department: string
  token: string
  influxBucket?: string
  influxToken?: string
  influxOrg?: string
  mqttUsername?: string
  mqttTopicPrefix?: string
}

type TabType = 'overview' | 'mqtt' | 'database' | 'rest-api' | 'ct-servers' | 'esp32' | 'esp8266' | 'web-js' | 'python' | 'admin'
type ThemeMode = 'light' | 'dark' | 'system'

// CT Request Data Model
interface CTRequest {
  id: string
  studentId: string
  fullName: string
  projectTitle: string
  serverName: string
  os: 'debian-12' | 'ubuntu-24' | 'alpine-3'
  vcpu: number
  ram: number
  disk: number
  purpose: string
  status: 'pending' | 'approved' | 'rejected'
  vmid?: number
  ip?: string
  createdAt: string
  rejectionReason?: string
}

// Provisioned Container Data Model
interface CTServer {
  vmid: number
  name: string
  studentId: string
  os: string
  osKey: 'debian-12' | 'ubuntu-24' | 'alpine-3'
  vcpu: number
  ram: number
  disk: number
  ip: string
  status: 'running' | 'stopped'
  uptime: string
  sshPort: number
  rootPassword?: string
  cpuUsage: number
  ramUsage: number
}

export default function App() {
  // Theme State: 'light' | 'dark' | 'system'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('lbtech_theme') as ThemeMode
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })

  // Resolved Theme: 'light' | 'dark'
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // Theme Sync Effect
  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        themeMode === 'dark' ||
        (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

      const active = isDark ? 'dark' : 'light'
      setResolvedTheme(active)

      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    applyTheme()
    localStorage.setItem('lbtech_theme', themeMode)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      if (themeMode === 'system') {
        applyTheme()
      }
    }

    mediaQuery.addEventListener('change', handleSystemChange)
    return () => mediaQuery.removeEventListener('change', handleSystemChange)
  }, [themeMode])

  // Session State
  const [session, setSession] = useState<StudentSession | null>(() => {
    const saved = localStorage.getItem('lbtech_iot_session')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return null
      }
    }
    return null
  })

  // Active Menu Tab
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Auth Mode: 'register' | 'login'
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register')

  // Form State
  const [studentId, setStudentId] = useState('')
  const [fullName, setFullName] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')

  // Live Test Console State
  const [mqttStatus, setMqttStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [messages, setMessages] = useState<Array<{ topic: string; payload: string; time: string }>>([])
  const [testPayload, setTestPayload] = useState('{"temperature": 28.4, "humidity": 65, "status": "ON"}')
  const [testTopicSuffix, setTestTopicSuffix] = useState('sensor')
  const clientRef = useRef<mqtt.MqttClient | null>(null)

  // Mobile Navigation & Search State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [editFullName, setEditFullName] = useState('')
  const [editProjectTitle, setEditProjectTitle] = useState('')
  const [editDepartment, setEditDepartment] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [settingsError, setSettingsError] = useState('')

  // =========================================================================
  // CT SERVER PROVISIONING STATE
  // =========================================================================
  const [ctRequests, setCtRequests] = useState<CTRequest[]>(() => {
    try {
      const saved = localStorage.getItem('lbtech_ct_requests')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [ctServers, setCtServers] = useState<CTServer[]>(() => {
    try {
      const saved = localStorage.getItem('lbtech_ct_servers')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('lbtech_ct_requests', JSON.stringify(ctRequests))
  }, [ctRequests])

  useEffect(() => {
    localStorage.setItem('lbtech_ct_servers', JSON.stringify(ctServers))
  }, [ctServers])

  // Initial Sync from Centralized Backend
  useEffect(() => {
    const syncBackend = async () => {
      try {
        const [reqRes, srvRes] = await Promise.all([
          fetch('/api/ct/requests'),
          fetch('/api/ct/servers')
        ])
        if (reqRes.ok) {
          const reqData = await reqRes.json()
          if (reqData.requests && reqData.requests.length > 0) {
            setCtRequests(reqData.requests)
          }
        }
        if (srvRes.ok) {
          const srvData = await srvRes.json()
          if (srvData.servers && srvData.servers.length > 0) {
            setCtServers(srvData.servers)
          }
        }
      } catch {
        // Fallback to local storage if backend offline
      }
    }
    syncBackend()
  }, [])

  // CT Request Form Fields
  const [reqServerName, setReqServerName] = useState('')
  const [reqOs, setReqOs] = useState<'debian-12' | 'ubuntu-24' | 'alpine-3'>('debian-12')
  const [reqVcpu, setReqVcpu] = useState(1)
  const [reqRam, setReqRam] = useState(1024)
  const [reqDisk, setReqDisk] = useState(10)
  const [reqPurpose, setReqPurpose] = useState('')
  const [reqAgreedTerms, setReqAgreedTerms] = useState(false)
  const [reqError, setReqError] = useState('')
  const [reqSuccess, setReqSuccess] = useState('')
  const [copiedSshCmd, setCopiedSshCmd] = useState<number | null>(null)
  const [isCreatingServer, setIsCreatingServer] = useState(false)

  // Server Credentials reveal & copy states
  const [showServerPasswords, setShowServerPasswords] = useState<Record<number, boolean>>({})
  const [copiedServerKey, setCopiedServerKey] = useState<string | null>(null)
  const copyServerText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedServerKey(key)
    setTimeout(() => setCopiedServerKey(null), 2000)
  }

  // InfluxDB UI Credentials reveal state
  const [showDbPassword, setShowDbPassword] = useState(false)
  const [copiedDbKey, setCopiedDbKey] = useState<string | null>(null)
  const copyDbText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedDbKey(key)
    setTimeout(() => setCopiedDbKey(null), 2000)
  }

  // MQTT UI Credentials reveal state
  const [showMqttPassword, setShowMqttPassword] = useState(false)
  const [copiedMqttKey, setCopiedMqttKey] = useState<string | null>(null)
  const copyMqttText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedMqttKey(key)
    setTimeout(() => setCopiedMqttKey(null), 2000)
  }

  // Modals for CT System
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false)
  const [terminalServer, setTerminalServer] = useState<CTServer | null>(null)
  const [terminalMode, setTerminalMode] = useState<'embedded' | 'minimized' | 'fullscreen'>('embedded')

  // Server Hub & Dedicated Workspace State
  const [selectedServerVmid, setSelectedServerVmid] = useState<number | null>(null)
  const [serverWorkspaceTab, setServerWorkspaceTab] = useState<'console' | 'status' | 'config'>('console')
  const [showAccessGuide, setShowAccessGuide] = useState(true)
  const [showMqttGuide, setShowMqttGuide] = useState(false)
  const [showDbGuide, setShowDbGuide] = useState(false)
  const [showApiGuide, setShowApiGuide] = useState(false)

  // Admin PIN Protection & Mode
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false)
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false)
  const [adminPinInput, setAdminPinInput] = useState('')
  const [adminPinError, setAdminPinError] = useState('')

  // Sync session to localStorage
  useEffect(() => {
    if (session) {
      localStorage.setItem('lbtech_iot_session', JSON.stringify(session))
    } else {
      localStorage.removeItem('lbtech_iot_session')
      if (clientRef.current) {
        clientRef.current.end()
        clientRef.current = null
      }
    }
  }, [session])

  // Helper for localStorage account persistence
  const saveAccountToStore = (acc: StudentSession) => {
    try {
      const raw = localStorage.getItem('lbtech_iot_accounts')
      const accounts = raw ? JSON.parse(raw) : {}
      accounts[acc.studentId] = acc
      localStorage.setItem('lbtech_iot_accounts', JSON.stringify(accounts))
    } catch (e) {
      console.error(e)
    }
  }

  // Check for hidden /admin route on load and browser navigation
  useEffect(() => {
    const checkAdminPath = () => {
      const path = window.location.pathname.toLowerCase()
      if (path === '/admin' || path === '/admin/' || window.location.hash === '#admin') {
        if (!isAdminUnlocked) {
          setIsAdminPinModalOpen(true)
        } else {
          setActiveTab('admin')
        }
      }
    }
    checkAdminPath()
    window.addEventListener('popstate', checkAdminPath)
    return () => window.removeEventListener('popstate', checkAdminPath)
  }, [isAdminUnlocked])

  const handleCloseAdminPinModal = () => {
    setIsAdminPinModalOpen(false)
    setAdminPinInput('')
    setAdminPinError('')
    if (window.location.pathname.toLowerCase().startsWith('/admin') || window.location.hash === '#admin') {
      window.history.pushState(null, '', '/')
    }
  }

  // Keyboard shortcut listener for Ctrl+K and ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false)
        setIsSettingsOpen(false)
        setIsMobileMenuOpen(false)
        setIsMobileTocOpen(false)
        setIsTermsModalOpen(false)
        if (terminalMode === 'fullscreen') setTerminalMode('embedded')
        handleCloseAdminPinModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')

    const cleanId = studentId.trim()
    if (!cleanId || cleanId.length < 5) {
      setAuthError('รหัสนักศึกษาต้องมีอย่างน้อย 5 ตัวอักษร')
      return
    }
    if (!password || password.length < 6) {
      setAuthError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    const payload = {
      studentId: cleanId,
      fullName: fullName.trim() || 'นักศึกษาโครงงาน',
      projectTitle: projectTitle.trim() || 'โปรเจกต์ IoT ประจำกลุ่ม',
      department: department.trim() || 'เทคโนโลยีคอมพิวเตอร์',
      password: password,
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        if (data.session) {
          saveAccountToStore(data.session)
          setSession(data.session)
          return
        }
      } else {
        const errData = await res.json()
        if (errData.error) {
          setAuthError(errData.error)
          return
        }
      }
    } catch {
      // Offline fallback
    }

    const newSession: StudentSession = {
      studentId: cleanId,
      fullName: payload.fullName,
      projectTitle: payload.projectTitle,
      department: payload.department,
      token: password,
    }

    saveAccountToStore(newSession)
    setSession(newSession)
  }

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')

    const cleanId = studentId.trim()
    if (!cleanId) {
      setAuthError('กรุณากรอกรหัสนักศึกษา')
      return
    }
    if (!password) {
      setAuthError('กรุณากรอกรหัสผ่าน')
      return
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: cleanId, password })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.session) {
          saveAccountToStore(data.session)
          setSession(data.session)
          return
        }
      } else {
        const errData = await res.json()
        if (errData.error) {
          setAuthError(errData.error)
          return
        }
      }
    } catch {
      // Offline fallback
    }

    let storedAcc: StudentSession | null = null
    try {
      const raw = localStorage.getItem('lbtech_iot_accounts')
      if (raw) {
        const accounts = JSON.parse(raw)
        storedAcc = accounts[cleanId] || null
      }
    } catch {
      // ignore
    }

    const newSession: StudentSession = {
      studentId: cleanId,
      fullName: storedAcc?.fullName || 'นักศึกษาโครงงาน',
      projectTitle: storedAcc?.projectTitle || 'โปรเจกต์ IoT ประจำกลุ่ม',
      department: storedAcc?.department || 'เทคโนโลยีคอมพิวเตอร์',
      token: password,
    }

    setSession(newSession)
  }

  // Open Settings Modal
  const openSettings = () => {
    if (!session) return
    setEditFullName(session.fullName)
    setEditProjectTitle(session.projectTitle)
    setEditDepartment(session.department)
    setEditPassword(session.token)
    setShowEditPassword(false)
    setSettingsError('')
    setSettingsSaved(false)
    setIsSettingsOpen(true)
    setIsMobileMenuOpen(false)
  }

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return
    setSettingsError('')

    if (!editPassword || editPassword.length < 6) {
      setSettingsError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    const updated: StudentSession = {
      ...session,
      fullName: editFullName.trim() || session.fullName,
      projectTitle: editProjectTitle.trim() || session.projectTitle,
      department: editDepartment.trim() || session.department,
      token: editPassword,
    }

    saveAccountToStore(updated)
    setSession(updated)
    setSettingsSaved(true)
    setTimeout(() => {
      setIsSettingsOpen(false)
      setSettingsSaved(false)
    }, 1000)
  }

  // Switch Tab helper
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setIsMobileMenuOpen(false)
    setIsMobileTocOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // =========================================================================
  // CT ACTIONS (STUDENT & ADMIN)
  // =========================================================================
  const studentActiveServers = session
    ? ctServers.filter((s) => s.studentId === session.studentId)
    : []

  const studentRequests = session
    ? ctRequests.filter((r) => r.studentId === session.studentId)
    : []

  const studentPendingRequest = studentRequests.find((r) => r.status === 'pending')

  // Handle CT Submission
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqError('')
    setReqSuccess('')

    if (!session) return

    if (studentActiveServers.length >= 2) {
      setReqError('กลุ่มของคุณมีเครื่องเซิร์ฟเวอร์ครบโควตาสูงสุด 2 เครื่องแล้ว')
      return
    }

    if (studentPendingRequest) {
      setReqError('กลุ่มของคุณมีคำขอเครื่องที่อยู่ระหว่างรอการอนุมัติแล้ว 1 รายการ')
      return
    }

    const cleanName = reqServerName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!cleanName || cleanName.length < 3) {
      setReqError('กรุณาระบุชื่อเครื่องเซิร์ฟเวอร์อย่างน้อย 3 ตัวอักษร (ภาษาอังกฤษและตัวเลข)')
      return
    }

    if (!reqPurpose.trim() || reqPurpose.trim().length < 10) {
      setReqError('กรุณากรอกวัตถุประสงค์ในการขอเครื่องโดยละเอียด (อย่างน้อย 10 ตัวอักษร)')
      return
    }

    if (!reqAgreedTerms) {
      setReqError('กรุณาคลิกยอมรับข้อกำหนดและเงื่อนไขการใช้งานก่อนส่งคำขอ')
      return
    }

    const payload = {
      studentId: session.studentId,
      fullName: session.fullName,
      projectTitle: session.projectTitle,
      serverName: cleanName,
      os: reqOs,
      vcpu: reqVcpu,
      ram: reqRam,
      disk: reqDisk,
      purpose: reqPurpose.trim(),
    }

    try {
      const res = await fetch('/api/ct/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        if (data.request) {
          setCtRequests((prev) => [data.request, ...prev])
          setReqSuccess('ส่งคำขอเรียบร้อยแล้ว! บันทึกข้อมูลเข้าเซิร์ฟเวอร์ส่วนกลาง รออาจารย์อนุมัติ')
          setReqServerName('')
          setReqPurpose('')
          setReqAgreedTerms(false)
          setIsCreatingServer(false)
          return
        }
      }
    } catch {
      // offline fallback
    }

    const newReq: CTRequest = {
      id: `req_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`,
      ...payload,
      status: 'pending',
      createdAt: new Date().toLocaleString('th-TH'),
    }

    setCtRequests((prev) => [newReq, ...prev])
    setReqSuccess('ส่งคำขอเรียบร้อยแล้ว! อาจารย์ผู้ดูแลระบบจะตรวจสอบและกดอนุมัติเครื่องให้')
    setReqServerName('')
    setReqPurpose('')
    setReqAgreedTerms(false)
    setIsCreatingServer(false)
  }

  // Admin Approves Request (Teacher Only)
  const handleApproveRequest = async (req: CTRequest) => {
    if (!isAdminUnlocked && !adminPinInput) {
      alert('เฉพาะอาจารย์ผู้ดูแลระบบเท่านั้นที่มีสิทธิ์อนุมัติคำขอ')
      return
    }

    try {
      const res = await fetch(`/api/ct/approve/${req.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPinInput || ''
        }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.server) {
          setCtServers((prev) => [data.server, ...prev.filter(s => s.vmid !== data.server.vmid)])
          setCtRequests((prev) =>
            prev.map((r) =>
              r.id === req.id ? { ...r, status: 'approved', vmid: data.server.vmid, ip: data.server.ip } : r
            )
          )
          return
        }
      } else {
        const errData = await res.json()
        alert(errData.error || 'ไม่สามารถอนุมัติได้ ต้องใช้สิทธิ์อาจารย์')
        return
      }
    } catch (err) {
      console.warn('[Approve] API error:', err)
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
      return
    }
  }

  // Admin Rejects Request
  const handleRejectRequest = async (reqId: string, reason?: string) => {
    try {
      await fetch(`/api/ct/reject/${reqId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPinInput || '2569'
        },
        body: JSON.stringify({ reason })
      })
    } catch {
      // ignore
    }
    setCtRequests((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status: 'rejected' } : r))
    )
  }

  // Toggle Container Power
  const handleTogglePower = async (vmid: number) => {
    try {
      const res = await fetch(`/api/ct/servers/${vmid}/power`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.server) {
          setCtServers((prev) => prev.map((s) => (s.vmid === vmid ? data.server : s)))
          return
        }
      }
    } catch {
      // ignore
    }

    setCtServers((prev) =>
      prev.map((s) => {
        if (s.vmid === vmid) {
          const next = s.status === 'running' ? 'stopped' : 'running'
          return {
            ...s,
            status: next,
            uptime: next === 'running' ? 'เพิ่งเริ่มทำงาน' : 'ปิดระบบแล้ว',
            cpuUsage: next === 'running' ? 5 : 0,
            ramUsage: next === 'running' ? Math.floor(s.ram * 0.15) : 0,
          }
        }
        return s
      })
    )
  }

  // Reboot Container
  const handleReboot = async (vmid: number) => {
    try {
      fetch(`/api/ct/servers/${vmid}/reboot`, { method: 'POST' })
    } catch {
      // ignore
    }

    setCtServers((prev) =>
      prev.map((s) => (s.vmid === vmid ? { ...s, uptime: 'กำลังรีสตาร์ต...' } : s))
    )
    setTimeout(() => {
      setCtServers((prev) =>
        prev.map((s) => (s.vmid === vmid ? { ...s, uptime: '1 นาที' } : s))
      )
    }, 1500)
  }

  // Destroy Container
  const handleDestroyServer = async (vmid: number) => {
    if (confirm(`ยืนยันการลบเครื่องเซิร์ฟเวอร์ CT ${vmid}? ข้อมูลภายในเครื่องจะถูกลบถาวร`)) {
      try {
        await fetch(`/api/ct/servers/${vmid}`, { method: 'DELETE' })
      } catch {
        // ignore
      }
      setCtServers((prev) => prev.filter((s) => s.vmid !== vmid))
    }
  }

  // Unlock Admin Mode with PIN
  const handleVerifyAdminPin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminPinError('')
    const pin = adminPinInput.trim()

    const activateAdmin = () => {
      setIsAdminUnlocked(true)
      setIsAdminPinModalOpen(false)
      setActiveTab('admin')
      window.history.pushState(null, '', '/admin')
      if (!session) {
        setSession({
          studentId: 'ADMIN',
          fullName: 'ผู้ดูแลระบบ (Admin Master)',
          projectTitle: 'ศูนย์ควบคุม LBTech IoT & Cloud',
          department: 'แผนกวิชาเทคโนโลยีคอมพิวเตอร์',
          token: pin
        })
      }
    }

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })
      if (res.ok) {
        activateAdmin()
        return
      }
    } catch {
      // offline fallback
    }

    if (pin === '2569' || pin === '07072569') {
      activateAdmin()
    } else {
      setAdminPinError('รหัสผ่าน PIN ไม่ถูกต้อง')
    }
  }

  // Live MQTT In-Browser Connection Test
  const toggleMqttTest = () => {
    if (mqttStatus === 'connected' || mqttStatus === 'connecting') {
      if (clientRef.current) {
        clientRef.current.end()
        clientRef.current = null
      }
      setMqttStatus('disconnected')
      return
    }

    if (!session) return

    setMqttStatus('connecting')
    const subTopics = [
      `lbtech/${session.studentId}/#`,
      `project/${session.studentId}/#`
    ]

    try {
      const client = mqtt.connect('wss://mqtt.pichyy.qzz.io/mqtt', {
        username: session.studentId,
        password: session.token,
        clientId: `web_test_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 7000,
      })

      client.on('connect', () => {
        setMqttStatus('connected')
        client.subscribe(subTopics, (err) => {
          if (!err) {
            setMessages((prev) => [
              {
                topic: subTopics[0],
                payload: `🟢 เชื่อมต่อสำเร็จ (WSS:443) -> ติดตามข้อมูล (Subscribed): ${subTopics.join(', ')}`,
                time: new Date().toLocaleTimeString(),
              },
              ...prev.slice(0, 30),
            ])
          }
        })
      })

      client.on('message', (topic, payload) => {
        setMessages((prev) => [
          {
            topic,
            payload: payload.toString(),
            time: new Date().toLocaleTimeString(),
          },
          ...prev.slice(0, 30),
        ])
      })

      client.on('error', (err) => {
        console.error('MQTT error:', err)
        setMqttStatus('error')
      })

      client.on('close', () => {
        setMqttStatus('disconnected')
      })

      clientRef.current = client
    } catch (err) {
      console.error(err)
      setMqttStatus('error')
    }
  }

  const handlePublishTest = () => {
    if (!session || !clientRef.current || mqttStatus !== 'connected') return
    const suffix = testTopicSuffix.trim()
    const topic = suffix.startsWith('lbtech/') || suffix.startsWith('project/')
      ? suffix
      : suffix
      ? `lbtech/${session.studentId}/${suffix}`
      : `lbtech/${session.studentId}/telemetry`
    clientRef.current.publish(topic, testPayload)
  }

  const sId = session ? session.studentId : '69319090021'
  const sPass = session ? session.token : 'your_password'

  // Code Snippets
  const esp32Code = `// ========================================================
// LBtech IoT Template: ESP32 MQTT over WebSocket (WSS:443)
// วิ่งผ่าน Cloudflare Tunnel พอร์ต 443 ปลอดภัย 100%
// ========================================================
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const char* ws_host = "mqtt.pichyy.qzz.io";
const int   ws_port = 443;
const char* ws_path = "/mqtt";

const char* mqtt_user = "${sId}";
const char* mqtt_pass = "${sPass}";

const char* topic_sensor  = "project/${sId}/sensor";
const char* topic_control = "project/${sId}/control";

WebSocketsClient webSocket;
unsigned long lastSend = 0;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WSS] หลุดการเชื่อมต่อ!");
      break;
    case WStype_CONNECTED:
      Serial.println("[WSS] เชื่อมต่อ Cloudflare Tunnel สำเร็จ (Port 443)!");
      break;
    case WStype_TEXT:
      Serial.printf("[WSS] ได้รับข้อมูล: %s\\n", payload);
      break;
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi เชื่อมต่อแล้ว!");

  webSocket.beginSSL(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  if (millis() - lastSend > 5000) {
    lastSend = millis();
    String payload = "{\\"temperature\\": 28.5, \\"humidity\\": 60, \\"device\\": \\"esp32\\"}";
    webSocket.sendTXT(payload);
    Serial.println("ส่งข้อมูล: " + payload);
  }
}`

  const esp8266Code = `// ========================================================
// LBtech IoT Template: ESP8266 (NodeMCU / D1 Mini)
// ปรับแต่ง Memory และ WebSocket WSS พอร์ต 443
// ========================================================
#include <ESP8266WiFi.h>
#include <WebSocketsClient.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const char* ws_host = "mqtt.pichyy.qzz.io";
const int   ws_port = 443;
const char* ws_path = "/mqtt";

const char* mqtt_user = "${sId}";
const char* mqtt_pass = "${sPass}";

WebSocketsClient webSocket;
unsigned long lastSend = 0;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("[WSS] เชื่อมต่อสำเร็จ!");
  } else if (type == WStype_TEXT) {
    Serial.printf("[WSS] รับคำสั่ง: %s\\n", payload);
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi เชื่อมต่อแล้ว");

  webSocket.beginSSL(ws_host, ws_port, ws_path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  if (millis() - lastSend > 5000) {
    lastSend = millis();
    String msg = "{\\"status\\":\\"active\\",\\"device\\":\\"esp8266\\"}";
    webSocket.sendTXT(msg);
  }
}`

  const webJsCode = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IoT Dashboard - ${sId}</title>
  <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #fafafa; color: #09090b; margin: 0; }
    .card { background: white; border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; margin-bottom: 16px; max-width: 600px; }
    .btn { background: #18181b; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-off { background: #f4f4f5; color: #18181b; }
    .badge { padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; background: #f4f4f5; }
    .badge-ok { background: #dcfce7; color: #166534; }
  </style>
</head>
<body>
  <h2>แดชบอร์ดควบคุม IoT (Web Frontend)</h2>
  <p>รหัสนักศึกษา: <strong>${sId}</strong> | สถานะ: <span id="status" class="badge">กำลังเชื่อมต่อ...</span></p>

  <div class="card">
    <h3>ข้อมูลจากเซนเซอร์ Real-time</h3>
    <pre id="sensor-output" style="white-space: pre-wrap; word-break: break-all;">รอรับข้อมูลจากบอร์ด...</pre>
  </div>

  <div class="card">
    <h3>สั่งงานอุปกรณ์ (Actuator Control)</h3>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn" onclick="sendCmd('ON')">เปิดสวิตช์ (ON)</button>
      <button class="btn btn-off" onclick="sendCmd('OFF')">ปิดสวิตช์ (OFF)</button>
    </div>
  </div>

  <script>
    const client = mqtt.connect('wss://mqtt.pichyy.qzz.io/mqtt', {
      username: '${sId}',
      password: '${sPass}',
      clientId: 'web_' + Math.random().toString(16).substring(2, 8)
    });

    const subTopic = 'project/${sId}/#';
    const pubTopic = 'project/${sId}/control';

    client.on('connect', () => {
      const el = document.getElementById('status');
      el.innerText = '🟢 เชื่อมต่อ WSS สำเร็จ';
      el.className = 'badge badge-ok';
      client.subscribe(subTopic);
    });

    client.on('message', (topic, payload) => {
      document.getElementById('sensor-output').innerText = 
        '[' + new Date().toLocaleTimeString() + '] ' + topic + ' -> ' + payload.toString();
    });

    function sendCmd(val) {
      client.publish(pubTopic, val);
      console.log('Publish:', pubTopic, val);
    }
  </script>
</body>
</html>`

  const pythonCode = `# ========================================================
# LBtech IoT Template: Python / Raspberry Pi / PC
# ติดตั้งไลบรารี: pip install paho-mqtt
# ========================================================
import time
import json
import paho.mqtt.client as mqtt

broker_host = "mqtt.pichyy.qzz.io"
broker_port = 443
username    = "${sId}"
password    = "${sPass}"

topic_pub = "project/${sId}/sensor"
topic_sub = "project/${sId}/control"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("🟢 เชื่อมต่อ MQTT ผ่าน WebSocket สำเร็จ!")
        client.subscribe(topic_sub)
    else:
        print(f"❌ เชื่อมต่อล้มเหลว รหัส: {rc}")

def on_message(client, userdata, msg):
    print(f"📩 ได้รับคำสั่ง [{msg.topic}]: {msg.payload.decode()}")

client = mqtt.Client(transport="websockets")
client.username_pw_set(username, password)
client.tls_set()
client.ws_set_options(path="/mqtt")

client.on_connect = on_connect
client.on_message = on_message

print("กำลังเชื่อมต่อเซิร์ฟเวอร์...")
client.connect(broker_host, broker_port, 60)
client.loop_start()

try:
    while True:
        telemetry = {"device": "rpi4", "temp": 28.5, "status": "active"}
        client.publish(topic_pub, json.dumps(telemetry))
        print("📤 ส่งข้อมูลสำเร็จ:", telemetry)
        time.sleep(5)
except KeyboardInterrupt:
    client.loop_stop()
    client.disconnect()`

  const influxLineProtocolCode = `# ตัวอย่างการส่งข้อมูลเซนเซอร์เข้า InfluxDB v2 โดยตรงผ่าน REST API / Line Protocol
# Endpoint: https://influx.pichyy.qzz.io/api/v2/write?org=lbtech&bucket=iot-telemetry&precision=s

curl -i -XPOST "https://influx.pichyy.qzz.io/api/v2/write?org=lbtech&bucket=iot-telemetry&precision=s" \\
  --header "Authorization: Token client-telemetry-token" \\
  --data-raw "sensor_data,student_id=${sId},device=esp32 temperature=28.7,humidity=62.0"`

  const restApiCode = `# REST API Telemetry Endpoint (HTTP POST)
# สำหรับไมโครคอนโทรลเลอร์ที่ต้องการยิง HTTP POST แทนการต่อค้าง MQTT

POST https://iot.pichyy.qzz.io/api/v1/telemetry
Content-Type: application/json
X-Student-ID: ${sId}
X-Project-Token: ${sPass}

Payload:
{
  "sensor": "DHT22",
  "temperature": 27.9,
  "humidity": 64.5,
  "timestamp": 1730628000
}`

  // Search Index Data
  const searchIndex = [
    {
      title: 'ข้อมูลภาพรวม (Connection Parameters)',
      tab: 'overview' as TabType,
      id: 'sec-overview-params',
      desc: 'MQTT Host, WSS Port 443, Username, Password, Topic',
    },
    {
      title: 'ขอเครื่องเซิร์ฟเวอร์ (Cloud CT Provisioning)',
      tab: 'ct-servers' as TabType,
      id: 'sec-ct-servers',
      desc: 'ยื่นคำขอเครื่อง LXC Container (Debian, Ubuntu, Alpine) พร้อม Web Terminal',
    },
    {
      title: 'นโยบายสิทธิ์ความปลอดภัย (Topic ACL)',
      tab: 'overview' as TabType,
      id: 'sec-overview-acl',
      desc: 'การแยกสิทธิ์ระหว่างกลุ่ม project/<student_id>/#',
    },
    {
      title: 'MQTT Broker (EMQX v5)',
      tab: 'mqtt' as TabType,
      id: 'sec-mqtt-specs',
      desc: 'สเปกการเชื่อมต่อ Broker ผ่าน WSS Cloudflare Tunnel',
    },
    {
      title: 'เครื่องมือทดสอบส่ง-รับค่าสด (Live Console)',
      tab: 'mqtt' as TabType,
      id: 'sec-mqtt-console',
      desc: 'ทดสอบส่ง JSON payload และดูข้อความเข้า Real-time',
    },
    {
      title: 'Database Server (InfluxDB v2)',
      tab: 'database' as TabType,
      id: 'sec-db-specs',
      desc: 'ฐานข้อมูล Time-Series สำหรับเก็บค่าเซนเซอร์ย้อนหลัง',
    },
    {
      title: 'คำสั่งเขียนข้อมูล InfluxDB Line Protocol (cURL)',
      tab: 'database' as TabType,
      id: 'sec-db-curl',
      desc: 'ตัวอย่าง cURL ส่ง telemetry เข้า InfluxDB v2',
    },
    {
      title: 'REST API Telemetry (HTTP POST)',
      tab: 'rest-api' as TabType,
      id: 'sec-api-specs',
      desc: 'HTTP POST Endpoint สำหรับอุปกรณ์ที่ไม่ต่อค้าง MQTT',
    },
    {
      title: 'โค้ดตัวอย่าง: ESP32 (Arduino IDE)',
      tab: 'esp32' as TabType,
      id: 'sec-esp32-code',
      desc: 'C++ โค้ด WebSocket WSS พอร์ต 443 สำหรับ ESP32',
    },
    {
      title: 'โค้ดตัวอย่าง: ESP8266 (NodeMCU)',
      tab: 'esp8266' as TabType,
      id: 'sec-esp8266-code',
      desc: 'C++ โค้ด WebSocket WSS ประหยัดแรมสำหรับ NodeMCU',
    },
    {
      title: 'โค้ดตัวอย่าง: Web Dashboard (HTML / JS)',
      tab: 'web-js' as TabType,
      id: 'sec-web-code',
      desc: 'HTML หน้าเว็บแดชบอร์ดพร้อม MQTT.js สั่งงานและแสดงผลสด',
    },
    {
      title: 'โค้ดตัวอย่าง: Python / Raspberry Pi',
      tab: 'python' as TabType,
      id: 'sec-python-code',
      desc: 'สคริปต์ Python paho-mqtt เชื่อมต่อ WSS 443',
    },
  ]

  const filteredSearch = searchIndex.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleSelectSearchResult = (tab: TabType, id: string) => {
    setActiveTab(tab)
    setIsSearchOpen(false)
    setIsMobileMenuOpen(false)
    setSearchQuery('')
    setTimeout(() => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  // On this page TOC items per tab
  const getTocItems = (tab: TabType) => {
    switch (tab) {
      case 'overview':
        return [
          { id: 'sec-overview-title', label: 'ภาพรวมระบบ' },
          { id: 'sec-overview-params', label: 'พารามิเตอร์การเชื่อมต่อ' },
          { id: 'sec-overview-acl', label: 'นโยบายความปลอดภัย ACL' },
        ]
      case 'ct-servers':
        return [
          { id: 'sec-ct-title', label: 'ภาพรวมบริการ Cloud CT' },
          { id: 'sec-ct-active', label: 'เครื่องเซิร์ฟเวอร์ของคุณ' },
          { id: 'sec-ct-form', label: 'แบบฟอร์มยื่นคำขอเครื่อง' },
          
        ]
      case 'mqtt':
        return [
          { id: 'sec-mqtt-title', label: 'MQTT Broker (EMQX)' },
          { id: 'sec-mqtt-specs', label: 'พารามิเตอร์ Broker' },
          { id: 'sec-mqtt-console', label: 'Live Test Console' },
        ]
      case 'database':
        return [
          { id: 'sec-db-title', label: 'Database Server' },
          { id: 'sec-db-specs', label: 'InfluxDB Configuration' },
          { id: 'sec-db-curl', label: 'Line Protocol cURL' },
        ]
      case 'rest-api':
        return [
          { id: 'sec-api-title', label: 'REST API Telemetry' },
          { id: 'sec-api-specs', label: 'HTTP Specification' },
        ]
      case 'esp32':
        return [
          { id: 'sec-esp32-title', label: 'โค้ดตัวอย่าง ESP32' },
          { id: 'sec-esp32-code', label: 'ซอร์สโค้ด Arduino' },
        ]
      case 'esp8266':
        return [
          { id: 'sec-esp8266-title', label: 'โค้ดตัวอย่าง ESP8266' },
          { id: 'sec-esp8266-code', label: 'ซอร์สโค้ด NodeMCU' },
        ]
      case 'web-js':
        return [
          { id: 'sec-web-title', label: 'Web Dashboard (HTML/JS)' },
          { id: 'sec-web-code', label: 'ซอร์สโค้ด index.html' },
        ]
      case 'python':
        return [
          { id: 'sec-python-title', label: 'Python / Raspberry Pi' },
          { id: 'sec-python-code', label: 'ซอร์สโค้ด iot_client.py' },
        ]
      case 'admin':
        return [
          { id: 'sec-admin-passwords', label: 'ทะเบียน & รหัสผ่าน' },
          { id: 'sec-admin-queue', label: 'คิวคำขอเครื่อง' },
          { id: 'sec-admin-servers', label: 'เครื่องบน Proxmox' },
        ]
      default:
        return []
    }
  }

  const tocItems = getTocItems(activeTab)

  // Navigation Items List
  const navItems = [
    {
      category: 'ระบบและการตั้งค่า',
      items: [
        { id: 'overview' as TabType, label: 'ภาพรวม (Credentials)', icon: Sliders },
        { id: 'ct-servers' as TabType, label: 'ขอเครื่องเซิร์ฟเวอร์ (Cloud CT)', icon: Server },
        { id: 'mqtt' as TabType, label: 'MQTT Broker (EMQX)', icon: Radio },
        { id: 'database' as TabType, label: 'Database (InfluxDB v2)', icon: Database },
        { id: 'rest-api' as TabType, label: 'REST API & Webhooks', icon: Globe },
      ],
    },
    ...(isAdminUnlocked
      ? [
          {
            category: 'ผู้ดูแลระบบ (Administration)',
            items: [
              { id: 'admin' as TabType, label: 'แผงควบคุมอาจารย์ & ดูรหัสผ่าน', icon: ShieldCheck },
            ],
          },
        ]
      : []),
    {
      category: 'ตัวอย่างโค้ด (Starter Codes)',
      items: [
        { id: 'esp32' as TabType, label: 'ESP32 (Arduino C++)', icon: FileCode },
        { id: 'esp8266' as TabType, label: 'ESP8266 (NodeMCU)', icon: FolderGit2 },
        { id: 'web-js' as TabType, label: 'Web Dashboard (HTML/JS)', icon: Code2 },
        { id: 'python' as TabType, label: 'Python / Raspberry Pi', icon: Layers },
      ],
    },
  ]

  const getActiveTabTitle = () => {
    for (const group of navItems) {
      const match = group.items.find((i) => i.id === activeTab)
      if (match) return match.label
    }
    return 'เอกสารคู่มือ'
  }

  // Theme Switcher Component (Bulletproof Inline SVG)
  const ThemeToggle = ({ className = '' }: { className?: string }) => (
    <div className={`flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setThemeMode('light')}
        className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center ${
          themeMode === 'light'
            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        }`}
        title="ธีมสว่าง (Light Mode)"
        aria-label="Light Mode"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setThemeMode('dark')}
        className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center ${
          themeMode === 'dark'
            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        }`}
        title="ธีมมืด (Dark Mode)"
        aria-label="Dark Mode"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => setThemeMode('system')}
        className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center ${
          themeMode === 'system'
            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
            : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        }`}
        title="ตามระบบ (System Preference)"
        aria-label="System Theme"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans antialiased transition-colors">
      {!session ? (
        /* ========================================================================= */
        /* AUTH VIEW: Formal Neutral Light / Dark Theme                              */
        /* ========================================================================= */
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>

          <div className="w-full max-w-[360px]">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs">
                <Wifi className="h-4 w-4" />
              </div>
              <span className="font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
                LBtech IoT
              </span>
            </div>

            <div className="grid grid-cols-2 p-1 bg-zinc-200/70 dark:bg-zinc-800 rounded-lg mb-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register')
                  setAuthError('')
                }}
                className={`py-1.5 rounded-md transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                สมัครสมาชิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login')
                  setAuthError('')
                }}
                className={`py-1.5 rounded-md transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                เข้าสู่ระบบ
              </button>
            </div>

            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs">
              <form onSubmit={authMode === 'register' ? handleRegister : handleLogin} className="space-y-4">
                {authError && (
                  <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 font-medium">
                    {authError}
                  </div>
                )}

                <div>
                  <Label htmlFor="studentId">รหัสนักศึกษา</Label>
                  <Input
                    id="studentId"
                    type="text"
                    placeholder="เช่น 66319090001"
                    value={studentId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentId(e.target.value)}
                    required
                  />
                </div>

                {authMode === 'register' && (
                  <>
                    <div>
                      <Label htmlFor="fullName">ชื่อ-นามสกุล / สมาชิก</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="ชื่อผู้จัดทำ"
                        value={fullName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="projectTitle">ชื่อโครงงาน</Label>
                      <Input
                        id="projectTitle"
                        type="text"
                        placeholder="เช่น Smart Farm IoT"
                        value={projectTitle}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="department">แผนกวิชา</Label>
                      <Input
                        id="department"
                        type="text"
                        placeholder="เทคโนโลยีคอมพิวเตอร์"
                        value={department}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDepartment(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="password">รหัสผ่าน</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer p-1"
                      title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-medium bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg cursor-pointer transition-colors mt-4"
                >
                  {authMode === 'register' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* LOGGED IN WORKSPACE: Formal Neutral Theme, 100% Responsive                */
        /* ========================================================================= */
        <div className="flex-1 flex flex-col min-h-screen">
          {/* TOP NAVBAR */}
          <header className="sticky top-0 z-30 h-14 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 px-3 sm:px-6 flex items-center justify-between transition-colors">
            {/* Left: Mobile Drawer Button + Brand */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label="เปิดเมนูหลัก"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-xs shrink-0">
                <Wifi className="h-4 w-4" />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-tight">LBtech IoT Docs</span>
                <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline">System Setup</span>
              </div>
            </div>

            {/* Right: Theme Toggle & Search Button (Admin access hidden at /admin) */}
            <div className="flex items-center gap-2">
              <ThemeToggle />

              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer shadow-2xs"
              >
                <Search className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                <span className="hidden sm:inline">ค้นหาเอกสาร...</span>
                <span className="sm:hidden text-xs">ค้นหา</span>
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded">
                  Ctrl K
                </kbd>
              </button>
            </div>
          </header>

          {/* MOBILE SUB-BAR (ACTIVE TAB & TOC DROPDOWN) */}
          <div className="xl:hidden sticky top-14 z-20 bg-zinc-50/95 dark:bg-[#121214]/95 backdrop-blur-xs border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between transition-colors">
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {getActiveTabTitle()}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMobileTocOpen(!isMobileTocOpen)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer shadow-2xs"
              >
                <Bookmark className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                <span>ในหน้านี้</span>
                <ChevronDown className="h-3 w-3 text-zinc-400" />
              </button>

              {isMobileTocOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg p-2 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1">
                    กระโดดไปยังหัวข้อ
                  </div>
                  <div className="space-y-0.5">
                    {tocItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIsMobileTocOpen(false)
                          const el = document.getElementById(item.id)
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }
                        }}
                        className="w-full text-left py-1.5 px-2 rounded-md text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer truncate"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* MOBILE OFF-CANVAS SLIDE-OUT DRAWER */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={() => setIsMobileMenuOpen(false)}
              />

              <div className="relative w-72 max-w-[85vw] bg-white dark:bg-[#121214] border-r border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
                <div>
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center">
                        <Wifi className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">LBtech IoT Docs</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-12rem)] text-xs">
                    {navItems.map((group, idx) => (
                      <div key={idx}>
                        <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase px-2 mb-1.5">
                          {group.category}
                        </div>
                        <div className="space-y-0.5">
                          {group.items.map((item) => {
                            const Icon = item.icon
                            const isActive = activeTab === item.id
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleTabChange(item.id)}
                                className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg transition-colors cursor-pointer text-left ${
                                  isActive
                                    ? 'bg-zinc-900 dark:bg-zinc-800 text-white font-medium border border-transparent dark:border-zinc-700'
                                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span>{item.label}</span>
                                </div>
                                {isActive && <ChevronRight className="h-3 w-3" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 space-y-2">
                  <button
                    type="button"
                    onClick={openSettings}
                    className="w-full text-left p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 transition-all cursor-pointer flex items-center gap-2.5"
                  >
                    <div className="h-7 w-7 rounded-lg bg-zinc-900 dark:bg-zinc-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {session.fullName.substring(0, 1) || 'S'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                        {session.fullName}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                        {session.studentId} • ตั้งค่า
                      </div>
                    </div>
                    <Settings className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSession(null)}
                    className="w-full text-xs h-8 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 justify-start"
                  >
                    <LogOut className="h-3.5 w-3.5 mr-2" />
                    ออกจากระบบ
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* MAIN WORKSPACE: Desktop Sidebar + Content + Desktop On-This-Page */}
          <div className="flex-1 flex w-full">
            {/* DESKTOP LEFT SIDEBAR NAVIGATION */}
            <aside className="hidden md:flex md:w-64 bg-white dark:bg-[#121214] border-r border-zinc-200 dark:border-zinc-800 shrink-0 flex-col justify-between sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto transition-colors">
              <nav className="p-3 space-y-6 text-xs">
                {navItems.map((group, idx) => (
                  <div key={idx}>
                    <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wider uppercase px-2 mb-1.5">
                      {group.category}
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        const isActive = activeTab === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleTabChange(item.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors cursor-pointer text-left ${
                              isActive
                                ? 'bg-zinc-900 dark:bg-zinc-800 text-white font-medium border border-transparent dark:border-zinc-700'
                                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 shrink-0" />
                              <span>{item.label}</span>
                            </div>
                            {isActive && <ChevronRight className="h-3 w-3" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Desktop Profile & Settings */}
              <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-2">
                <button
                  type="button"
                  onClick={openSettings}
                  className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-zinc-900 dark:bg-zinc-700 text-white flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-zinc-800">
                      {session.fullName.substring(0, 1) || 'S'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate group-hover:text-zinc-950">
                        {session.fullName}
                      </div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-400 truncate flex items-center gap-1">
                        <span>{session.studentId}</span>
                        <span>•</span>
                        <span className="text-zinc-600 dark:text-zinc-300 font-medium group-hover:text-zinc-900">ตั้งค่าโปรไฟล์</span>
                      </div>
                    </div>
                    <Settings className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 shrink-0" />
                  </div>
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSession(null)}
                  className="w-full text-xs h-7 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 justify-start"
                >
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  ออกจากระบบ
                </Button>
              </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className={`flex-1 min-w-0 p-4 sm:p-6 md:p-8 mx-auto w-full transition-all ${activeTab === 'ct-servers' ? 'max-w-7xl' : 'max-w-4xl'}`}>
              {/* TAB 1: OVERVIEW & CREDENTIALS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div id="sec-overview-title">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      ภาพรวมระบบและข้อมูลเชื่อมต่อ (System Setup)
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      พารามิเตอร์เฉพาะกลุ่มสำหรับนำไปใส่ในโค้ดไมโครคอนโทรลเลอร์และหน้าเว็บแดชบอร์ด
                    </p>
                  </div>

                  {/* Group Identity Card */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/50 p-4 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm text-zinc-900 dark:text-white">
                            {session.projectTitle}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">{session.fullName}</span>
                          <span>•</span>
                          <span>{session.department}</span>
                          <span>•</span>
                          <span className="font-mono text-zinc-600 dark:text-zinc-400">ID: {session.studentId}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={openSettings}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs cursor-pointer self-start sm:self-center shrink-0"
                      >
                        <Settings className="h-3.5 w-3.5 text-zinc-500" />
                        <span>แก้ไขข้อมูลกลุ่ม</span>
                      </button>
                    </div>
                  </div>

                  {/* Connection Specs Table */}
                  <div id="sec-overview-params" className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] overflow-hidden shadow-xs">
                    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Connection Parameters
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">MQTT Host (WSS)</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all break-all">mqtt.pichyy.qzz.io</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Port / Path</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2">443 / /mqtt (WSS over Cloudflare)</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Username</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all">{session.studentId}</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Password</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2">{session.token}</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Topic Namespace</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all break-all">project/{session.studentId}/#</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Publish Topic (เซนเซอร์)</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all break-all">project/{session.studentId}/sensor</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Subscribe Topic (สั่งงาน)</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all break-all">project/{session.studentId}/control</code>
                      </div>
                    </div>
                  </div>

                  <div id="sec-overview-acl" className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] p-4 shadow-xs space-y-2">
                    <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">กติกาความปลอดภัยระบบ (Multi-Tenant ACL)</h2>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      ระบบกำหนดสิทธิ์การ Publish และ Subscribe ไว้ที่ <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-900 dark:text-zinc-200">project/{session.studentId}/#</code> เท่านั้น 
                      ทำให้บอร์ดไมโครคอนโทรลเลอร์ของคุณไม่มีวันชนกับโครงงานกลุ่มอื่น และกลุ่มอื่นจะไม่สามารถส่งคำสั่งแทรกแซงบอร์ดของคุณได้
                    </p>
                  </div>
                </div>
              )}

              {/* TAB: CT SERVERS PROVISIONING (NEW FEATURE) */}
              {activeTab === 'ct-servers' && (
                <div className="space-y-6">
                  <div id="sec-ct-title" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                        {isCreatingServer && (
                          <button
                            type="button"
                            onClick={() => {
                              setReqError('')
                              setIsCreatingServer(false)
                            }}
                            className="p-1 -ml-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors"
                            title="ย้อนกลับไปหน้ารายการเครื่อง"
                            aria-label="ย้อนกลับ"
                          >
                            <ArrowLeft className="h-5 w-5" />
                          </button>
                        )}
                        <Server className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
                        <span>บริการเครื่องเซิร์ฟเวอร์ (Cloud CT Provisioning)</span>
                      </h1>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {isCreatingServer
                          ? 'ระบุชื่อเครื่อง เลือกระบบปฏิบัติการ และจัดสรรทรัพยากรสำหรับโครงงาน'
                          : 'ยื่นขอเครื่องคอมพิวเตอร์แม่ข่ายเสมือน (LXC Container) สำหรับรันฐานข้อมูล เว็บไซต์ หรือ API ประจำกลุ่ม'}
                      </p>
                    </div>

                    {isAdminUnlocked && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>โหมดอาจารย์ (Admin Review)</span>
                      </div>
                    )}
                  </div>

                  {/* ADMIN REVIEW QUEUE (Visible only when unlocked) */}
                  {isAdminUnlocked && (
                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          <ShieldCheck className="h-4 w-4" />
                          <span>คิวคำขอรอการอนุมัติ (Teacher Approval Queue)</span>
                          <span className="px-2 py-0.5 text-[11px] rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono">
                            {ctRequests.filter((r) => r.status === 'pending').length} รายการ
                          </span>
                        </div>
                      </div>

                      {ctRequests.filter((r) => r.status === 'pending').length === 0 ? (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 italic text-center py-4 bg-white/60 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          ไม่มีคำขอที่รอการอนุมัติในขณะนี้
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {ctRequests
                            .filter((r) => r.status === 'pending')
                            .map((req) => (
                              <div
                                key={req.id}
                                className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs space-y-3 text-xs"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                                  <div>
                                    <span className="font-bold text-zinc-900 dark:text-white text-sm">
                                      {req.serverName}
                                    </span>
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                      {req.os}
                                    </span>
                                  </div>
                                  <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                                    ยื่นเมื่อ: {req.createdAt}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                                  <div>
                                    <span className="text-zinc-400 block">ผู้ขอ / กลุ่ม:</span>
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
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
                                      {req.vcpu} Core • {req.ram} MB RAM • {req.disk} GB Disk
                                    </span>
                                  </div>
                                </div>

                                <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                                  <span className="font-semibold block text-zinc-500 dark:text-zinc-400 mb-0.5">
                                    วัตถุประสงค์การใช้งาน:
                                  </span>
                                  {req.purpose}
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectRequest(req.id)}
                                    className="h-8 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900 cursor-pointer"
                                  >
                                    ปฏิเสธคำขอ
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveRequest(req)}
                                    className="h-8 text-xs bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer font-medium"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                    อนุมัติและสร้างเครื่องทันที
                                  </Button>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CT SERVER VIEWS: 1) FORM VIEW, 2) EMPTY STATE, 3) ACTIVE + PENDING DASHBOARD */}
                  {isCreatingServer ? (
                    /* ========================================================================= */
                    /* 1) REQUEST FORM VIEW                                                      */
                    /* ========================================================================= */
                    <div id="sec-ct-form" className="border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#121214] p-5 sm:p-6 shadow-xs space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
                            แบบฟอร์มยื่นคำขอเครื่องเซิร์ฟเวอร์ (Cloud CT)
                          </h2>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            ระบุชื่อเครื่อง เลือกระบบปฏิบัติการ และจัดสรรทรัพยากรสำหรับโครงงาน
                          </p>
                        </div>
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg self-start sm:self-center">
                          โควตาปัจจุบัน: {studentActiveServers.length + (studentPendingRequest ? 1 : 0)}/2 เครื่อง
                        </span>
                      </div>

                      {reqError && (
                        <div className="p-3.5 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 font-medium">
                          {reqError}
                        </div>
                      )}

                      <form onSubmit={handleCreateRequest} className="space-y-5">
                        {/* Hostname */}
                        <div>
                          <Label htmlFor="serverName">ชื่อเครื่องเซิร์ฟเวอร์ (Hostname) *</Label>
                          <Input
                            id="serverName"
                            type="text"
                            placeholder="เช่น smartfarm-db หรือ myproject-web"
                            value={reqServerName}
                            onChange={(e) => setReqServerName(e.target.value)}
                            required
                          />
                          <span className="text-[10px] text-zinc-400 mt-1 block">
                            ใช้ภาษาอังกฤษ ตัวเลข และขีดกลาง (-) เท่านั้น (ความยาว 3-20 ตัวอักษร)
                          </span>
                        </div>

                        {/* OS Selection with REAL OFFICIAL LOGOS */}
                        <div>
                          <Label>เลือกระบบปฏิบัติการ (OS Distribution) *</Label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1.5">
                            {/* Debian 12 */}
                            <label
                              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                                reqOs === 'debian-12'
                                  ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800/90 font-medium shadow-xs ring-1 ring-zinc-900/10 dark:ring-white/20'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/40'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2.5">
                                  <DebianLogo className="h-8 w-8 shrink-0" />
                                  <div>
                                    <span className="font-bold text-zinc-900 dark:text-white block text-xs">Debian 12</span>
                                    <span className="text-[10px] text-zinc-400 font-mono">Bookworm</span>
                                  </div>
                                </div>
                                <input
                                  type="radio"
                                  name="os"
                                  value="debian-12"
                                  checked={reqOs === 'debian-12'}
                                  onChange={() => setReqOs('debian-12')}
                                  className="accent-zinc-900 dark:accent-zinc-100 mt-1"
                                />
                              </div>
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                เสถียร มาตรฐาน เหมาะกับระบบฐานข้อมูล, InfluxDB, PostgreSQL และงาน IoT
                              </span>
                            </label>

                            {/* Ubuntu 24.04 */}
                            <label
                              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                                reqOs === 'ubuntu-24'
                                  ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800/90 font-medium shadow-xs ring-1 ring-zinc-900/10 dark:ring-white/20'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/40'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2.5">
                                  <UbuntuLogo className="h-8 w-8 shrink-0" />
                                  <div>
                                    <span className="font-bold text-zinc-900 dark:text-white block text-xs">Ubuntu 24.04</span>
                                    <span className="text-[10px] text-zinc-400 font-mono">Noble LTS</span>
                                  </div>
                                </div>
                                <input
                                  type="radio"
                                  name="os"
                                  value="ubuntu-24"
                                  checked={reqOs === 'ubuntu-24'}
                                  onChange={() => setReqOs('ubuntu-24')}
                                  className="accent-zinc-900 dark:accent-zinc-100 mt-1"
                                />
                              </div>
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                ทันสมัย แพ็กเกจใหม่ล่าสุด เหมาะกับเว็บเซิร์ฟเวอร์, Python, FastAPI และ AI
                              </span>
                            </label>

                            {/* Alpine 3.22 */}
                            <label
                              className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                                reqOs === 'alpine-3'
                                  ? 'border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800/90 font-medium shadow-xs ring-1 ring-zinc-900/10 dark:ring-white/20'
                                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/40'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2.5">
                                  <AlpineLogo className="h-8 w-8 shrink-0" />
                                  <div>
                                    <span className="font-bold text-zinc-900 dark:text-white block text-xs">Alpine 3.22</span>
                                    <span className="text-[10px] text-zinc-400 font-mono">musl libc</span>
                                  </div>
                                </div>
                                <input
                                  type="radio"
                                  name="os"
                                  value="alpine-3"
                                  checked={reqOs === 'alpine-3'}
                                  onChange={() => setReqOs('alpine-3')}
                                  className="accent-zinc-900 dark:accent-zinc-100 mt-1"
                                />
                              </div>
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                เบาจิ๋ว ประหยัดแรม บูตเร็วใน 1 วินาที เหมาะกับ Broker และ Microservices
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* 1. CPU vCPU CORES */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <Label className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                              <Cpu className="h-3.5 w-3.5 text-zinc-500" />
                              <span>จำนวนประมวลผล (vCPU Cores)</span>
                            </Label>
                            <span className="text-[11px] text-zinc-400">จำกัด 1 - 2 Cores</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Compact Stepper (- / +) */}
                            <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => setReqVcpu(Math.max(1, reqVcpu - 1))}
                                disabled={reqVcpu <= 1}
                                className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                aria-label="ลด CPU"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-16 text-center font-mono font-semibold text-xs text-zinc-900 dark:text-white">
                                {reqVcpu} Core{reqVcpu > 1 ? 's' : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => setReqVcpu(Math.min(2, reqVcpu + 1))}
                                disabled={reqVcpu >= 2}
                                className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                aria-label="เพิ่ม CPU"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {/* Quick Select Chips */}
                            <div className="flex items-center gap-1.5">
                              {[1, 2].map((core) => (
                                <button
                                  key={core}
                                  type="button"
                                  onClick={() => setReqVcpu(core)}
                                  className={`h-8 px-3.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                                    reqVcpu === core
                                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-2xs'
                                      : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750'
                                  }`}
                                >
                                  {core} Core{core > 1 ? 's' : ''}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 2. RAM MEMORY */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <Label className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                              <Activity className="h-3.5 w-3.5 text-zinc-500" />
                              <span>หน่วยความจำหลัก (RAM Memory)</span>
                            </Label>
                            <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {reqRam >= 1024 ? `${reqRam / 1024} GB` : `${reqRam} MB`}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {[512, 1024, 2048, 4096].map((ramOpt) => (
                              <button
                                key={ramOpt}
                                type="button"
                                onClick={() => setReqRam(ramOpt)}
                                className={`h-8 px-3.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                                  reqRam === ramOpt
                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-2xs'
                                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750'
                                }`}
                              >
                                {ramOpt >= 1024 ? `${ramOpt / 1024} GB` : `${ramOpt} MB`}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. STORAGE SSD */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <Label className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                              <HardDrive className="h-3.5 w-3.5 text-zinc-500" />
                              <span>พื้นที่จัดเก็บข้อมูล (Storage SSD NVMe)</span>
                            </Label>
                            <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {reqDisk} GB
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {[5, 10, 15, 20, 30].map((diskOpt) => (
                              <button
                                key={diskOpt}
                                type="button"
                                onClick={() => setReqDisk(diskOpt)}
                                className={`h-8 px-3.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ${
                                  reqDisk === diskOpt
                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-2xs'
                                    : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750'
                                }`}
                              >
                                {diskOpt} GB
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Purpose Description */}
                        <div>
                          <Label htmlFor="purpose">วัตถุประสงค์ในการขอเครื่องและโปรแกรมที่จะติดตั้ง *</Label>
                          <textarea
                            id="purpose"
                            rows={3}
                            placeholder="เช่น ติดตั้ง PostgreSQL Database และรัน Node.js API สำหรับบันทึกค่าและสั่งการเซนเซอร์ในโครงงาน Smart Farm"
                            value={reqPurpose}
                            onChange={(e) => setReqPurpose(e.target.value)}
                            className="w-full text-xs p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-colors"
                            required
                          />
                        </div>

                        {/* Terms of Service Checkbox & Modal Trigger */}
                        <div className="pt-2 p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                          <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={reqAgreedTerms}
                              onChange={(e) => setReqAgreedTerms(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded accent-zinc-900 dark:accent-zinc-100 cursor-pointer shrink-0"
                              required
                            />
                            <span className="text-zinc-700 dark:text-zinc-300 leading-snug">
                              ข้าพเจ้ายอมรับข้อตกลงและนโยบายการใช้งานเครื่องคอมพิวเตอร์แม่ข่ายเพื่อการศึกษา{' '}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  setIsTermsModalOpen(true)
                                }}
                                className="text-blue-600 dark:text-blue-400 underline font-semibold hover:text-blue-700 cursor-pointer inline"
                              >
                                (อ่านข้อกำหนดและเงื่อนไข)
                              </button>
                            </span>
                          </label>
                        </div>

                        {/* Form Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setReqError('')
                              setIsCreatingServer(false)
                            }}
                            className="h-10 text-xs px-4"
                          >
                            ยกเลิก
                          </Button>
                          <Button
                            type="submit"
                            disabled={!reqAgreedTerms}
                            className="h-10 text-xs font-semibold px-6 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            ส่งคำขอสร้างเครื่องเซิร์ฟเวอร์
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : studentActiveServers.length === 0 && !studentPendingRequest ? (
                    /* ========================================================================= */
                    /* 2) EMPTY STATE VIEW (When student has no servers yet)                     */
                    /* ========================================================================= */
                    <div id="sec-ct-active" className="border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-[#121214] p-8 sm:p-12 text-center space-y-6 shadow-xs">
                      <div className="h-16 w-16 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-750">
                        <Server className="h-8 w-8 stroke-[1.5]" />
                      </div>
                      <div className="max-w-md mx-auto space-y-2">
                        <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                          ยังไม่มีเครื่องเซิร์ฟเวอร์ในกลุ่มของคุณ
                        </h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          คุณสามารถขอเครื่องแม่ข่ายเสมือน (LXC Container) ประจำกลุ่มสำหรับรันฐานข้อมูล เว็บไซต์ หรือ API ได้ฟรี โดยเลือกสเปก vCPU, RAM และระบบปฏิบัติการ Debian, Ubuntu หรือ Alpine ตามความต้องการ (จำกัดสิทธิ์กลุ่มละ 2 เครื่อง)
                        </p>
                      </div>
                      <div>
                        <Button
                          type="button"
                          onClick={() => {
                            setReqError('')
                            setReqSuccess('')
                            setIsCreatingServer(true)
                          }}
                          className="h-10 px-6 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          <span>ขอเครื่องเซิร์ฟเวอร์</span>
                        </Button>
                      </div>
                      <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800 text-xs">
                          <span className="font-semibold text-zinc-900 dark:text-white block mb-0.5">Unprivileged LXC</span>
                          <span className="text-[11px] text-zinc-500 leading-relaxed">ปลอดภัยสูง แยกสภาพแวดล้อมเฉพาะกลุ่มอย่างเด็ดขาด</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800 text-xs">
                          <span className="font-semibold text-zinc-900 dark:text-white block mb-0.5">Web Terminal ในตัว</span>
                          <span className="text-[11px] text-zinc-500 leading-relaxed">พิมพ์คำสั่ง Linux shell บนเบราว์เซอร์ได้ทันทีโดยไม่ต้องลงโปรแกรม</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800 text-xs">
                          <span className="font-semibold text-zinc-900 dark:text-white block mb-0.5">External SSH Port 2222</span>
                          <span className="text-[11px] text-zinc-500 leading-relaxed">ยิง SSH จาก VS Code, PuTTY หรือ Terminal นอกเครือข่ายวิทยาลัย</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedServerVmid !== null ? (
                    /* ========================================================================= */
                    /* 2.1) DEDICATED SERVER WORKSPACE (Selected Server Detail & Console)        */
                    /* ========================================================================= */
                    (() => {
                      const selectedServer =
                        studentActiveServers.find((s) => s.vmid === selectedServerVmid) ||
                        ctServers.find((s) => s.vmid === selectedServerVmid)

                      if (!selectedServer) {
                        return (
                          <div className="p-8 text-center border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] space-y-3">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              ไม่พบข้อมูลเซิร์ฟเวอร์ที่เลือก หรือเซิร์ฟเวอร์ถูกลบแล้ว
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedServerVmid(null)}
                              className="text-xs"
                            >
                              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                              กลับสู่ Server Hub
                            </Button>
                          </div>
                        )
                      }

                      const isRunning = selectedServer.status === 'running'

                      return (
                        <div className="space-y-4">
                          {/* Top Navigation Breadcrumb */}
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setSelectedServerVmid(null)}
                              className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium transition-colors cursor-pointer"
                            >
                              <ArrowLeft className="h-4 w-4" />
                              <span>กลับสู่ Server Hub (หน้ารวมเซิร์ฟเวอร์)</span>
                            </button>

                            <div className="text-[11px] text-zinc-400 font-mono">
                              CT ID: {selectedServer.vmid}
                            </div>
                          </div>

                          {/* Server Workspace Header Banner - Clean Monochrome Bar */}
                          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] p-4 sm:p-4.5 shadow-xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="shrink-0">
                                  {renderOSLogo(selectedServer.osKey, 'h-10 w-10')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-base text-zinc-900 dark:text-white">
                                      {selectedServer.name}
                                    </h2>
                                    <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                                      CT {selectedServer.vmid}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                        isRunning
                                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                      }`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          isRunning ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-400'
                                        }`}
                                      />
                                      {isRunning ? 'Online' : 'Stopped'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-2">
                                    <span>{selectedServer.os}</span>
                                    <span>•</span>
                                    <span>IP: <code className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{selectedServer.ip}</code></span>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Power Controls (Monochrome Black & White) */}
                              <div className="flex items-center gap-2 self-start sm:self-center">
                                <Button
                                  size="sm"
                                  variant={isRunning ? 'outline' : 'default'}
                                  onClick={() => handleTogglePower(selectedServer.vmid)}
                                  className={`h-8 text-xs cursor-pointer ${
                                    !isRunning ? 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900' : ''
                                  }`}
                                  title={isRunning ? 'ปิดเครื่อง' : 'เปิดเครื่อง'}
                                >
                                  {isRunning ? (
                                    <>
                                      <Square className="h-3 w-3 mr-1 text-red-500 fill-current" />
                                      <span>ปิดเครื่อง</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3 w-3 mr-1 fill-current" />
                                      <span>เปิดเครื่อง</span>
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!isRunning}
                                  onClick={() => handleReboot(selectedServer.vmid)}
                                  className="h-8 text-xs cursor-pointer"
                                  title="รีสตาร์ตเครื่อง"
                                >
                                  <RotateCw className="h-3 w-3 mr-1" />
                                  <span>รีสตาร์ต</span>
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!isRunning}
                                  onClick={() => {
                                    setTerminalServer(selectedServer)
                                    setTerminalMode('fullscreen')
                                  }}
                                  className="h-8 text-xs cursor-pointer hidden sm:inline-flex"
                                  title="ขยายคอนโซลเต็มหน้าจอ"
                                >
                                  <Terminal className="h-3 w-3 mr-1" />
                                  <span>เต็มจอ</span>
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* 2-COLUMN DEDICATED WORKSPACE: Left = Large Console, Right = Controls & Specs */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                            {/* LEFT COLUMN: Large Dedicated Web Console (8 cols / ~67% width) */}
                            <div className="lg:col-span-8 space-y-3">
                              {!isRunning ? (
                                <div className="p-12 text-center border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] space-y-4">
                                  <div className="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 mx-auto">
                                    <Square className="h-5 w-5 text-zinc-400" />
                                  </div>
                                  <div className="space-y-1">
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                                      เครื่องเซิร์ฟเวอร์ปิดอยู่ (Stopped)
                                    </h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                      กรุณาเปิดเครื่องเซิร์ฟเวอร์เพื่อเริ่มใช้งาน Web Console และเชื่อมต่อภายนอก
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => handleTogglePower(selectedServer.vmid)}
                                    className="h-9 px-4 text-xs bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 cursor-pointer inline-flex items-center gap-1.5 rounded-lg shadow-xs"
                                  >
                                    <Play className="h-3.5 w-3.5 fill-current" />
                                    <span>เปิดเครื่องเซิร์ฟเวอร์</span>
                                  </Button>
                                </div>
                              ) : (
                                <EmbeddedTerminal
                                  server={selectedServer}
                                  mode="embedded"
                                  onModeChange={setTerminalMode}
                                  onClose={() => setSelectedServerVmid(null)}
                                />
                              )}
                            </div>

                            {/* RIGHT COLUMN: Credentials, SSH Bastion & Specs (4 cols / ~33% width) */}
                            <div className="lg:col-span-4 space-y-4">
                              {/* 1. Root Credentials Card */}
                              <div className="p-4 bg-white dark:bg-[#121214] rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-xs text-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                                  <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                                    <Key className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                                    <span>ข้อมูลเข้าสู่ระบบ (Root)</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400">สิทธิ์ Root</span>
                                </div>

                                <div className="space-y-2.5">
                                  {/* Username */}
                                  <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <div className="text-[10px] text-zinc-400">Username</div>
                                      <code className="font-mono font-bold text-zinc-900 dark:text-white text-xs">root</code>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => copyServerText('root', `user_${selectedServer.vmid}`)}
                                      className="h-7 w-7 p-0 cursor-pointer text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                      title="คัดลอก Username"
                                    >
                                      {copiedServerKey === `user_${selectedServer.vmid}` ? (
                                        <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </div>

                                  {/* Password */}
                                  <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div className="space-y-0.5 min-w-0 pr-2">
                                      <div className="text-[10px] text-zinc-400">Password</div>
                                      <code className="font-mono text-zinc-900 dark:text-white text-xs truncate block">
                                        {showServerPasswords[selectedServer.vmid]
                                          ? selectedServer.rootPassword || 'News030347'
                                          : '••••••••••••'}
                                      </code>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setShowServerPasswords((prev) => ({
                                            ...prev,
                                            [selectedServer.vmid]: !prev[selectedServer.vmid]
                                          }))
                                        }
                                        className="h-7 w-7 p-0 cursor-pointer text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                        title={showServerPasswords[selectedServer.vmid] ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                      >
                                        {showServerPasswords[selectedServer.vmid] ? (
                                          <EyeOff className="h-3.5 w-3.5" />
                                        ) : (
                                          <Eye className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          copyServerText(
                                            selectedServer.rootPassword || 'News030347',
                                            `pass_${selectedServer.vmid}`
                                          )
                                        }
                                        className="h-7 w-7 p-0 cursor-pointer text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                        title="คัดลอก Password"
                                      >
                                        {copiedServerKey === `pass_${selectedServer.vmid}` ? (
                                          <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* 2. SSH Bastion Access Card */}
                              <div className="p-4 bg-white dark:bg-[#121214] rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-xs text-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                                  <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                                    <Globe className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                                    <span>SSH Bastion (ภายนอก)</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 font-mono">Port 10000</span>
                                </div>

                                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                                  <code className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px] select-all break-all">
                                    ssh {selectedServer.studentId}@techniccom.tail59415d.ts.net -p 10000
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      copyServerText(
                                        `ssh ${selectedServer.studentId}@techniccom.tail59415d.ts.net -p 10000`,
                                        `ssh_${selectedServer.vmid}`
                                      )
                                    }
                                    className="h-7 text-xs px-2 shrink-0 cursor-pointer"
                                  >
                                    {copiedServerKey === `ssh_${selectedServer.vmid}` ? (
                                      <Check className="h-3 w-3 text-zinc-900 dark:text-zinc-100" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>

                                <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
                                  <div className="font-medium text-zinc-800 dark:text-zinc-200">VS Code Remote - SSH config:</div>
                                  <pre className="p-2 rounded bg-zinc-100 dark:bg-zinc-950 font-mono text-[10px] text-zinc-800 dark:text-zinc-300 overflow-x-auto leading-relaxed">
{`Host lbtech-${selectedServer.name}
  HostName techniccom.tail59415d.ts.net
  Port 10000
  User ${selectedServer.studentId}`}
                                  </pre>
                                </div>
                              </div>

                              {/* 3. Specs Details Card */}
                              <div className="p-4 bg-white dark:bg-[#121214] rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3 shadow-xs text-xs">
                                <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                                  <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                                    <Cpu className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
                                    <span>ข้อมูลทรัพยากร (Specs)</span>
                                  </div>
                                  <span className="font-mono text-[10px] text-zinc-400">CT {selectedServer.vmid}</span>
                                </div>

                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                                  <div className="py-2 flex items-center justify-between">
                                    <span className="text-zinc-500 dark:text-zinc-400">หน่วยประมวลผล (vCPU)</span>
                                    <span className="font-mono font-semibold text-zinc-900 dark:text-white">{selectedServer.vcpu} Cores</span>
                                  </div>
                                  <div className="py-2 flex items-center justify-between">
                                    <span className="text-zinc-500 dark:text-zinc-400">หน่วยความจำ (RAM)</span>
                                    <span className="font-mono font-semibold text-zinc-900 dark:text-white">{selectedServer.ram} MB</span>
                                  </div>
                                  <div className="py-2 flex items-center justify-between">
                                    <span className="text-zinc-500 dark:text-zinc-400">พื้นที่จัดเก็บ (NVMe SSD)</span>
                                    <span className="font-mono font-semibold text-zinc-900 dark:text-white">{selectedServer.disk} GB</span>
                                  </div>
                                  <div className="py-2 flex items-center justify-between">
                                    <span className="text-zinc-500 dark:text-zinc-400">IP ภายในวิทยาลัย</span>
                                    <code className="font-mono text-zinc-900 dark:text-white font-semibold">{selectedServer.ip}</code>
                                  </div>
                                  <div className="py-2 flex items-center justify-between">
                                    <span className="text-zinc-500 dark:text-zinc-400">เวลาทำงาน (Uptime)</span>
                                    <span className="font-mono text-zinc-900 dark:text-white">{isRunning ? selectedServer.uptime || 'กำลังทำงาน' : 'ปิดอยู่'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  ) : (
                    /* ========================================================================= */
                    /* 2.2) SERVER HUB OVERVIEW (List of All Servers & Access Guide)             */
                    /* ========================================================================= */
                    <div id="sec-ct-active" className="space-y-5">
                      {/* Section Title & Request Button */}
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                            <span>ศูนย์รวมเครื่องเซิร์ฟเวอร์ (Server Hub)</span>
                            <span className="font-mono text-zinc-400">
                              ({studentActiveServers.length + (studentPendingRequest ? 1 : 0)}/2 เครื่อง)
                            </span>
                          </h2>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            เลือกเครื่องเซิร์ฟเวอร์ด้านล่างเพื่อเข้าสู่หน้าทำงานและเปิด Web Console
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            studentActiveServers.length + (studentPendingRequest ? 1 : 0) >= 2 ||
                            !!studentPendingRequest
                          }
                          onClick={() => {
                            setReqError('')
                            setReqSuccess('')
                            setIsCreatingServer(true)
                          }}
                          className="h-8 text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            studentPendingRequest
                              ? 'มีคำขอที่อยู่ระหว่างรออนุมัติแล้ว 1 รายการ'
                              : studentActiveServers.length >= 2
                              ? 'กลุ่มของคุณใช้งานครบโควตาสูงสุด 2 เครื่องแล้ว'
                              : 'ขอเครื่องเซิร์ฟเวอร์เพิ่ม'
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>ขอเครื่องเซิร์ฟเวอร์</span>
                        </Button>
                      </div>

                      {/* ACCESS GUIDE (COLLAPSIBLE HOW-TO) */}
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => setShowAccessGuide(!showAccessGuide)}
                          className="w-full flex items-center justify-between p-4 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-zinc-500" />
                            <span>วิธีการเชื่อมต่อและเข้าใช้งานเครื่องเซิร์ฟเวอร์ (Access Guide)</span>
                          </span>
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-normal">
                            {showAccessGuide ? 'ซ่อนคู่มือ' : 'กดดูวิธีการ'}
                            {showAccessGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </span>
                        </button>

                        {showAccessGuide && (
                          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-zinc-50/50 dark:bg-zinc-900/30">
                            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                              <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                                <span>1. Web Console ในตัว</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                กดปุ่ม <strong>เข้าทำงานในเครื่อง</strong> ที่การ์ดเครื่อง เพื่อเปิดหน้าต่าง Terminal บนเว็บ สั่งงานคำสั่ง Linux ได้ทันทีโดยไม่ต้องลงโปรแกรม
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                              <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-zinc-500" />
                                <span>2. SSH จากที่บ้าน / ภายนอก</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                ยิง SSH จาก VS Code, PuTTY หรือ Terminal เข้าพอร์ต 10000 ด้วยคำสั่ง <code className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">ssh รหัสนักศึกษา@techniccom.tail59415d.ts.net -p 10000</code>
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-1">
                              <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                <Key className="h-3.5 w-3.5 text-zinc-500" />
                                <span>3. สิทธิ์ Root และ Docker</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                นักศึกษาได้รับสิทธิ์ <strong>root</strong> เต็มระบบ สามารถลง Docker, ติดตั้ง Web Server (Nginx, Node, Python) หรือ Database ได้ตามต้องการ
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PENDING SERVER CARD (Status: รออนุมัติ) */}
                      {studentPendingRequest && (
                        <div className="border border-dashed border-amber-300 dark:border-amber-800/80 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-amber-200/60 dark:border-amber-900/40">
                            <div className="flex items-center gap-3">
                              <div className="shrink-0">
                                {renderOSLogo(studentPendingRequest.os, 'h-8 w-8')}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                                    {studentPendingRequest.serverName}
                                  </h3>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                    <Clock className="h-3 w-3 animate-spin" />
                                    <span>รออาจารย์อนุมัติ</span>
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                  {studentPendingRequest.os} • {studentPendingRequest.vcpu} vCPU / {studentPendingRequest.ram} MB RAM / {studentPendingRequest.disk} GB Disk
                                </div>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectRequest(studentPendingRequest.id)}
                              className="h-7 text-xs text-zinc-600 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-zinc-200 dark:border-zinc-700 cursor-pointer self-start sm:self-center"
                              title="ยกเลิกคำขอนี้"
                            >
                              ยกเลิกคำขอ
                            </Button>
                          </div>

                          <div className="text-xs text-zinc-600 dark:text-zinc-400 italic">
                            "{studentPendingRequest.purpose}"
                          </div>
                        </div>
                      )}

                      {/* ACTIVE SERVERS LIST */}
                      {studentActiveServers.length === 0 && !studentPendingRequest ? (
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] p-8 text-center space-y-4">
                          <Server className="h-8 w-8 mx-auto text-zinc-400" />
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                              ยังไม่มีเครื่องเซิร์ฟเวอร์ในกลุ่มของคุณ
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                              ยื่นขอเครื่องคอมพิวเตอร์แม่ข่ายเสมือนเพื่อเริ่มพัฒนาโครงงาน ได้สเปก vCPU, RAM, SSD และ Web Console พร้อมใช้งาน
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setReqError('')
                              setReqSuccess('')
                              setIsCreatingServer(true)
                            }}
                            className="h-8 text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            <span>ขอเครื่องเซิร์ฟเวอร์</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {studentActiveServers.map((server) => {
                            const isRunning = server.status === 'running'
                            return (
                              <div
                                key={server.vmid}
                                className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                              >
                                <div className="space-y-3">
                                  {/* Card Top: Logo, Name, Status */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                      <div className="shrink-0">
                                        {renderOSLogo(server.osKey, 'h-9 w-9')}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                                            {server.name}
                                          </h3>
                                          <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                            CT {server.vmid}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                          {server.os}
                                        </div>
                                      </div>
                                    </div>

                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                        isRunning
                                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                                      }`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          isRunning ? 'bg-zinc-800 dark:bg-zinc-200' : 'bg-zinc-400'
                                        }`}
                                      />
                                      {isRunning ? 'Online' : 'Stopped'}
                                    </span>
                                  </div>

                                  {/* Specs Chips */}
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-center">
                                      <div className="text-[10px] text-zinc-400">vCPU</div>
                                      <div className="font-mono font-semibold text-zinc-900 dark:text-white text-xs mt-0.5">
                                        {server.vcpu} Core
                                      </div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-center">
                                      <div className="text-[10px] text-zinc-400">RAM</div>
                                      <div className="font-mono font-semibold text-zinc-900 dark:text-white text-xs mt-0.5">
                                        {server.ram} MB
                                      </div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-center">
                                      <div className="text-[10px] text-zinc-400">SSD</div>
                                      <div className="font-mono font-semibold text-zinc-900 dark:text-white text-xs mt-0.5">
                                        {server.disk} GB
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between pt-1">
                                    <span>IP: <code className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{server.ip}</code></span>
                                    <span>SSH Port: <code className="font-mono text-zinc-700 dark:text-zinc-300">10000</code></span>
                                  </div>
                                </div>

                                {/* Card Bottom Actions */}
                                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant={isRunning ? 'outline' : 'default'}
                                      onClick={() => handleTogglePower(server.vmid)}
                                      className={`h-7 text-xs px-2.5 cursor-pointer ${
                                        !isRunning ? 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900' : ''
                                      }`}
                                      title={isRunning ? 'ปิดเครื่อง' : 'เปิดเครื่อง'}
                                    >
                                      {isRunning ? (
                                        <Square className="h-3 w-3 text-red-500 fill-current" />
                                      ) : (
                                        <Play className="h-3 w-3 fill-current" />
                                      )}
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!isRunning}
                                      onClick={() => handleReboot(server.vmid)}
                                      className="h-7 text-xs px-2 cursor-pointer"
                                      title="รีสตาร์ตเครื่อง"
                                    >
                                      <RotateCw className="h-3 w-3" />
                                    </Button>
                                  </div>

                                  {/* PRIMARY BUTTON: ENTER DEDICATED WORKSPACE */}
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedServerVmid(server.vmid)
                                      setServerWorkspaceTab('console')
                                      setTerminalServer(server)
                                      setTerminalMode('embedded')
                                    }}
                                    className="h-8 text-xs px-3.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-semibold cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
                                  >
                                    <Terminal className="h-3.5 w-3.5" />
                                    <span>เข้าทำงานในเครื่อง</span>
                                    <ChevronRight className="h-3.5 w-3.5 -mr-0.5" />
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}


                </div>
              )}

              {/* TAB: ADMIN MASTER CONSOLE & PASSWORDS */}
              {activeTab === 'admin' && (
                <AdminPanel
                  adminPin={adminPinInput || '2569'}
                  onLock={() => {
                    setIsAdminUnlocked(false)
                    window.history.pushState(null, '', '/')
                    setActiveTab('overview')
                    if (session?.studentId === 'ADMIN') {
                      setSession(null)
                    }
                  }}
                  onApproveRequest={handleApproveRequest}
                  onRejectRequest={handleRejectRequest}
                  onTogglePower={handleTogglePower}
                  onReboot={handleReboot}
                  onDestroyServer={handleDestroyServer}
                  onOpenTerminal={(srv) => {
                    setTerminalServer(srv)
                    setTerminalMode('fullscreen')
                  }}
                  ctRequests={ctRequests}
                  ctServers={ctServers}
                />
              )}

              {/* TAB 2: MQTT BROKER & LIVE CONSOLE */}
              {activeTab === 'mqtt' && (
                <div className="space-y-6">
                  <div id="sec-mqtt-title" className="flex items-center gap-3.5">
                    <EMQXLogo className="h-9 w-9 shrink-0" />
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        MQTT Broker (EMQX v5)
                      </h1>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        ระบบส่งข้อความ Real-time รองรับทั้ง WebSockets (WSS) และ Pub/Sub ความเร็วสูง
                      </p>
                    </div>
                  </div>

                  {/* NOTE CALLOUT */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-start gap-3">
                    <HelpCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">ข้อควรทราบเกี่ยวกับระบบ MQTT</div>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        ระบบแยกสิทธิ์ตามรหัสนักศึกษา อนุญาตให้ Publish และ Subscribe เฉพาะ Topic ภายใต้ <code className="font-mono text-zinc-800 dark:text-zinc-200">project/{session.studentId}/#</code> เท่านั้น เพื่อป้องกันไม่ให้ข้อมูลหรือคำสั่งควบคุมชนกับกลุ่มอื่น
                      </p>
                    </div>
                  </div>

                  {/* COLLAPSIBLE HOW-TO GUIDE */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setShowMqttGuide(!showMqttGuide)}
                      className="w-full flex items-center justify-between p-4 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-zinc-500" />
                        <span>วิธีการเชื่อมต่อและใช้งาน MQTT Broker</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-normal">
                        {showMqttGuide ? 'ซ่อนคู่มือ' : 'กดดูวิธีการ'}
                        {showMqttGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    {showMqttGuide && (
                      <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3 text-xs bg-zinc-50/50 dark:bg-zinc-900/30">
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">1. การเชื่อมต่อจากบอร์ดไมโครคอนโทรลเลอร์ (ESP32 / ESP8266):</div>
                          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            ตั้งค่า Host เป็น <code className="font-mono text-zinc-800 dark:text-zinc-200">mqtt.pichyy.qzz.io</code> พอร์ต 1883 (TCP ปกติ) หรือ 8084 (TLS) โดยใส่ Username เป็นรหัสนักศึกษา และ Password ตามที่ได้รับในระบบ
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">2. การเชื่อมต่อจากเว็บแอปพลิเคชัน (React / Vue / HTML):</div>
                          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            เชื่อมต่อไปยัง Secure WebSocket: <code className="font-mono text-zinc-800 dark:text-zinc-200">wss://mqtt.pichyy.qzz.io/mqtt</code> ด้วยไลบรารี <code>mqtt.js</code> หรือ <code>paho-mqtt</code>
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">3. โครงสร้าง Topic ที่แนะนำ:</div>
                          <ul className="list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
                            <li>ส่งค่าเซนเซอร์: <code className="font-mono text-zinc-800 dark:text-zinc-200">project/{session.studentId}/sensor</code></li>
                            <li>ส่งคำสั่งควบคุมบอร์ด: <code className="font-mono text-zinc-800 dark:text-zinc-200">project/{session.studentId}/control</code></li>
                            <li>สถานะการทำงานบอร์ด: <code className="font-mono text-zinc-800 dark:text-zinc-200">project/{session.studentId}/status</code></li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Specs */}
                  <div id="sec-mqtt-specs" className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] overflow-hidden shadow-xs">
                    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      MQTT Specifications
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Protocol</span>
                        <span className="text-zinc-800 dark:text-zinc-200 sm:col-span-2">MQTT v5.0 / v3.1.1 over Secure WebSocket (WSS)</span>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Endpoint</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all break-all">wss://mqtt.pichyy.qzz.io/mqtt</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Allowed Scope</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all break-all">project/{session.studentId}/#</code>
                      </div>
                    </div>
                  </div>

                  {/* MQTT Connection Credentials Card (Student Access) */}
                  <div className="bg-white dark:bg-[#121214] rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white">
                          ข้อมูลบัญชีสำหรับเชื่อมต่อ MQTT Client (บอร์ด IoT / โค้ดโปรเจกต์)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                      {/* Host */}
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-medium block">MQTT Host (Broker)</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono font-semibold text-zinc-900 dark:text-white text-xs select-all">
                            mqtt.pichyy.qzz.io
                          </span>
                          <button
                            type="button"
                            onClick={() => copyMqttText('mqtt.pichyy.qzz.io', 'mqtt_host')}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="คัดลอก Host"
                          >
                            {copiedMqttKey === 'mqtt_host' ? <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Ports */}
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-medium block">พอร์ตเชื่อมต่อ (WSS / TCP)</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono text-zinc-900 dark:text-white text-xs">
                            <strong className="font-semibold text-zinc-900 dark:text-white">443</strong> (WSS) / <strong>1883</strong> (TCP)
                          </span>
                          <button
                            type="button"
                            onClick={() => copyMqttText('443', 'mqtt_port')}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="คัดลอกพอร์ต"
                          >
                            {copiedMqttKey === 'mqtt_port' ? <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Username */}
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-medium block">ชื่อผู้ใช้ (Username)</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono font-semibold text-zinc-900 dark:text-white text-xs select-all">
                            {session?.studentId || '693190900xx'}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyMqttText(session?.studentId || '', 'mqtt_user')}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="คัดลอก Username"
                          >
                            {copiedMqttKey === 'mqtt_user' ? <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Password */}
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 font-medium block">รหัสผ่าน (Password)</span>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`font-mono text-xs select-all ${showMqttPassword ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-400 tracking-widest'}`}>
                            {showMqttPassword ? (session?.token || '••••••••') : '••••••••'}
                          </span>
                          <div className="flex items-center">
                            <button
                              type="button"
                              onClick={() => setShowMqttPassword(!showMqttPassword)}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              title={showMqttPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                            >
                              {showMqttPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyMqttText(session?.token || '', 'mqtt_pass')}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              title="คัดลอกรหัสผ่าน"
                            >
                              {copiedMqttKey === 'mqtt_pass' ? <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Topic bar */}
                    <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 font-medium whitespace-nowrap">หัวข้อประจำตัว (Topic):</span>
                        <code className="font-mono text-xs font-semibold text-zinc-900 dark:text-white select-all break-all">
                          lbtech/{session?.studentId || '693190900xx'}/telemetry
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyMqttText(`lbtech/${session?.studentId || '693190900xx'}/telemetry`, 'mqtt_topic')}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shrink-0 self-end sm:self-auto cursor-pointer"
                      >
                        {copiedMqttKey === 'mqtt_topic' ? (
                          <>
                            <Check className="h-3 w-3 text-zinc-900 dark:text-zinc-100" />
                            <span className="text-zinc-900 dark:text-zinc-100 font-medium">คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>คัดลอก Topic</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Live In-Browser Tester (Clean Neutral Console) */}
                  <div id="sec-mqtt-console" className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-zinc-700 dark:text-zinc-300 shrink-0" />
                        <h2 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">เครื่องมือทดสอบการเชื่อมต่อสด (Live Test Console)</h2>
                      </div>
                      <Button
                        size="sm"
                        variant={mqttStatus === 'connected' ? 'outline' : 'default'}
                        onClick={toggleMqttTest}
                        className="text-xs h-8 w-full sm:w-auto"
                      >
                        <Activity className="h-3 w-3 mr-1.5" />
                        {mqttStatus === 'connected'
                          ? 'ตัดการเชื่อมต่อ'
                          : mqttStatus === 'connecting'
                          ? 'กำลังเชื่อม...'
                          : 'เชื่อมต่อทดสอบ (Connect)'}
                      </Button>
                    </div>

                    {mqttStatus === 'connected' ? (
                      <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="space-y-2">
                          <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-800">
                            <span className="px-2.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono border-r border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-850 shrink-0 select-none">
                              project/{session.studentId}/
                            </span>
                            <input
                              type="text"
                              className="px-2 py-1.5 text-xs font-mono w-full bg-transparent outline-none text-zinc-900 dark:text-zinc-100"
                              value={testTopicSuffix}
                              onChange={(e) => setTestTopicSuffix(e.target.value)}
                              placeholder="sensor"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              type="text"
                              className="h-8 text-xs font-mono flex-1"
                              value={testPayload}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTestPayload(e.target.value)}
                              placeholder='{"temperature": 28.4, "humidity": 65, "status": "ON"}'
                            />
                            <Button size="sm" onClick={handlePublishTest} className="h-8 text-xs shrink-0 w-full sm:w-auto">
                              <Send className="h-3 w-3 mr-1.5" />
                              ส่งข้อมูล
                            </Button>
                          </div>
                        </div>

                        {/* Subtle Neutral Terminal Header & Body */}
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-100/90 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">เชื่อมต่อ WSS สำเร็จ:</span>
                              <span className="font-mono text-zinc-500 dark:text-zinc-400">project/{session.studentId}/#</span>
                            </div>
                            {messages.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setMessages([])}
                                className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                              >
                                ล้างหน้าจอ
                              </button>
                            )}
                          </div>
                          <div className="p-3 bg-zinc-50 dark:bg-[#0c0c0e] text-zinc-800 dark:text-zinc-200 font-mono text-[11px] min-h-[90px] max-h-[220px] overflow-y-auto space-y-1.5 transition-colors">
                            {messages.length === 0 ? (
                              <div className="text-zinc-400 dark:text-zinc-500 italic text-center py-6">
                                ยังไม่มีข้อความเข้า... กดปุ่ม "ส่งข้อมูล" ด้านบน หรือลองต่อบอร์ดส่งค่าเข้ามา
                              </div>
                            ) : (
                              messages.map((m, idx) => (
                                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                                  <span className="text-zinc-400 dark:text-zinc-500 shrink-0 text-[10px]">[{m.time}]</span>
                                  <span className="text-zinc-900 dark:text-zinc-100 font-semibold shrink-0">{m.topic}:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200 break-all">{m.payload}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          กดปุ่ม <strong>"เชื่อมต่อทดสอบ (Connect)"</strong> เพื่อเปิด WebSocket ทดสอบส่งข้อมูลสดและดูผลลัพธ์ผ่านบราวเซอร์ได้ทันที
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: DATABASE SERVER (INFLUXDB) */}
              {activeTab === 'database' && (
                <div className="space-y-6">
                  <div id="sec-db-title" className="flex items-center gap-3.5">
                    <InfluxDBLogo className="h-8 w-8 shrink-0" />
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        Database Server (InfluxDB v2 Time-Series)
                      </h1>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        ฐานข้อมูลที่ถูกปรับแต่งสำหรับจัดเก็บข้อมูลเซนเซอร์ที่มี Timestamp ย้อนหลังโดยเฉพาะ
                      </p>
                    </div>
                  </div>

                  {/* NOTE CALLOUT */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-start gap-3">
                    <HelpCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">ข้อควรทราบเกี่ยวกับระบบ InfluxDB</div>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        ข้อมูลเซนเซอร์จะถูกแยกเก็บใน Bucket เฉพาะของกลุ่มคุณ โดยมี Organization คือ <code className="font-mono text-zinc-800 dark:text-zinc-200">lbtech</code> และ Bucket คือ <code className="font-mono text-zinc-800 dark:text-zinc-200">bucket_{session.studentId}</code> ต้องแนบ Influx API Token ใน Header ทุกครั้งที่เขียนหรืออ่านข้อมูล
                      </p>
                    </div>
                  </div>

                  {/* COLLAPSIBLE HOW-TO GUIDE */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setShowDbGuide(!showDbGuide)}
                      className="w-full flex items-center justify-between p-4 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-zinc-500" />
                        <span>วิธีการบันทึกและเขียนคิวรีข้อมูล InfluxDB</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-normal">
                        {showDbGuide ? 'ซ่อนคู่มือ' : 'กดดูวิธีการ'}
                        {showDbGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    {showDbGuide && (
                      <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3 text-xs bg-zinc-50/50 dark:bg-zinc-900/30">
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">1. การบันทึกข้อมูล (Write Data):</div>
                          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            สามารถบันทึกผ่าน HTTP POST ไปที่ <code className="font-mono text-zinc-800 dark:text-zinc-200">https://influx.pichyy.qzz.io/api/v2/write?org=lbtech&bucket=bucket_{session.studentId}</code> โดยส่งข้อมูลในรูปแบบ Line Protocol
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">2. ตัวอย่างรูปแบบ Line Protocol:</div>
                          <pre className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] text-zinc-800 dark:text-zinc-300 overflow-x-auto">
sensor,device=esp32_01 temperature=26.4,humidity=62.1
                          </pre>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">3. ตัวอย่างคำสั่ง Flux Query ดึงข้อมูลย้อนหลัง 1 ชั่วโมง:</div>
                          <pre className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] text-zinc-800 dark:text-zinc-300 overflow-x-auto">
{`from(bucket: "bucket_${session.studentId}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sensor")
  |> yield(name: "mean")`}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* DB Specs Table */}
                  <div id="sec-db-specs" className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] overflow-hidden shadow-xs">
                    <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      InfluxDB Configuration
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Database Host</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all break-all">https://influx.pichyy.qzz.io</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Organization (Org)</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all">lbtech</code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Student Bucket</span>
                        <code className="font-mono text-zinc-900 dark:text-zinc-100 sm:col-span-2 select-all font-semibold">
                          {session?.influxBucket || `telemetry-${session?.studentId || 'std'}`}
                        </code>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Data Retention</span>
                        <span className="text-zinc-800 dark:text-zinc-200 sm:col-span-2">30 วัน (ระบบลบข้อมูลเก่าทิ้งอัตโนมัติ)</span>
                      </div>
                      <div className="flex flex-col sm:grid sm:grid-cols-3 p-3 sm:p-3.5 gap-1 sm:gap-2 items-start sm:items-center">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">API Token (Line Protocol)</span>
                        <div className="sm:col-span-2 flex items-center gap-2">
                          <code className="font-mono text-zinc-900 dark:text-zinc-100 select-all break-all text-[11px]">
                            {session?.influxToken || `lbtech_${session?.studentId || 'token'}`}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyDbText(session?.influxToken || `lbtech_${session?.studentId || 'token'}`, 'token_db')}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            title="คัดลอก Token"
                          >
                            {copiedDbKey === 'token_db' ? (
                              <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* InfluxDB Admin UI Callout with Student Login Credentials */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] p-4 sm:p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <InfluxDBLogo className="h-8 w-8 shrink-0" />
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                            InfluxDB v2 Management UI & Data Explorer
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            หน้าเว็บค้นหาข้อมูล Time-Series สร้างแดชบอร์ดกราฟเส้น และใช้เครื่องมือ Query Flux Builder
                          </p>
                        </div>
                      </div>
                      <a
                        href="https://influx.pichyy.qzz.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold shadow-2xs transition-all shrink-0 cursor-pointer"
                      >
                        <span>เปิดเว็บ InfluxDB</span>
                        <ChevronRight className="h-4 w-4" />
                      </a>
                    </div>

                    {/* Student Web UI Login Credentials Card */}
                    <div className="bg-zinc-50/50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                        <Key className="h-4 w-4 text-zinc-400" />
                        <span>ข้อมูลบัญชีสำหรับเข้าสู่ระบบหน้าเว็บ InfluxDB (User Login Credentials)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                        {/* Username */}
                        <div className="p-3 rounded-lg bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                          <span className="text-[10px] text-zinc-400 font-medium block">ชื่อผู้ใช้ (Username)</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono font-semibold text-zinc-900 dark:text-white text-xs select-all">
                              {session?.studentId || '693190900xx'}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyDbText(session?.studentId || '', 'db_user')}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              title="คัดลอก Username"
                            >
                              {copiedDbKey === 'db_user' ? (
                                <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Password */}
                        <div className="p-3 rounded-lg bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                          <span className="text-[10px] text-zinc-400 font-medium block">รหัสผ่าน (Password)</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`font-mono text-xs select-all ${showDbPassword ? 'font-semibold text-zinc-900 dark:text-white' : 'text-zinc-400 tracking-widest'}`}>
                              {showDbPassword ? (session?.token || '••••••••') : '••••••••'}
                            </span>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => setShowDbPassword(!showDbPassword)}
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                title={showDbPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                              >
                                {showDbPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyDbText(session?.token || '', 'db_pass')}
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                title="คัดลอกรหัสผ่าน"
                              >
                                {copiedDbKey === 'db_pass' ? (
                                  <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Organization */}
                        <div className="p-3 rounded-lg bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                          <span className="text-[10px] text-zinc-400 font-medium block">องค์กร (Organization)</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono font-semibold text-zinc-900 dark:text-white text-xs select-all truncate max-w-[120px]">
                              {session?.influxOrg || 'lbtech'}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyDbText(session?.influxOrg || 'lbtech', 'db_org')}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              title="คัดลอก Organization"
                            >
                              {copiedDbKey === 'db_org' ? (
                                <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Bucket */}
                        <div className="p-3 rounded-lg bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-750">
                          <span className="text-[10px] text-zinc-400 font-medium block">ถังข้อมูลประจำตัว (Bucket)</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono font-semibold text-zinc-900 dark:text-white text-xs select-all truncate max-w-[120px]">
                              {session?.influxBucket || 'telemetry'}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyDbText(session?.influxBucket || 'telemetry', 'db_bucket')}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              title="คัดลอก Bucket"
                            >
                              {copiedDbKey === 'db_bucket' ? (
                                <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Code for InfluxDB Write */}
                  <div id="sec-db-curl" className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">ตัวอย่างคำสั่งเขียนข้อมูล (Line Protocol via cURL)</h3>
                    <CodeViewer
                      code={influxLineProtocolCode}
                      language="shell"
                      title="InfluxDB Write Query"
                      theme={resolvedTheme}
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: REST API */}
              {activeTab === 'rest-api' && (
                <div className="space-y-6">
                  <div id="sec-api-title">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      REST API & Webhooks
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      ช่องทาง HTTP POST สำหรับไมโครคอนโทรลเลอร์หรือแอปพลิเคชันที่ต้องการส่งค่าโดยไม่ต่อค้าง MQTT
                    </p>
                  </div>

                  {/* NOTE CALLOUT */}
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs flex items-start gap-3">
                    <HelpCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">ข้อควรทราบเกี่ยวกับระบบ REST API</div>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        เหมาะสำหรับอุปกรณ์ประหยัดพลังงาน (Deep Sleep) ที่ตื่นขึ้นมาส่งข้อมูลเป็นรอบๆ แล้วดับไป การส่งทุกครั้งต้องระบุ Header <code className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-zinc-800 dark:text-zinc-200">Authorization: Bearer {session.token.slice(0, 10)}...</code> เพื่อยืนยันตัวตน
                      </p>
                    </div>
                  </div>

                  {/* COLLAPSIBLE HOW-TO GUIDE */}
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#121214] overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setShowApiGuide(!showApiGuide)}
                      className="w-full flex items-center justify-between p-4 text-xs font-semibold text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-zinc-500" />
                        <span>วิธีการส่งคำขอ HTTP POST (API Guide)</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-normal">
                        {showApiGuide ? 'ซ่อนคู่มือ' : 'กดดูวิธีการ'}
                        {showApiGuide ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </button>

                    {showApiGuide && (
                      <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3 text-xs bg-zinc-50/50 dark:bg-zinc-900/30">
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">1. Endpoint URL สำหรับส่งข้อมูล (Telemetry):</div>
                          <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-900 dark:text-white block">
                            POST https://iot.pichyy.qzz.io/api/telemetry
                          </code>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">2. HTTP Headers ที่จำเป็น:</div>
                          <pre className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] text-zinc-800 dark:text-zinc-300 overflow-x-auto">
{`Content-Type: application/json
Authorization: Bearer ${session.token}`}
                          </pre>
                        </div>
                        <div className="space-y-1.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">3. ตัวอย่างคำสั่ง cURL:</div>
                          <pre className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] text-zinc-800 dark:text-zinc-300 overflow-x-auto">
{`curl -X POST https://iot.pichyy.qzz.io/api/telemetry \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${session.token}" \\
  -d '{"deviceId": "esp32_01", "data": {"temp": 28.5, "humidity": 65}}'`}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>

                  <div id="sec-api-specs" className="space-y-2">
                    <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">HTTP Specification</h3>
                    <CodeViewer
                      code={restApiCode}
                      language="shell"
                      title="HTTP POST Telemetry Specification"
                      theme={resolvedTheme}
                    />
                  </div>
                </div>
              )}

              {/* TAB 5: ESP32 ARDUINO */}
              {activeTab === 'esp32' && (
                <div className="space-y-4">
                  <div id="sec-esp32-title">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      โค้ดตัวอย่าง: ESP32 (Arduino IDE)
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      ใช้ไลบรารี <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-zinc-900 dark:text-zinc-200">WebSockets</code> โดย Markus Sattler ผ่าน WSS พอร์ต 443
                    </p>
                  </div>
                  <div id="sec-esp32-code">
                    <CodeViewer
                      code={esp32Code}
                      language="cpp"
                      title="ESP32_WebSocket_MQTT.ino"
                      theme={resolvedTheme}
                    />
                  </div>
                </div>
              )}

              {/* TAB 6: ESP8266 */}
              {activeTab === 'esp8266' && (
                <div className="space-y-4">
                  <div id="sec-esp8266-title">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      โค้ดตัวอย่าง: ESP8266 (NodeMCU / D1 Mini)
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      ปรับจูนการใช้ Memory และ Buffer ให้ทำงานได้เสถียรบน RAM ขนาดเล็ก
                    </p>
                  </div>
                  <div id="sec-esp8266-code">
                    <CodeViewer
                      code={esp8266Code}
                      language="cpp"
                      title="ESP8266_WebSocket_MQTT.ino"
                      theme={resolvedTheme}
                    />
                  </div>
                </div>
              )}

              {/* TAB 7: WEB JAVASCRIPT */}
              {activeTab === 'web-js' && (
                <div className="space-y-4">
                  <div id="sec-web-title">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      โค้ดตัวอย่าง: Web Frontend (HTML / JavaScript / MQTT.js)
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      นำไปใส่ในเว็บโครงงานของคุณ เพื่อสั่งงานและแสดงผลแบบ Real-time
                    </p>
                  </div>
                  <div id="sec-web-code">
                    <CodeViewer
                      code={webJsCode}
                      language="html"
                      title="index.html"
                      theme={resolvedTheme}
                    />
                  </div>
                </div>
              )}

              {/* TAB 8: PYTHON */}
              {activeTab === 'python' && (
                <div className="space-y-4">
                  <div id="sec-python-title">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      โค้ดตัวอย่าง: Python / Raspberry Pi
                    </h1>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      สำหรับโปรเจกต์ที่ประมวลผลด้วย Python บนคอมพิวเตอร์ หรือ Raspberry Pi
                    </p>
                  </div>
                  <div id="sec-python-code">
                    <CodeViewer
                      code={pythonCode}
                      language="python"
                      title="iot_client.py"
                      theme={resolvedTheme}
                    />
                  </div>
                </div>
              )}
            </main>

            {/* DESKTOP RIGHT SIDEBAR: "ON THIS PAGE" (TABLE OF CONTENTS) */}
            <aside className="hidden xl:block w-64 shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] p-6 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto transition-colors">
              <div className="space-y-4">
                <div className="text-xs font-semibold text-zinc-900 dark:text-white tracking-wider uppercase flex items-center gap-1.5">
                  <Bookmark className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>ในหน้านี้ (On this page)</span>
                </div>
                <nav className="space-y-1 text-xs">
                  {tocItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(item.id)
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }}
                      className="w-full text-left py-1.5 px-2.5 rounded-md text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-xs truncate block"
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>

                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    โครงงานของคุณ
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-lg border border-zinc-100 dark:border-zinc-800 space-y-1.5 text-xs">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{session.projectTitle}</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{session.fullName}</div>
                    <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate">ID: {session.studentId}</div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* SEARCH COMMAND PALETTE MODAL */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-12 sm:pt-20 p-3 sm:p-4">
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="พิมพ์เพื่อค้นหาหัวข้อ ระบบ หรือโค้ดตัวอย่าง..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 bg-transparent"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-72 sm:max-h-80 overflow-y-auto p-2">
              {filteredSearch.length === 0 ? (
                <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-8">
                  ไม่พบข้อมูลที่ค้นหา "{searchQuery}"
                </div>
              ) : (
                filteredSearch.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSearchResult(item.tab, item.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex flex-col gap-0.5 group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white">
                      <span>{item.title}</span>
                      <ChevronRight className="h-3 w-3 text-zinc-400" />
                    </div>
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-500 dark:group-hover:text-zinc-400">
                      {item.desc}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
              <span>กด <kbd className="font-mono bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1 rounded">ESC</kbd> เพื่อปิด</span>
              <span>เลือกเพื่อกระโดดไปยังเนื้อหาทันที</span>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">ตั้งค่าโปรไฟล์และรหัสผ่าน</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {settingsError && (
                <div className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 font-medium">
                  {settingsError}
                </div>
              )}

              {settingsSaved && (
                <div className="p-3 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-700 font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                  <span>บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว</span>
                </div>
              )}

              {/* Theme Preference Setting inside Modal */}
              <div>
                <Label>ธีมแสดงผล (Theme)</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      themeMode === 'light'
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    <span>สว่าง</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      themeMode === 'dark'
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <Moon className="h-3.5 w-3.5" />
                    <span>มืด</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setThemeMode('system')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      themeMode === 'system'
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span>ตามระบบ</span>
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="sId">รหัสนักศึกษา (Topic Identity)</Label>
                <Input
                  id="sId"
                  disabled
                  value={session?.studentId || ''}
                  className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed font-mono text-xs"
                />
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                  รหัสนักศึกษาใช้เป็น Identity สำหรับสิทธิ์ Topic ACL ประจำกลุ่ม (ไม่สามารถเปลี่ยนได้)
                </span>
              </div>

              <div>
                <Label htmlFor="setFullName">ชื่อ-นามสกุล / รายชื่อสมาชิก</Label>
                <Input
                  id="setFullName"
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="ชื่อผู้จัดทำหรือสมาชิก"
                />
              </div>

              <div>
                <Label htmlFor="setProjectTitle">ชื่อโครงงาน</Label>
                <Input
                  id="setProjectTitle"
                  type="text"
                  value={editProjectTitle}
                  onChange={(e) => setEditProjectTitle(e.target.value)}
                  placeholder="เช่น Smart Farm IoT"
                />
              </div>

              <div>
                <Label htmlFor="setDepartment">แผนกวิชา</Label>
                <Input
                  id="setDepartment"
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  placeholder="เช่น เทคโนโลยีคอมพิวเตอร์"
                />
              </div>

              <div>
                <Label htmlFor="setPassword">รหัสผ่านใหม่ (Password สำหรับเชื่อมต่อ)</Label>
                <div className="relative">
                  <Input
                    id="setPassword"
                    type={showEditPassword ? 'text' : 'password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer p-1"
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 block">
                  รหัสนี้จะถูกใช้เป็น Password ของ MQTT Broker และรหัส SSH สำหรับเครื่องเซิร์ฟเวอร์
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-xs h-9 cursor-pointer"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs h-9 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
                >
                  บันทึกข้อมูล
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TERMS OF SERVICE MODAL (9 FULL OFFICIAL ARTICLES) */}
      {isTermsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-3xl overflow-hidden max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white leading-tight">
                    ข้อกำหนดและเงื่อนไขการใช้งานเครื่องคอมพิวเตอร์แม่ข่าย
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Server Terms of Service — แผนกเทคโนโลยีคอมพิวเตอร์ วิทยาลัยเทคนิคลำปาง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Terms Content */}
            <div className="p-6 space-y-6 overflow-y-auto text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans">
              {/* Critical Warning Alert */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-300 text-xs flex items-start gap-3 shadow-2xs">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-950 dark:text-amber-200">คำชี้แจงสำคัญก่อนการใช้งาน</div>
                  <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-300/90">
                    กรุณาอ่านและทำความเข้าใจข้อกำหนดและเงื่อนไขฉบับนี้อย่างละเอียดก่อนเริ่มใช้งานเครื่องคอมพิวเตอร์แม่ข่ายเสมือน (LXC Container / Virtual Machine) การเข้าใช้งานระบบถือว่านักศึกษาและสมาชิกในกลุ่มโครงงานทุกคนได้รับทราบและตกลงที่จะปฏิบัติตามข้อกำหนดนี้ทุกประการ หากพบการฝ่าฝืนไม่ว่าโดยเจตนาหรือประมาทเลินเล่อ ผู้ดูแลระบบมีสิทธิ์ระงับการทำงานของเครื่องทันที ลบข้อมูลโดยไม่แจ้งให้ทราบล่วงหน้า ตัดสิทธิ์การใช้งานของกลุ่มโครงงานอย่างถาวร และส่งเรื่องพิจารณาโทษทางวินัยนักศึกษาหรือผลการศึกษาในรายวิชาที่เกี่ยวข้อง
                  </p>
                </div>
              </div>

              {/* 9 Articles Container */}
              <div className="space-y-6 divide-y divide-zinc-200/80 dark:divide-zinc-800">
                {/* ข้อ 1 */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 1
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      ขอบเขตและวัตถุประสงค์การใช้งาน (Scope and Purpose of Use)
                    </h3>
                  </div>
                  <div className="space-y-2 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p>
                      <strong>1.1 วัตถุประสงค์ทางการศึกษา:</strong> ทรัพยากรเครื่องแม่ข่ายเสมือน (LXC Container) เครือข่าย และพื้นที่จัดเก็บข้อมูลนี้ จัดสรรขึ้นเพื่อสนับสนุนการเรียนการสอน การพัฒนาโครงงาน (Project) และการวิจัยสำหรับนักศึกษาแผนกเทคโนโลยีคอมพิวเตอร์ วิทยาลัยเทคนิคลำปาง เท่านั้น
                    </p>
                    <p>
                      <strong>1.2 ข้อห้ามเชิงพาณิชย์:</strong> ห้ามนำทรัพยากรของแผนกไปใช้แสวงหาผลประโยชน์เชิงพาณิชย์ รับจ้างพัฒนาระบบให้บุคคลภายนอก เปิดให้บริการเช่าพื้นที่ต่อ (Sub-hosting) หรือรันบริการสาธารณะที่ไม่เกี่ยวข้องกับขอบเขตโครงงานที่ได้รับอนุมัติโดยเด็ดขาด
                    </p>
                    <p>
                      <strong>1.3 สิทธิ์การเข้าถึงเฉพาะกลุ่ม:</strong> บัญชีผู้ใช้งาน รหัสผ่าน และกุญแจเข้ารหัส (SSH Key) เป็นสิทธิ์เฉพาะของสมาชิกในกลุ่มโครงงานและอาจารย์ที่ปรึกษาที่ลงทะเบียนไว้เท่านั้น ห้ามโอนสิทธิ์ แบ่งปัน หรือยินยอมให้บุคคลภายนอกกลุ่มเข้าใช้งานเครื่องเซิร์ฟเวอร์ไม่ว่ากรณีใดๆ
                    </p>
                    <p>
                      <strong>1.4 ความรับผิดชอบร่วม:</strong> สมาชิกทุกคนในกลุ่มโครงงานต้องร่วมกันรับผิดชอบต่อทุกการกระทำที่เกิดขึ้นภายใต้บัญชีและเครื่องเซิร์ฟเวอร์ของกลุ่มตนเอง
                    </p>
                  </div>
                </div>

                {/* ข้อ 2 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 2
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      การกำกับดูแลและการปรึกษาอาจารย์ที่ปรึกษา (Advisor Supervision & Approval)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p>
                      <strong>2.1 การขอความเห็นชอบก่อนดำเนินการสำคัญ:</strong> นักศึกษา <strong>ต้องปรึกษาและได้รับความเห็นชอบจากอาจารย์ที่ปรึกษาโครงงานทุกครั้ง</strong> ก่อนดำเนินการเปลี่ยนแปลงโครงสร้างหรือการตั้งค่าที่มีผลกระทบต่อระบบและความปลอดภัย ได้แก่:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                      <li>การนำระบบขึ้นใช้งานจริง (Production Deployment) หรือการเปิดให้บุคคลภายนอกเข้าใช้งาน</li>
                      <li>การขอเปิดพอร์ตเครือข่ายออกสู่ภายนอก (Port Forwarding / Public Exposure) หรือการผูกโดเมนเนม (Domain Name)</li>
                      <li>การเชื่อมต่อระบบเข้ากับ API ของหน่วยงานภายนอก หรือระบบชำระเงินอิเล็กทรอนิกส์ (Payment Gateway)</li>
                      <li>การปรับเปลี่ยนสถาปัตยกรรมฐานข้อมูล การติดตั้งซอฟต์แวร์เสริมขนาดใหญ่ หรือการใช้เทคโนโลยีคอนเทนเนอร์ซ้อนทับ (เช่น Docker ภายใน LXC)</li>
                      <li>การเริ่มเก็บรวบรวมข้อมูลจริงจากผู้ใช้งานหรือกลุ่มตัวอย่างเพื่อการวิจัยและประเมินผล</li>
                    </ul>
                    <p>
                      <strong>2.2 การรายงานปัญหาและเหตุผิดปกติ:</strong> หากเกิดข้อผิดพลาดร้ายแรงในระบบ ระบบล่ม ข้อมูลสูญหาย หรือพบพฤติกรรมต้องสงสัย นักศึกษาต้องรายงานให้อาจารย์ที่ปรึกษารับทราบทันทีเพื่อร่วมกันหาแนวทางแก้ไขก่อนแจ้งผู้ดูแลระบบ
                    </p>
                    <p>
                      <strong>2.3 สิทธิ์ในการตรวจสอบ (Right to Audit):</strong> อาจารย์ที่ปรึกษาและผู้ดูแลระบบของแผนกมีสิทธิ์เข้าถึง ตรวจสอบโครงสร้างซอร์สโค้ด ฐานข้อมูล ไฟล์การตั้งค่า กระบวนการทำงานของโปรเซส (Running Processes) และประวัติการใช้งาน (System & Network Logs) ของเครื่องเซิร์ฟเวอร์ได้ตลอดเวลาโดยไม่ต้องแจ้งให้ทราบล่วงหน้า เพื่อติดตามความก้าวหน้าและตรวจสอบความมั่นคงปลอดภัย
                    </p>
                    <p>
                      <strong>2.4 การขอปรับเพิ่มทรัพยากร:</strong> หากโครงงานมีความจำเป็นต้องใช้สเปกเครื่อง (CPU, RAM, Storage) เกินกว่าโควตาพื้นฐานที่แผนกจัดสรรให้ นักศึกษาต้องนำเหตุผลและข้อมูลการใช้ทรัพยากรเข้าปรึกษาอาจารย์ที่ปรึกษาเพื่อลงนามรับรองความจำเป็นก่อนยื่นคำร้องต่อผู้ดูแลระบบ
                    </p>
                  </div>
                </div>

                {/* ข้อ 3 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 3
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      การจัดสรรและการใช้งานทรัพยากร (Resource Allocation & Fair Use Policy)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p>
                      <strong>3.1 หลักการใช้งานอย่างเป็นธรรม (Fair Use):</strong> เครื่องเซิร์ฟเวอร์ทำงานอยู่บนสถาปัตยกรรมวิร์ชวลไลเซชันที่ใช้ทรัพยากรฮาร์ดแวร์และเครือข่ายร่วมกัน (Shared Infrastructure) นักศึกษาต้องบริหารจัดการโปรเซสไม่ให้ใช้ CPU, หน่วยความจำ (RAM), การอ่านเขียนดิสก์ (Disk I/O) หรือแบนด์วิดท์เครือข่าย (Network Bandwidth) สูงถึงขีดสุดติดต่อกันเป็นเวลานานจนเกิดสภาวะคอขวดและส่งผลกระทบต่อเครื่องของกลุ่มอื่น
                    </p>
                    <div>
                      <strong className="block mb-1">3.2 การควบคุมโปรเซสและการทำงานเบื้องหลัง:</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>ห้ามเขียนโค้ดหรือรันโปรแกรมที่มีลักษณะการทำงานวนซ้ำไม่รู้จบโดยไม่มีการหน่วงเวลา (Infinite Loop) หรือโปรแกรมที่มีปัญหาหน่วยความจำรั่วไหล (Memory Leak)</li>
                        <li>การตั้งเวลาทำงานอัตโนมัติ (Cronjob / Task Scheduler) หรือ Background Worker ต้องกำหนดความถี่อย่างเหมาะสม ห้ามตั้งให้ทำงานถี่เกินความจำเป็น (เช่น ทุกวินาทีหรือทุกนาทีสำหรับงานประมวลผลหนัก) โดยไม่ได้รับการอนุมัติจากอาจารย์ที่ปรึกษา</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="block mb-1">3.3 การจัดเก็บไฟล์และพื้นที่ดิสก์:</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>พื้นที่จัดเก็บข้อมูลในเครื่องแม่ข่ายมีไว้สำหรับซอร์สโค้ด ฐานข้อมูล และไฟล์สื่อที่จำเป็นต่อการทำงานของโครงงานเท่านั้น</li>
                        <li>ห้ามใช้เครื่องเซิร์ฟเวอร์เป็นพื้นที่ฝากไฟล์ส่วนตัว ไฟล์ภาพยนตร์ เพลง เกม หรือไฟล์ติดตั้งโปรแกรมที่ไม่เกี่ยวข้องกับโครงงาน</li>
                        <li>นักศึกษาต้องตั้งค่าการหมุนเวียนและจำกัดขนาดไฟล์บันทึกประวัติ (Log Rotation) เพื่อป้องกันไม่ให้ไฟล์ Log ขยายตัวจนพื้นที่ดิสก์เต็ม</li>
                      </ul>
                    </div>
                    <p>
                      <strong>3.4 มาตรการระงับฉุกเฉิน (Resource Throttling & Termination):</strong> หากระบบมอนิเตอร์กลางตรวจพบว่าคอนเทนเนอร์ใดใช้ทรัพยากรเกินขีดจำกัดจนเป็นภัยต่อเสถียรภาพของเครื่องแม่ข่ายหลัก (Host Node) ผู้ดูแลระบบมีสิทธิ์จำกัดความเร็ว (Throttling) สั่งฆ่าโปรเซส (Kill Process) หรือสั่งหยุดการทำงานของคอนเทนเนอร์ (Force Stop) ทันทีโดยไม่ต้องแจ้งให้ทราบล่วงหน้า
                    </p>
                  </div>
                </div>

                {/* ข้อ 4 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 4
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      การทดสอบระบบและการจำลองโหลด (System Testing & Load Simulation)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p>
                      <strong>4.1 ข้อห้ามด้านการทดสอบเจาะระบบโดยพลการ:</strong> ห้ามใช้เครื่องมือสแกนพอร์ต สแกนช่องโหว่ (Vulnerability Scanner เช่น Nmap, Nessus, OpenVAS, Nikto, SQLMap) หรือทดลองโจมตีเจาะระบบ (Penetration Testing / Exploit) ไปยังเครื่องเซิร์ฟเวอร์ของตนเอง เครื่องของกลุ่มอื่น หรืออุปกรณ์เครือข่ายของแผนกและวิทยาลัยโดยเด็ดขาด
                    </p>
                    <p>
                      <strong>4.2 ขั้นตอนขออนุญาตสำหรับโครงงานด้าน Cybersecurity:</strong> หากโครงงานมีวัตถุประสงค์เกี่ยวกับการวิเคราะห์ความปลอดภัยหรือการทดสอบเจาะระบบ นักศึกษา <strong>ต้องปรึกษาอาจารย์ที่ปรึกษาและทำเรื่องขออนุญาตต่อผู้ดูแลระบบเป็นลายลักษณ์อักษรล่วงหน้า</strong> เพื่อกำหนดวันเวลา เป้าหมายที่ชัดเจน และต้องดำเนินการภายในสภาพแวดล้อมเครือข่ายปิด (Isolated Sandbox / VLAN แยกเฉพาะ) ที่ผู้ดูแลระบบจัดเตรียมให้เท่านั้น
                    </p>
                    <div>
                      <strong className="block mb-1">4.3 การควบคุมการทดสอบรับภาระงาน (Load / Stress Testing):</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>ห้ามใช้เครื่องมือยิงทราฟฟิกจำลองจำนวนมาก (เช่น Apache JMeter, k6, Locust, wrk หรือ ab) ยิงเข้าสู่เซิร์ฟเวอร์ผ่านเครือข่ายหลักหรือผ่านอินเทอร์เน็ตภายนอกโดยไม่แจ้งล่วงหน้า เนื่องจากทราฟฟิกดังกล่าวจะมีลักษณะคล้ายการโจมตีแบบ DoS/DDoS ซึ่งจะทำให้ระบบป้องกันเครือข่าย (Firewall / IPS) บล็อกการเชื่อมต่อและทำให้เครือข่ายของแผนกล่ม</li>
                        <li>การทำ Load Test ต้องปรึกษาอาจารย์ที่ปรึกษาเพื่อกำหนดปริมาณคำร้องขอ (Concurrent Users / Requests per second) ที่สมเหตุสมผล และต้องได้รับอนุญาตเวลาทดสอบจากผู้ดูแลระบบก่อนดำเนินการทุกครั้ง</li>
                      </ul>
                    </div>
                    <p>
                      <strong>4.4 การใช้ข้อมูลสำหรับการทดสอบ:</strong> ในระหว่างการพัฒนาและทดสอบระบบ นักศึกษาต้องใช้ข้อมูลจำลองที่สร้างขึ้น (Synthetic / Mock / Dummy Data) เท่านั้น ห้ามนำข้อมูลจริงของบุคคลหรือข้อมูลภายในของสถานศึกษามาใช้ในสภาพแวดล้อมการทดสอบที่ยังไม่มีมาตรการป้องกันที่สมบูรณ์
                    </p>
                  </div>
                </div>

                {/* ข้อ 5 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 5
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      ความมั่นคงปลอดภัยของระบบ (System & Application Security)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <div>
                      <strong className="block mb-1">5.1 การพิสูจน์ตัวตนและการจัดการรหัสผ่าน:</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>นักศึกษาต้องเปลี่ยนรหัสผ่านเริ่มต้น (Default Password) ทันทีที่ได้รับมอบเครื่อง โดยต้องตั้งรหัสผ่านที่มีความซับซ้อน (ความยาวไม่ต่ำกว่า 12 ตัวอักษร ประกอบด้วยตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก ตัวเลข และอักขระพิเศษ) หรือตั้งค่าให้เข้าถึงผ่าน SSH Key-based Authentication เท่านั้น</li>
                        <li>ห้ามใช้รหัสผ่านที่คาดเดาง่าย เช่น รหัสนักศึกษา วันเดือนปีเกิด ชื่อเล่น หรือคำศัพท์ทั่วไป (เช่น <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">123456</code>, <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">admin</code>, <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">password</code>, <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">root</code>)</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="block mb-1">5.2 การเก็บรักษาความลับของข้อมูลเชื่อมต่อ (Secret Management):</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>ห้ามฝังรหัสผ่านเซิร์ฟเวอร์ รหัสผ่านฐานข้อมูล หรือ API Keys ลงในซอร์สโค้ดโดยตรง (Hardcoded Credentials)</li>
                        <li>ต้องแยกข้อมูลสำคัญไว้ในไฟล์ตัวแปรสภาพแวดล้อม (เช่น <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">.env</code>) และต้องตั้งค่าไฟล์ <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">.gitignore</code> เพื่อป้องกันไม่ให้ไฟล์ความลับถูกอัปโหลดขึ้นสู่ระบบจัดการเวอร์ชันสาธารณะ (เช่น GitHub, GitLab สาธารณะ) หากตรวจพบการหลุดรั่วของรหัสผ่านบนพื้นที่สาธารณะ เครื่องจะถูกระงับการใช้งานทันที</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="block mb-1">5.3 ความปลอดภัยของฐานข้อมูลและพอร์ตบริการ:</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>ห้ามเปิดพอร์ตระบบจัดการฐานข้อมูล (เช่น MySQL/MariaDB พอร์ต 3306, PostgreSQL พอร์ต 5432, MongoDB พอร์ต 27017, Redis พอร์ต 6379) ให้เข้าถึงได้จากทุกไอพี (<code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">0.0.0.0/0</code>) โดยเด็ดขาด ให้จำกัดการเชื่อมต่อเฉพาะภายในเครื่อง (<code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">127.0.0.1</code> / <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">localhost</code>) หรือไอพีที่ระบุเฉพาะเท่านั้น</li>
                        <li>ต้องสร้างบัญชีผู้ใช้ฐานข้อมูลแยกเฉพาะสำหรับแอปพลิเคชันตามหลักสิทธิ์เท่าที่จำเป็น (Principle of Least Privilege) ห้ามนำบัญชีสูงสุด (เช่น <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">root</code> หรือ <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">postgres</code>) ไปผูกใช้งานในโค้ดเว็บหรือแอปพลิเคชันโดยตรง</li>
                        <li>ห้ามติดตั้งและเปิดทิ้งเครื่องมือจัดการฐานข้อมูลผ่านเว็บ (เช่น phpMyAdmin, Adminer, pgAdmin) ออกสู่สาธารณะโดยไม่มีการตั้งรหัสผ่านชั้นที่สองหรือการจำกัดสิทธิ์การเข้าถึง</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="block mb-1">5.4 การป้องกันช่องโหว่และการอัปเดตระบบ:</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>นักศึกษาต้องหมั่นอัปเดตแพ็กเกจของระบบปฏิบัติการ (OS Security Patches) และไลบรารีของภาษาโปรแกรมที่ใช้พัฒนาโครงงานอย่างสม่ำเสมอ เพื่อปิดช่องโหว่ความปลอดภัย</li>
                        <li>ต้องตรวจสอบและเขียนโค้ดป้องกันช่องโหว่พื้นฐาน เช่น SQL Injection, Cross-Site Scripting (XSS) และการอัปโหลดไฟล์อันตราย (Unrestricted File Upload / Web Shell)</li>
                      </ul>
                    </div>
                    <p>
                      <strong>5.5 การแจ้งเหตุละเมิดความปลอดภัย (Incident Reporting):</strong> หากนักศึกษาพบความผิดปกติ เช่น มีไฟล์แปลกปลอมเกิดขึ้น CPU ทำงาน 100% โดยไม่ทราบสาเหตุ มีการล็อกอินจากไอพีที่ไม่รู้จัก หรือสงสัยว่าเครื่องถูกผู้ไม่ประสงค์ดีเจาะระบบ (Compromised) <strong>ต้องแจ้งอาจารย์ที่ปรึกษาและผู้ดูแลระบบทราบทันที</strong> ห้ามปกปิดหรือพยายามลบหลักฐานในไฟล์ Log โดยเด็ดขาด
                    </p>
                  </div>
                </div>

                {/* ข้อ 6 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 6
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      ข้อห้ามและการปฏิบัติตามกฎหมาย (Legal Compliance & Prohibited Activities)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-700 dark:text-zinc-200 font-medium">
                      นักศึกษาต้องใช้งานเครื่องเซิร์ฟเวอร์ภายใต้ <strong>พระราชบัญญัติว่าด้วยการกระทำความผิดเกี่ยวกับคอมพิวเตอร์ (พ.ร.บ. คอมพิวเตอร์ฯ)</strong> กฎหมายลิขสิทธิ์ และกฎหมายอื่นที่เกี่ยวข้องอย่างเคร่งครัด หากเกิดการกระทำความผิดทางกฎหมาย นักศึกษาผู้รับผิดชอบเครื่องต้องรับผิดชอบทั้งทางแพ่งและทางอาญาแต่เพียงผู้เดียว โดยมีข้อห้ามเด็ดขาดดังต่อไปนี้:
                    </p>
                    <p>
                      <strong>6.1 ห้ามขุดคริปโตเคอร์เรนซี:</strong> ห้ามติดตั้งหรือรันซอฟต์แวร์ขุดเหรียญคริปโตเคอร์เรนซี (Cryptocurrency Mining) สคริปต์ขุดเหรียญผ่านเว็บ หรือการประมวลผลบล็อกเชนเพื่อหาผลประโยชน์ทุกชนิด
                    </p>
                    <p>
                      <strong>6.2 ห้ามใช้เป็นฐานโจมตีทางไซเบอร์:</strong> ห้ามใช้เครื่องแม่ข่ายในการสแกนเครือข่าย โจมตีระบบอื่น (DoS/DDoS, Brute-Force, Exploitation) ติดตั้งระบบควบคุมมัลแวร์ (Command & Control - C2 Server) รันบอตเน็ต (Botnet) หรือปล่อยไวรัสและแรนซัมแวร์
                    </p>
                    <p>
                      <strong>6.3 ห้ามหลีกเลี่ยงระบบรักษาความปลอดภัยเครือข่าย:</strong> ห้ามติดตั้งและเปิดให้บริการ VPN Server, Open Proxy, Tor Node, Reverse Shell หรือโปรแกรมทำ Network Tunneling ที่ไม่ได้รับอนุญาต เพื่อใช้หลบเลี่ยงไฟร์วอลล์ของสถานศึกษา หรือปกปิดร่องรอยการใช้งานอินเทอร์เน็ต
                    </p>
                    <div>
                      <strong className="block mb-1">6.4 ห้ามเผยแพร่เนื้อหาผิดกฎหมายและละเมิดลิขสิทธิ์:</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>ห้ามใช้เครื่องเพื่อส่งอีเมลขยะหรือข้อความรบกวน (Spamming / Mass Mailing)</li>
                        <li>ห้ามสร้างหรือโฮสต์เว็บไซต์ปลอมแปลงเพื่อหลอกลวงข้อมูล (Phishing Site)</li>
                        <li>ห้ามติดตั้ง จัดเก็บ หรือเผยแพร่ซอฟต์แวร์เถื่อน แคร็ก (Crack/Keygen) ไฟล์ละเมิดลิขสิทธิ์ การแชร์ไฟล์แบบ Peer-to-Peer (BitTorrent) เว็บไซต์พนันออนไลน์ หรือสื่อลามกอนาจารทุกประเภท</li>
                      </ul>
                    </div>
                    <p>
                      <strong>6.5 การจัดเก็บประวัติจราจรทางคอมพิวเตอร์:</strong> ห้ามนักศึกษาลบ ดัดแปลง หรือปิดการทำงานของระบบบันทึกข้อมูลจราจรทางคอมพิวเตอร์ (System & Access Logs) เพื่อให้เป็นไปตามข้อกำหนดของ พ.ร.บ. คอมพิวเตอร์ฯ
                    </p>
                  </div>
                </div>

                {/* ข้อ 7 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 7
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      การคุ้มครองข้อมูลส่วนบุคคล (PDPA Compliance)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-700 dark:text-zinc-200 font-medium">
                      หากโครงงานของนักศึกษามีการเก็บรวบรวม ใช้ หรือเปิดเผย "ข้อมูลส่วนบุคคล" ของบุคคลที่มีชีวิตอยู่ (เช่น ชื่อ-นามสกุล เลขประจำตัวประชาชน รหัสนักศึกษา เบอร์โทรศัพท์ อีเมล ที่อยู่ ภาพถ่ายใบหน้า ข้อมูลสุขภาพ หรือพิกัดตำแหน่ง) นักศึกษาต้องปฏิบัติตาม <strong>พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</strong> อย่างเคร่งครัด ดังนี้:
                    </p>
                    <div>
                      <strong className="block mb-1">7.1 การประเมินความจำเป็นและการเก็บข้อมูลเท่าที่จำเป็น (Data Minimization):</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>นักศึกษาต้องปรึกษาอาจารย์ที่ปรึกษาเพื่อวางโครงสร้างตารางฐานข้อมูล โดยให้จัดเก็บเฉพาะข้อมูลที่จำเป็นต่อการทำงานของโครงงานเท่านั้น</li>
                        <li>ห้ามเก็บข้อมูลที่มีความอ่อนไหวสูงหรือเสี่ยงต่อการรั่วไหล (เช่น เลขประจำตัวประชาชน 13 หลัก ข้อมูลบัตรเครดิต หรือข้อมูลชีวมิติ/สแกนใบหน้า) เว้นแต่เป็นแกนหลักของโครงงานที่อาจารย์ที่ปรึกษาอนุมัติเป็นกรณีพิเศษและมีมาตรการเข้ารหัสขั้นสูงรองรับ</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="block mb-1">7.2 การแจ้งวัตถุประสงค์และขอความยินยอม (Privacy Notice & Consent):</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>หากมีการนำระบบไปให้กลุ่มตัวอย่างหรือผู้ใช้งานจริงทดลองใช้ นักศึกษาต้องจัดทำข้อความแจ้งรายละเอียด (Privacy Notice) ที่ระบุชัดเจนว่าเก็บข้อมูลอะไรบ้าง เพื่อวัตถุประสงค์ใด เก็บไว้นานเท่าใด และใครเข้าถึงได้บ้าง</li>
                        <li>ต้องมีกลไกให้ผู้ใช้งานกดให้ความยินยอม (Explicit Consent) อย่างชัดเจนก่อนที่ระบบจะทำการบันทึกข้อมูล</li>
                      </ul>
                    </div>
                    <div>
                      <strong className="block mb-1">7.3 มาตรการรักษาความมั่นคงปลอดภัยของข้อมูลส่วนบุคคล:</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li><strong>รหัสผ่านของผู้ใช้งานในระบบ:</strong> ต้องผ่านกระบวนการเข้ารหัสทางเดียวที่มีความปลอดภัยสูง (Cryptographic Password Hashing เช่น <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">bcrypt</code>, <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">Argon2</code> หรือ <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">PBKDF2</code>) ห้ามบันทึกรหัสผ่านเป็นข้อความปกติ (Plaintext) หรือใช้การแฮชที่ล้าสมัย (เช่น <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">MD5</code> หรือ <code className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-[11px]">SHA-1</code> โดยไม่มี Salt) ในฐานข้อมูลโดยเด็ดขาด</li>
                        <li><strong>การจำกัดสิทธิ์เข้าถึงไฟล์ส่วนบุคคล:</strong> ไฟล์เอกสารหรือรูปภาพส่วนบุคคลที่ผู้ใช้งานอัปโหลดเข้าสู่ระบบ ต้องมีการตรวจสอบสิทธิ์ก่อนเปิดดู (Access Control) ห้ามวางไว้ในโฟลเดอร์สาธารณะที่บุคคลทั่วไปสามารถสุ่มเดา URL เพื่อเปิดดูหรือดาวน์โหลดได้โดยตรง</li>
                      </ul>
                    </div>
                    <p>
                      <strong>7.4 การทำลายข้อมูลหลังเสร็จสิ้นโครงงาน (Data Retention & Erasure):</strong> เมื่อผ่านการสอบประเมินโครงงานเสร็จสิ้น นักศึกษาต้องดำเนินการลบหรือทำลายข้อมูลส่วนบุคคลจริงทั้งหมดที่เก็บมาในระหว่างการทดลองออกจากฐานข้อมูลและพื้นที่จัดเก็บไฟล์ หรือแปลงให้เป็นข้อมูลนิรนามที่ไม่สามารถระบุตัวตนได้ (Anonymization) ก่อนส่งมอบงานหรือปิดระบบ
                    </p>
                  </div>
                </div>

                {/* ข้อ 8 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 8
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      การดูแลรักษาข้อมูลและการสำรองข้อมูล (Data Backup & Limitation of Liability)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p>
                      <strong>8.1 หน้าที่และความรับผิดชอบของนักศึกษา:</strong> นักศึกษาเป็นผู้รับผิดชอบหลักในการสำรองข้อมูล (Backup) ทั้งหมดภายในเครื่องของตนเองอย่างสม่ำเสมอ ทั้งในส่วนของซอร์สโค้ด ฐานข้อมูล (Database Dump) ไฟล์การตั้งค่า และไฟล์สื่อที่อัปโหลด โดยต้องสำรองข้อมูลแยกออกไปยังอุปกรณ์ภายนอกหรือระบบคลาวด์ส่วนตัว (แนะนำให้ใช้ระบบจัดการเวอร์ชัน เช่น Git สำหรับซอร์สโค้ด และสำรองฐานข้อมูลเก็บไว้ในเครื่องคอมพิวเตอร์ส่วนตัวทุกสัปดาห์หรือทุกครั้งที่มีการอัปเดตสำคัญ)
                    </p>
                    <p>
                      <strong>8.2 ขอบเขตระบบสำรองข้อมูลของแผนก:</strong> ระบบสำรองข้อมูลอัตโนมัติของเครื่องแม่ข่ายหลัก (Proxmox Backup / Snapshot ของแผนก หากมี) มีวัตถุประสงค์เพื่อใช้กู้คืนระบบโครงสร้างพื้นฐานส่วนกลางในกรณีเกิดเหตุวิกฤตของฮาร์ดแวร์เท่านั้น ผู้ดูแลระบบไม่รับประกันความครบถ้วน ความสมบูรณ์ หรือความเป็นปัจจุบันของข้อมูลภายในคอนเทนเนอร์รายกลุ่ม และไม่มีหน้าที่กู้คืนไฟล์ย่อยที่นักศึกษาเผลอลบด้วยตนเอง
                    </p>
                    <div>
                      <strong className="block mb-1">8.3 การปฏิเสธความรับผิด (Disclaimer of Warranty & Liability):</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>ทรัพยากรเครื่องแม่ข่ายให้บริการตามสภาพ ("AS-IS") โดยไม่มีการรับประกันความพร้อมใช้งานตลอดเวลา (No Uptime SLA Guarantee)</li>
                        <li>แผนกเทคโนโลยีคอมพิวเตอร์ อาจารย์ที่ปรึกษา และผู้ดูแลระบบ ขอสงวนสิทธิ์ไม่รับผิดชอบต่อความเสียหาย ความล่าช้าในการทำโครงงาน หรือการสูญหายของข้อมูลในทุกกรณี ไม่ว่าจะเกิดจากความขัดข้องของฮาร์ดแวร์ ดิสก์เสียหาย ระบบเครือข่ายล่ม กระแสไฟฟ้าขัดข้อง ภัยธรรมชาติ ข้อผิดพลาดของซอฟต์แวร์ การถูกโจมตีทางไซเบอร์ หรือการใช้คำสั่งผิดพลาดของผู้ใช้งานเอง (เช่น การสั่งลบไฟล์หรือตารางฐานข้อมูลผิดพลาด)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* ข้อ 9 */}
                <div className="space-y-3 pt-6">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                      ข้อ 9
                    </span>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm">
                      การบำรุงรักษาระบบ อายุการใช้งาน และการสิ้นสุดสิทธิ์ (Maintenance, Lifecycle & Termination)
                    </h3>
                  </div>
                  <div className="space-y-2.5 text-zinc-600 dark:text-zinc-300 text-xs pl-2 sm:pl-3 border-l-2 border-zinc-200 dark:border-zinc-800">
                    <p>
                      <strong>9.1 การปิดปรับปรุงระบบ (System Maintenance):</strong> ผู้ดูแลระบบมีสิทธิ์รีสตาร์ทเครื่องแม่ข่ายหลัก อัปเดตระบบเครือข่าย หรือปิดปรับปรุงระบบตามรอบระยะเวลา โดยจะแจ้งให้ทราบล่วงหน้าผ่านช่องทางสื่อสารของแผนก เว้นแต่กรณีเหตุฉุกเฉินหรือการแก้ไขช่องโหว่ร้ายแรงที่ผู้ดูแลระบบสามารถดำเนินการได้ทันทีโดยไม่ต้องแจ้งล่วงหน้า
                    </p>
                    <p>
                      <strong>9.2 ระยะเวลาการให้บริการ:</strong> สิทธิ์การใช้งานเครื่องเซิร์ฟเวอร์มีผลนับตั้งแต่วันที่ได้รับการจัดสรรไปจนถึงวันสิ้นสุดภาคการศึกษา หรือเมื่อนักศึกษาดำเนินการสอบประเมินโครงงานและส่งเล่มรายงานฉบับสมบูรณ์เสร็จสิ้นตามกำหนดการของแผนก (แล้วแต่วันใดจะถึงก่อน)
                    </p>
                    <p>
                      <strong>9.3 การขอต่ออายุการใช้งาน:</strong> หากโครงงานได้รับคัดเลือกให้ส่งเข้าประกวดแข่งขัน นำไปตีพิมพ์งานวิจัย หรือนำไปพัฒนาต่อยอดให้กับแผนก และมีความจำเป็นต้องใช้งานเซิร์ฟเวอร์ต่อหลังสิ้นสุดภาคการศึกษา นักศึกษาต้องให้อาจารย์ที่ปรึกษาลงนามรับรองเพื่อขอขยายเวลาการใช้งานต่อผู้ดูแลระบบเป็นรายกรณี
                    </p>
                    <div>
                      <strong className="block mb-1">9.4 การส่งคืนทรัพยากรและการล้างข้อมูล (Decommissioning & Data Destruction):</strong>
                      <ul className="list-disc pl-5 space-y-1 text-zinc-500 dark:text-zinc-400">
                        <li>เมื่อสิ้นสุดระยะเวลาการใช้งานตามข้อ 9.2 นักศึกษามีหน้าที่ดึงข้อมูลซอร์สโค้ดและฐานข้อมูลที่ต้องการเก็บไว้เป็นผลงานออกจากเครื่องเซิร์ฟเวอร์ให้เสร็จสิ้นภายใน <strong>7 วัน</strong> นับจากวันประกาศผลหรือวันสิ้นสุดภาคการศึกษา</li>
                        <li>เมื่อพ้นกำหนดเวลาดังกล่าว ผู้ดูแลระบบจะทำการปิดการทำงานของคอนเทนเนอร์ ระงับสิทธิ์การเข้าถึงทั้งหมด และดำเนินการเก็บถาวร (Archive) หรือล้างข้อมูลทำลายคอนเทนเนอร์ทิ้งอย่างถาวร (Format / Destroy) เพื่อนำทรัพยากรไปจัดสรรให้นักศึกษารุ่นถัดไป โดยนักศึกษาไม่สามารถเรียกร้องขอข้อมูลคืนได้อีกในภายหลัง</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                การกดยอมรับถือเป็นการผูกพันตามข้อกำหนดทุกข้อ
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTermsModalOpen(false)}
                  className="text-xs h-9 px-4 cursor-pointer"
                >
                  ปิดหน้าต่าง
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setReqAgreedTerms(true)
                    setIsTermsModalOpen(false)
                  }}
                  className="text-xs h-9 px-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer font-medium shadow-xs"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  เข้าใจและยอมรับข้อกำหนด
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING MINIMIZED OR FULLSCREEN TERMINAL */}
      {terminalServer && (terminalMode === 'minimized' || terminalMode === 'fullscreen') && (
        <EmbeddedTerminal
          server={terminalServer}
          mode={terminalMode}
          onModeChange={setTerminalMode}
          onClose={() => setTerminalServer(null)}
        />
      )}

      {/* ADMIN PIN UNLOCK MODAL */}
      {isAdminPinModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">ยืนยันตัวตนอาจารย์ผู้ดูแล</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseAdminPinModal}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyAdminPin} className="p-5 space-y-4">
              {adminPinError && (
                <div className="p-2.5 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 font-medium">
                  {adminPinError}
                </div>
              )}

              <div>
                <Label htmlFor="adminPin">กรอก Master PIN ของอาจารย์</Label>
                <Input
                  id="adminPin"
                  type="password"
                  autoFocus
                  placeholder="••••"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="font-mono text-center text-lg tracking-widest"
                  required
                />
                <span className="text-[10px] text-zinc-400 mt-1 block text-center">
                  สำหรับตรวจสอบและกดอนุมัติคำขอสร้างเครื่องเซิร์ฟเวอร์
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseAdminPinModal}
                  className="text-xs h-9 cursor-pointer"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="text-xs h-9 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
                >
                  ปลดล็อก Admin Mode
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


