import express from 'express'
import { db } from '../database.js'
import { Client as SSHClient } from 'ssh2'
import {
  getPoolDashboardSnapshot,
  getContainerProcesses,
  killContainerProcess,
  getContainerLiveStats
} from '../services/docker_provisioner.js'
import { syncAllStudentsInflux } from '../services/influx.js'

const router = express.Router()

const VALID_PINS = [
  process.env.ADMIN_PIN || '2569',
  '07072569'
]

// Middleware to verify admin PIN
function requireAdmin(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.query.pin
  if (VALID_PINS.includes(pin)) {
    return next()
  }
  return res.status(403).json({ error: 'รหัส Master PIN ไม่ถูกต้อง กรุณายืนยันสิทธิ์อาจารย์' })
}

// Verify Master PIN with Brute-force Lockout
router.post('/verify-pin', (req, res) => {
  const { pin } = req.body
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'admin'
  const lockoutKey = `admin_pin_${clientIp}`

  // Check Lockout
  const lockout = db.checkLoginLockout(lockoutKey)
  if (lockout.locked) {
    return res.status(429).json({
      error: `การเข้าถึงแผงควบคุมอาจารย์ถูกระงับชั่วคราวเนื่องจากเดารหัส PIN ผิดเกินกำหนด กรุณารออีก ${lockout.remainingMinutes} นาที`
    })
  }

  if (VALID_PINS.includes(pin)) {
    db.resetLoginAttempts(lockoutKey)
    db.addLog('ADMIN_LOGIN_SUCCESS', { ip: clientIp, pin_used: '****' })
    return res.json({ success: true, authorized: true })
  }

  const attempt = db.recordFailedAttempt(lockoutKey, 5, 15)
  db.addLog('ADMIN_LOGIN_FAILED', { ip: clientIp, attempt: attempt.failedCount })

  if (attempt.locked) {
    return res.status(429).json({
      error: `คุณกรอกรหัส Master PIN ผิดเกินกำหนด (5 ครั้ง) ระบบระงับการเข้าถึงจาก IP นี้เป็นเวลา 15 นาที`
    })
  }

  return res.status(401).json({
    error: `รหัส Master PIN ไม่ถูกต้อง (เหลือโอกาสลองอีก ${attempt.remainingAttempts} ครั้ง)`
  })
})

