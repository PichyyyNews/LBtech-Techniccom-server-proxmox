import express from 'express'
import { db } from '../database.js'
import {
  createStudentContainer,
  startStudentContainer,
  stopStudentContainer,
  restartStudentContainer,
  destroyStudentContainer
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

// Helper to determine next VMID/ID
function getNextVmid(existingServers) {
  const ids = existingServers.map(s => Number(s.vmid)).filter(n => !isNaN(n) && n >= 109)
  let next = 109
  while (ids.includes(next)) {
    next++
  }
  return next
}

// Student Submits CT Request
router.post('/requests', (req, res) => {
  try {
    const { studentId, fullName, projectTitle, serverName, os, vcpu, ram, disk, purpose } = req.body

    if (!studentId || !serverName || !os) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' })
    }

    const cleanName = serverName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(16).substring(2, 6)}`,
      studentId: studentId.trim(),
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
router.post('/approve/:id', requireAdmin, async (req, res) => {
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
    const nextVmid = getNextVmid(allServers)

    const student = db.getStudent(request.studentId)
    const rootPassword = student?.password || '07072569'

    // 1. Provision In-Project Micro-Container via Docker
    const containerRes = await createStudentContainer({
      name: request.serverName,
      studentId: request.studentId,
      osKey: request.os,
      vcpu: request.vcpu,
      ram: request.ram,
      disk: request.disk,
      password: rootPassword
    })

    // 2. Register Active Server in Database
    const newServer = {
      vmid: nextVmid,
      containerId: containerRes.containerId,
      containerName: containerRes.containerName,
      name: request.serverName,
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
    request.vmid = nextVmid
    request.ip = newServer.ip
    request.containerId = containerRes.containerId

    db.saveRequest(request)
    db.saveServer(newServer)

    db.addLog('CT_REQUEST_APPROVED', {
      requestId: id,
      studentId: request.studentId,
      vmid: nextVmid,
      containerName: containerRes.containerName
    })

    res.json({
      success: true,
      server: newServer,
      container: containerRes
    })
  } catch (err) {
    console.error('[CT] Approve error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอนุมัติ: ' + err.message })
  }
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
    const server = db.getServerByVmid(vmid) || db.getServers().find(s => s.containerId === vmid)

    if (server && server.containerId) {
      await destroyStudentContainer(server.containerId).catch(() => {})
    }

    db.deleteServer(vmid)
    db.addLog('CT_DESTROYED', { vmid })

    res.json({ success: true, message: `เครื่อง CT ${vmid} ถูกลบเรียบร้อยแล้ว` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
