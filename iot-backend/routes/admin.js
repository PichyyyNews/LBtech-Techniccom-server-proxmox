import express from 'express'
import { db } from '../database.js'

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

// Verify Master PIN
router.post('/verify-pin', (req, res) => {
  const { pin } = req.body
  if (VALID_PINS.includes(pin)) {
    db.addLog('ADMIN_LOGIN_SUCCESS', { pin_used: '****' })
    return res.json({ success: true, authorized: true })
  }
  db.addLog('ADMIN_LOGIN_FAILED')
  return res.status(401).json({ error: 'รหัส Master PIN ไม่ถูกต้อง' })
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

// Get recent audit logs
router.get('/logs', requireAdmin, (req, res) => {
  res.json({ success: true, logs: db.data.audit_logs })
})

export default router
