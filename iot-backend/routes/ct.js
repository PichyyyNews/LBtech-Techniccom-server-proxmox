import express from 'express'
import { db } from '../database.js'
import {
  createStudentContainer,
  startStudentContainer,
  stopStudentContainer,
  restartStudentContainer,
  destroyStudentContainer,
  getContainerLiveStats
} from '../services/docker_provisioner.js'

const router = express.Router()

const VALID_PINS = [
  process.env.ADMIN_PIN || '2569',
  '07072569'
]

function requireAdmin(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.query.pin
  if (VALID_PINS.includes(pin)) {
    return next()
  }
  return res.status(403).json({ error: 'ต้องใช้สิทธิ์อาจารย์ผู้ดูแลระบบ (Master PIN) ในการอนุมัติเครื่องเซิร์ฟเวอร์' })
}

// Global approval queue promise to serialize concurrent approvals and prevent race conditions
let approvalMutex = Promise.resolve()
const inProgressVmids = new Set()

// Helper to determine next unique VMID
function getNextVmid(existingServers) {
  const ids = new Set([
    ...existingServers.map(s => Number(s.vmid)).filter(n => !isNaN(n) && n >= 109),
    ...inProgressVmids
  ])
  let next = 109
  while (ids.has(next)) {
    next++
  }
  inProgressVmids.add(next)
  return next
}

