import express from 'express'
import { db } from '../database.js'
import { getNextVmid, createLxcContainer, controlContainer, destroyContainer } from '../services/proxmox.js'

const router = express.Router()

// List CT Requests
router.get('/requests', (req, res) => {
  const { studentId } = req.query
  const requests = db.getRequests(studentId || null)
  res.json({ success: true, requests })
})

// Create new CT Request
router.post('/requests', (req, res) => {
  try {
    const {
      studentId,
      fullName,
      projectTitle,
      serverName,
      os,
      vcpu,
      ram,
      disk,
      purpose
    } = req.body

    if (!studentId || !serverName || !purpose) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' })
    }

    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId: studentId.trim(),
      fullName: (fullName || '').trim() || 'นักศึกษาโครงงาน',
      projectTitle: (projectTitle || '').trim() || 'โปรเจกต์ IoT',
      serverName: serverName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      os: os || 'debian-12',
      vcpu: Number(vcpu) || 1,
      ram: Number(ram) || 1024,
      disk: Number(disk) || 10,
      purpose: purpose.trim(),
      status: 'pending',
      createdAt: new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    }

    db.saveRequest(newRequest)
    db.addLog('CT_REQUEST_SUBMITTED', { id: newRequest.id, studentId: newRequest.studentId, serverName: newRequest.serverName })

    res.status(201).json({ success: true, request: newRequest })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List Active CT Servers
router.get('/servers', (req, res) => {
  const { studentId } = req.query
  const servers = db.getServers(studentId || null)
  res.json({ success: true, servers })
})

// Admin Approves CT Request & Provisions Container
router.post('/approve/:id', async (req, res) => {
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
    const nextVmid = await getNextVmid(allServers)

    const student = db.getStudent(request.studentId)
    const rootPassword = student?.password || '07072569'

    // 1. Trigger Proxmox Container Creation
    const pveResult = await createLxcContainer({
      vmid: nextVmid,
      hostname: request.serverName,
      osKey: request.os,
      vcpu: request.vcpu,
      ram: request.ram,
      disk: request.disk,
      password: rootPassword
    })

    const osLabels = {
      'debian-12': 'Debian 12 (Bookworm)',
      'ubuntu-24': 'Ubuntu 24.04 LTS (Noble)',
      'alpine-3': 'Alpine Linux 3.22'
    }

    // 2. Register Active CT Server
    const newServer = {
      vmid: nextVmid,
      name: request.serverName,
      studentId: request.studentId,
      os: osLabels[request.os] || 'Debian 12 (Bookworm)',
      osKey: request.os,
      vcpu: request.vcpu,
      ram: request.ram,
      disk: request.disk,
      ip: `10.10.10.${nextVmid}`,
      status: 'running',
      uptime: 'เพิ่งเริ่มทำงาน',
      sshPort: 2222,
      rootPassword: rootPassword,
      cpuUsage: 3,
      ramUsage: Math.floor(request.ram * 0.12),
      createdAt: new Date().toISOString()
    }

    // 3. Update Request Status
    request.status = 'approved'
    request.vmid = nextVmid
    request.ip = newServer.ip
    db.saveRequest(request)
    db.saveServer(newServer)

    db.addLog('CT_REQUEST_APPROVED', {
      requestId: id,
      studentId: request.studentId,
      vmid: nextVmid,
      serverName: request.serverName
    })

    res.json({
      success: true,
      server: newServer,
      pveResult
    })
  } catch (err) {
    console.error('[CT] Approve error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอนุมัติ: ' + err.message })
  }
})

// Admin Rejects CT Request
router.post('/reject/:id', (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const request = db.getRequestById(id)

    if (!request) {
      return res.status(404).json({ error: 'ไม่พบคำขอเซิร์ฟเวอร์' })
    }

    request.status = 'rejected'
    request.rejectionReason = reason || 'สเปกที่ขอเกินโควตากลุ่ม หรือวัตถุประสงค์ไม่ตรงตามเกณฑ์'
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
    const server = db.getServerByVmid(vmid)

    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเครื่องเซิร์ฟเวอร์' })
    }

    const nextStatus = server.status === 'running' ? 'stopped' : 'running'
    const action = nextStatus === 'running' ? 'start' : 'stop'

    await controlContainer(vmid, action)

    server.status = nextStatus
    server.uptime = nextStatus === 'running' ? 'เพิ่งเริ่มทำงาน' : 'ปิดระบบแล้ว'
    server.cpuUsage = nextStatus === 'running' ? 4 : 0
    server.ramUsage = nextStatus === 'running' ? Math.floor(server.ram * 0.14) : 0
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
    const server = db.getServerByVmid(vmid)

    if (!server) {
      return res.status(404).json({ error: 'ไม่พบเครื่องเซิร์ฟเวอร์' })
    }

    await controlContainer(vmid, 'reboot')
    server.uptime = 'กำลังรีบูต...'
    db.saveServer(server)

    setTimeout(() => {
      server.uptime = '1 นาที'
      db.saveServer(server)
    }, 2000)

    db.addLog('CT_REBOOT', { vmid })
    res.json({ success: true, server })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete Container
router.delete('/servers/:vmid', async (req, res) => {
  try {
    const { vmid } = req.params
    await destroyContainer(vmid)
    db.removeServer(vmid)
    db.addLog('CT_DESTROYED', { vmid })
    res.json({ success: true, message: `ลบเครื่องเซิร์ฟเวอร์ CT ${vmid} สำเร็จ` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