// GET all students with PASSWORDS for teacher inspection
router.get('/students', requireAdmin, (req, res) => {
  try {
    const students = db.getAllStudents()
    const servers = db.getServers()
    const requests = db.getRequests()

    // Enrich students with their requested/approved containers
    const enriched = students.map(st => {
      const studentServers = servers.filter(s => s.studentId === st.studentId)
      const studentRequests = requests.filter(r => r.studentId === st.studentId)
      return {
        ...st,
        serverCount: studentServers.length,
        servers: studentServers,
        requests: studentRequests
      }
    })

    db.addLog('ADMIN_VIEW_STUDENT_PASSWORDS', { count: enriched.length })
    res.json({ success: true, count: enriched.length, students: enriched })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Admin Dashboard Summary Metrics
router.get('/stats', requireAdmin, (req, res) => {
  try {
    const students = db.getAllStudents()
    const requests = db.getRequests()
    const servers = db.getServers()

    const pendingRequests = requests.filter(r => r.status === 'pending').length
    const approvedRequests = requests.filter(r => r.status === 'approved').length
    const rejectedRequests = requests.filter(r => r.status === 'rejected').length

    const totalVcpu = servers.reduce((acc, s) => acc + (s.vcpu || 1), 0)
    const totalRam = servers.reduce((acc, s) => acc + (s.ram || 1024), 0)
    const totalDisk = servers.reduce((acc, s) => acc + (s.disk || 10), 0)

    res.json({
      success: true,
      stats: {
        totalStudents: students.length,
        totalServers: servers.length,
        runningServers: servers.filter(s => s.status === 'running').length,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        allocatedResources: {
          vcpu: totalVcpu,
          ramMb: totalRam,
          diskGb: totalDisk
        }
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Pool Summary Dashboard (Snapshot)
router.get('/pool/summary', requireAdmin, async (req, res) => {
  try {
    const servers = db.getServers()
    const snapshot = await getPoolDashboardSnapshot(servers)
    res.json(snapshot)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Pool Summary Dashboard Realtime Stream (SSE)
router.get('/pool/stream', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  let isAlive = true

  const sendPoolSnapshot = async () => {
    if (!isAlive) return
    try {
      const servers = db.getServers()
      const snapshot = await getPoolDashboardSnapshot(servers)
      if (!isAlive) return
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`)
    } catch (err) {
      if (isAlive) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      }
    }
  }

  sendPoolSnapshot()
  const interval = setInterval(sendPoolSnapshot, 2000)

  req.on('close', () => {
    isAlive = false
    clearInterval(interval)
  })
})

// Synchronize all student accounts, orgs, buckets & passwords in InfluxDB
router.post('/influx/sync-all', requireAdmin, async (req, res) => {
  try {
    const students = db.getAllStudents()
    const result = await syncAllStudentsInflux(students)
    for (const s of students) {
      if (s.password && s.password.length < 8) {
        s.password = s.password.padEnd(8, '0')
        s.token = s.password
      }
      s.influxOrg = `std-${s.studentId}`
      s.influxBucket = 'telemetry'
      db.saveStudent(s)
    }
    db.addLog('ADMIN_SYNC_ALL_INFLUX', { total: result.total, success: result.successfulLogins })
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Single Server Live Stats & Process Stream (SSE)
router.get('/servers/:vmid/stream', requireAdmin, (req, res) => {
  const { vmid } = req.params
  const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid || String(s.vmid) === String(vmid))
  if (!server) {
    return res.status(404).json({ error: 'ไม่พบเซิร์ฟเวอร์' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  const containerId = server.containerId || server.name
  let isAlive = true

  const sendServerMetrics = async () => {
    if (!isAlive) return
    try {
      const [stats, processes] = await Promise.all([
        getContainerLiveStats(containerId, server),
        getContainerProcesses(containerId)
      ])
      if (!isAlive) return
      res.write(`data: ${JSON.stringify({
        success: true,
        vmid: server.vmid,
        serverName: server.name,
        studentId: server.studentId,
        containerId,
        stats,
        processes,
        timestamp: new Date().toISOString()
      })}\n\n`)
    } catch (err) {
      if (isAlive) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      }
    }
  }

  sendServerMetrics()
  const interval = setInterval(sendServerMetrics, 2000)

  req.on('close', () => {
    isAlive = false
    clearInterval(interval)
  })
})

// Single Server Processes (Snapshot)
router.get('/servers/:vmid/processes', requireAdmin, async (req, res) => {
  try {
    const { vmid } = req.params
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid || String(s.vmid) === String(vmid))
    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเซิร์ฟเวอร์' })
    }
    const containerId = server.containerId || server.name
    const processes = await getContainerProcesses(containerId)
    res.json({ success: true, vmid: server.vmid, processes })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Kill Process inside Student Container
router.post('/servers/:vmid/processes/:pid/kill', requireAdmin, async (req, res) => {
  try {
    const { vmid, pid } = req.params
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid || String(s.vmid) === String(vmid))
    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเซิร์ฟเวอร์' })
    }
    const containerId = server.containerId || server.name
    const result = await killContainerProcess(containerId, pid)
    if (result.success) {
      db.addLog('ADMIN_KILLED_PROCESS', { vmid: server.vmid, pid, server: server.name })
      return res.json({ success: true, message: `ยุติโปรเซส PID ${pid} เรียบร้อยแล้ว` })
    }
    res.status(400).json({ error: result.error || 'ไม่สามารถยุติโปรเซสได้' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get recent audit logs
router.get('/logs', requireAdmin, (req, res) => {
  res.json({ success: true, logs: db.data.audit_logs })
})

// Trigger HDD Backup Now
router.post('/backup/trigger', requireAdmin, async (req, res) => {
  const pveHost = process.env.PVE_HOST || '10.10.10.1'
  const pveUser = 'tc-admin'
  const pvePass = process.env.PVE_PASSWORD || '07072569'

  const ssh = new SSHClient()
  ssh.on('ready', () => {
    ssh.exec('echo 07072569 | sudo -S /usr/local/bin/backup-lbtech-iot.sh', (err, stream) => {
      if (err) {
        ssh.end()
        return res.status(500).json({ error: err.message })
      }
      let output = ''
      stream.on('data', d => { output += d.toString() })
      stream.on('close', code => {
        ssh.end()
        db.addLog('MANUAL_HDD_BACKUP_TRIGGERED', { exitCode: code, output: output.slice(-200) })
        res.json({
          success: code === 0,
          exitCode: code,
          message: 'การสำรองข้อมูลไปยัง HDD /mnt/pve-extra เสร็จสมบูรณ์',
          output
        })
      })
    })
  }).on('error', err => {
    res.status(500).json({ error: 'SSH to Host failed: ' + err.message })
  }).connect({
    host: pveHost,
    port: 22,
    username: pveUser,
    password: pvePass,
    readyTimeout: 15000
  })
})

// Get Backup Status and list files on HDD
router.get('/backup/status', requireAdmin, async (req, res) => {
  const pveHost = process.env.PVE_HOST || '10.10.10.1'
  const pveUser = 'tc-admin'
  const pvePass = process.env.PVE_PASSWORD || '07072569'

  const ssh = new SSHClient()
  ssh.on('ready', () => {
    ssh.exec('echo 07072569 | sudo -S ls -lh /mnt/pve-extra/backups/lbtech-iot/ ; echo "---" ; df -h /mnt/pve-extra', (err, stream) => {
      if (err) {
        ssh.end()
        return res.status(500).json({ error: err.message })
      }
      let output = ''
      stream.on('data', d => { output += d.toString() })
      stream.on('close', () => {
        ssh.end()
        res.json({ success: true, hddStatus: output })
      })
    })
  }).on('error', err => {
    res.status(500).json({ error: 'SSH to Host failed: ' + err.message })
  }).connect({
    host: pveHost,
    port: 22,
    username: pveUser,
    password: pvePass,
    readyTimeout: 15000
  })
})

export default router