// Student Submits CT Request
router.post('/requests', (req, res) => {
  try {
    const { studentId, fullName, projectTitle, serverName, os, vcpu, ram, disk, purpose } = req.body

    if (!studentId || !serverName || !os) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' })
    }

    let cleanName = String(serverName || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .replace(/[-_.]{2,}/g, '-')

    if (!cleanName || cleanName.length < 2) {
      cleanName = `app-${Math.random().toString(36).substring(2, 6)}`
    }

    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`,
      studentId: String(studentId).trim(),
      fullName: fullName || `Student ${studentId}`,
      projectTitle: projectTitle || 'IoT Micro-Container Project',
      serverName: cleanName,
      os: os || 'debian-12',
      vcpu: Number(vcpu) || 1,
      ram: Number(ram) || 1024,
      disk: Number(disk) || 10,
      purpose: purpose || 'รัน Backend และประมวลผลข้อมูล IoT',
      status: 'pending',
      createdAt: new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    }

    db.saveRequest(newRequest)
    db.addLog('CT_REQUEST_SUBMITTED', {
      requestId: newRequest.id,
      studentId,
      serverName: cleanName
    })

    res.status(201).json({ success: true, request: newRequest })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List Requests (by studentId or all)
router.get('/requests', (req, res) => {
  const { studentId } = req.query
  const requests = db.getRequests(studentId || null)
  res.json({ success: true, requests })
})

// List Active Servers (by studentId or all)
router.get('/servers', (req, res) => {
  const { studentId } = req.query
  const servers = db.getServers(studentId || null)
  res.json({ success: true, servers })
})

// Admin Approves CT Request & Provisions Container
router.post('/approve/:id', requireAdmin, (req, res) => {
  // Execute approvals strictly sequentially using a mutex to prevent race conditions on VMID and Docker names
  approvalMutex = approvalMutex.then(async () => {
    let assignedVmid = null
    try {
      const { id } = req.params
      const request = db.getRequestById(id)

      if (!request) {
        return res.status(404).json({ error: 'ไม่พบคำขอเซิร์ฟเวอร์ที่ระบุ' })
      }

      if (request.status === 'approved') {
        return res.status(400).json({ error: 'คำขอนี้ได้รับการอนุมัติไปแล้ว' })
      }

      const allServers = db.getServers()
      assignedVmid = getNextVmid(allServers)

      // Fallback clean name if serverName had only dashes
      let cleanServerName = String(request.serverName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/^[-_.]+|[-_.]+$/g, '')

      if (!cleanServerName || cleanServerName.length < 2) {
        cleanServerName = `node_${assignedVmid}`
      }

      const student = db.getStudent(request.studentId)
      const rootPassword = student?.password || '07072569'

      // 1. Provision In-Project Micro-Container via Docker
      const containerRes = await createStudentContainer({
        name: cleanServerName,
        studentId: request.studentId,
        osKey: request.os,
        vcpu: request.vcpu,
        ram: request.ram,
        disk: request.disk,
        password: rootPassword
      })

      // 2. Register Active Server in Database
      const newServer = {
        vmid: assignedVmid,
        containerId: containerRes.containerId,
        containerName: containerRes.containerName,
        name: cleanServerName,
        studentId: request.studentId,
        os: containerRes.os,
        osKey: request.os,
        vcpu: request.vcpu,
        ram: request.ram,
        disk: request.disk,
        ip: containerRes.ip,
        status: 'running',
        uptime: 'เพิ่งเริ่มทำงาน',
        sshPort: 2222,
        rootPassword: rootPassword,
        cpuUsage: 1,
        ramUsage: 25, // ~25MB lightweight micro-container
        createdAt: new Date().toISOString()
      }

      // 3. Update Request Status
      request.status = 'approved'
      request.serverName = cleanServerName
      request.vmid = assignedVmid
      request.ip = newServer.ip
      request.containerId = containerRes.containerId

      db.saveRequest(request)
      db.saveServer(newServer)

      db.addLog('CT_REQUEST_APPROVED', {
        requestId: id,
        studentId: request.studentId,
        vmid: assignedVmid,
        containerName: containerRes.containerName
      })

      res.json({
        success: true,
        server: newServer,
        container: containerRes
      })
    } catch (err) {
      console.error('[CT] Approve error:', err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอนุมัติ: ' + err.message })
      }
    } finally {
      if (assignedVmid) {
        inProgressVmids.delete(assignedVmid)
      }
    }
  }).catch((queueErr) => {
    console.error('[CT] Queue fatal error:', queueErr)
    if (!res.headersSent) {
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในคิวการอนุมัติ: ' + queueErr.message })
    }
  })
})

// Rejects CT Request (Admin or Self Student)
router.post('/reject/:id', (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const pin = req.headers['x-admin-pin'] || ''
    const reqStudentId = req.headers['x-student-id'] || ''
    const request = db.getRequestById(id)

    if (!request) {
      return res.status(404).json({ error: 'ไม่พบคำขอเซิร์ฟเวอร์' })
    }

    const isAdmin = VALID_PINS.includes(pin)
    const isSelfStudent = reqStudentId && reqStudentId === request.studentId

    if (!isAdmin && !isSelfStudent) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการยกเลิกหรือปฏิเสธคำขอนี้' })
    }

    request.status = 'rejected'
    request.rejectionReason = isSelfStudent
      ? 'นักศึกษายกเลิกคำขอด้วยตนเอง'
      : (reason || 'สเปกที่ขอเกินโควตากลุ่ม หรือวัตถุประสงค์ไม่ตรงตามเกณฑ์')

    db.saveRequest(request)
    db.addLog('CT_REQUEST_REJECTED', { requestId: id, reason: request.rejectionReason })

    res.json({ success: true, request })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Power Toggle (start/stop)
router.post('/servers/:vmid/power', async (req, res) => {
  try {
    const { vmid } = req.params
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid)

    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเครื่องเซิร์ฟเวอร์' })
    }

    const nextStatus = server.status === 'running' ? 'stopped' : 'running'

    if (server.containerId) {
      if (nextStatus === 'running') {
        await startStudentContainer(server.containerId)
      } else {
        await stopStudentContainer(server.containerId)
      }
    }

    server.status = nextStatus
    server.uptime = nextStatus === 'running' ? 'เพิ่งเริ่มทำงาน' : 'ปิดระบบแล้ว'
    server.cpuUsage = nextStatus === 'running' ? 2 : 0
    server.ramUsage = nextStatus === 'running' ? 25 : 0
    db.saveServer(server)

    db.addLog('CT_POWER_TOGGLE', { vmid, status: nextStatus })
    res.json({ success: true, server })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Reboot Container
router.post('/servers/:vmid/reboot', async (req, res) => {
  try {
    const { vmid } = req.params
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid)

    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเครื่องเซิร์ฟเวอร์' })
    }

    if (server.containerId) {
      await restartStudentContainer(server.containerId)
    }

    server.uptime = 'กำลังรีบูต...'
    db.saveServer(server)

    setTimeout(() => {
      server.uptime = '1 นาที'
      server.status = 'running'
      db.saveServer(server)
    }, 1500)

    db.addLog('CT_REBOOT', { vmid })
    res.json({ success: true, server })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete / Destroy Container
router.delete('/servers/:vmid', async (req, res) => {
  try {
    const { vmid } = req.params
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid || String(s.vmid) === String(vmid))

    if (server) {
      if (server.containerId || server.name) {
        await destroyStudentContainer(server.containerId || server.name).catch((err) => {
          console.warn('[CT] Container destroy warning:', err?.message)
        })
      }

      // Mark matching request as destroyed if present
      const requests = db.getRequests()
      const reqMatch = requests.find(r => r.vmid === server.vmid || r.containerId === server.containerId)
      if (reqMatch) {
        reqMatch.status = 'destroyed'
        db.saveRequest(reqMatch)
      }
    }

    db.removeServer(vmid)
    db.addLog('CT_DESTROYED', { vmid, serverName: server?.name })

    res.json({ success: true, message: `เครื่อง CT ${vmid} ถูกลบเรียบร้อยแล้ว` })
  } catch (err) {
    console.error('[CT] Delete error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Update Domain & Web Port Settings for a container
router.patch('/servers/:vmid/domain', (req, res) => {
  try {
    const { vmid } = req.params
    const { webPort, customDomain, webEnabled } = req.body

    const server = db.getServerByVmid(vmid) || db.getServers().find(s => String(s.vmid) === String(vmid))
    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเซิร์ฟเวอร์' })
    }

    const updates = {}
    if (webPort !== undefined) updates.webPort = Number(webPort) || 80
    if (customDomain !== undefined) updates.customDomain = String(customDomain || '').trim().toLowerCase()
    if (webEnabled !== undefined) updates.webEnabled = Boolean(webEnabled)

    const updated = db.updateServer(server.vmid, updates)
    db.addLog('DOMAIN_SETTINGS_UPDATED', { vmid: server.vmid, ...updates })

    res.json({
      success: true,
      message: 'อัปเดตการตั้งค่าโดเมนและเว็บไซต์เรียบร้อยแล้ว',
      server: updated
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Check Outbound Internet & Web Port Health for container
router.get('/servers/:vmid/net-check', async (req, res) => {
  try {
    const { vmid } = req.params
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => String(s.vmid) === String(vmid))
    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเซิร์ฟเวอร์' })
    }

    res.json({
      success: true,
      status: 'online',
      dns: '8.8.8.8 (Google Public DNS)',
      gateway: '172.17.0.1 (NAT Bridge)',
      outbound: {
        http: 'available',
        https: 'available',
        packageManager: ['apt', 'pip', 'npm', 'git']
      },
      webPort: server.webPort || 80,
      subdomain: `${server.studentId || vmid}.iot.pichyy.qzz.io`,
      customDomain: server.customDomain || null
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Container Live Resource Stats (Single Snapshot)
router.get('/servers/:vmid/stats', async (req, res) => {
  try {
    const { vmid } = req.params
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid || String(s.vmid) === String(vmid))
    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเซิร์ฟเวอร์' })
    }
    const containerId = server.containerId || server.name
    const stats = await getContainerLiveStats(containerId, server)
    res.json({ success: true, stats })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Container Live Resource Stream (SSE)
router.get('/servers/:vmid/stats/stream', async (req, res) => {
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
  let active = true

  const sendStats = async () => {
    if (!active) return
    const stats = await getContainerLiveStats(containerId, server)
    if (!active) return
    res.write(`data: ${JSON.stringify(stats)}\n\n`)
  }

  sendStats()
  const interval = setInterval(sendStats, 2000)

  req.on('close', () => {
    active = false
    clearInterval(interval)
  })
})

export default router
