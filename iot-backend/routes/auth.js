import express from 'express'
import { db } from '../database.js'
import { provisionStudentTelemetry } from '../services/influx.js'
import { provisionMqttUser } from '../services/emqx.js'

const router = express.Router()

// Register new student
router.post('/register', async (req, res) => {
  try {
    const { studentId, fullName, projectTitle, department, password } = req.body

    const cleanId = (studentId || '').trim()
    if (!cleanId || cleanId.length < 5) {
      return res.status(400).json({ error: 'รหัสนักศึกษาต้องมีอย่างน้อย 5 ตัวอักษร' })
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
    }

    console.log(`[AUTH] Registering student: ${cleanId} (${fullName})`)

    // 1. Auto-provision InfluxDB
    const influxResult = await provisionStudentTelemetry(cleanId)

    // 2. Auto-provision EMQX MQTT User
    const emqxResult = await provisionMqttUser(cleanId, password)

    // 3. Save student in centralized database
    const studentRecord = {
      studentId: cleanId,
      fullName: (fullName || '').trim() || 'นักศึกษาโครงงาน',
      projectTitle: (projectTitle || '').trim() || 'โปรเจกต์ IoT ประจำกลุ่ม',
      department: (department || '').trim() || 'เทคโนโลยีคอมพิวเตอร์',
      password: password, // Stored for teacher review
      token: password,
      influxBucket: influxResult.bucket,
      influxToken: influxResult.token,
      influxOrg: influxResult.org,
      mqttUsername: emqxResult.username,
      mqttTopicPrefix: emqxResult.topicPrefix,
      createdAt: new Date().toISOString()
    }

    db.saveStudent(studentRecord)
    db.addLog('STUDENT_REGISTER', { studentId: cleanId, fullName: studentRecord.fullName })

    res.status(201).json({
      success: true,
      session: studentRecord,
      telemetry: influxResult,
      mqtt: emqxResult
    })
  } catch (err) {
    console.error('[AUTH] Register error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียน: ' + err.message })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { studentId, password } = req.body
    const cleanId = (studentId || '').trim()

    if (!cleanId || !password) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' })
    }

    let student = db.getStudent(cleanId)

    if (!student) {
      // Auto-create on first valid login for ease of student testing
      student = {
        studentId: cleanId,
        fullName: 'นักศึกษาโครงงาน',
        projectTitle: 'โปรเจกต์ IoT ประจำกลุ่ม',
        department: 'เทคโนโลยีคอมพิวเตอร์',
        password: password,
        token: password,
        influxBucket: `telemetry-${cleanId}`,
        influxToken: `lbtech_${cleanId}_token`,
        influxOrg: 'lbtech',
        createdAt: new Date().toISOString()
      }
      db.saveStudent(student)
    } else {
      // Check password if existing
      if (student.password && student.password !== password) {
        return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้องสำหรับรหัสนักศึกษานี้' })
      }
    }

    db.addLog('STUDENT_LOGIN', { studentId: cleanId })
    res.json({ success: true, session: student })
  } catch (err) {
    console.error('[AUTH] Login error:', err)
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + err.message })
  }
})

// Update student profile
router.put('/profile', (req, res) => {
  try {
    const { studentId, fullName, projectTitle, department, password } = req.body
    const cleanId = (studentId || '').trim()

    const student = db.getStudent(cleanId)
    if (!student) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลนักศึกษา' })
    }

    if (fullName) student.fullName = fullName.trim()
    if (projectTitle) student.projectTitle = projectTitle.trim()
    if (department) student.department = department.trim()
    if (password) {
      student.password = password
      student.token = password
    }

    db.saveStudent(student)
    db.addLog('STUDENT_UPDATE_PROFILE', { studentId: cleanId })

    res.json({ success: true, session: student })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
