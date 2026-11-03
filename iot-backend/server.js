import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/auth.js'
import ctRoutes from './routes/ct.js'
import adminRoutes from './routes/admin.js'
import telemetryRoutes from './routes/telemetry.js'
import { db } from './database.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('th-TH')}] ${req.method} ${req.url}`)
  next()
})

// Mount API Routes
app.use('/api/auth', authRoutes)
app.use('/api/ct', ctRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/v1', telemetryRoutes)
app.use('/api', telemetryRoutes)

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LBTech IoT & Cloud CT Provisioning API',
    version: '1.0.0',
    time: new Date().toISOString(),
    stats: {
      registeredStudents: db.getAllStudents().length,
      ctRequests: db.getRequests().length,
      activeServers: db.getServers().length
    }
  })
})

// Seed Student Sample Data if Database is completely empty
function seedIfEmpty() {
  const students = db.getAllStudents()
  if (students.length === 0) {
    console.log('[DB] Seeding registered student roster from LBTech CloudPanel database...')
    const sampleRoster = [
      { id: '69319090021', name: 'นางสาวกาญจน์เกล้า แซ่ลิ้ม', project: 'ระบบบริหารสต็อกสินค้าและจุดขาย POS', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090021' },
      { id: '69319090022', name: 'นางสาวฐิติพร เจริญสลุง', project: 'ระบบแคตตาล็อกหน้าร้านค้าออนไลน์', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090022' },
      { id: '69319090024', name: 'นายทินภัทร มะนาวหวาน', project: 'ระบบจองห้องพักและห้องประชุมอัจฉริยะ', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090024' },
      { id: '69319090026', name: 'นายธีรพันธ์ เต็งน้อย', project: 'แพลตฟอร์มจำหน่ายไอเทมเกมออนไลน์', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090026' },
      { id: '69319090027', name: 'นายนครินทร์ แก้วโสตย', project: 'FitZone ศูนย์บริหารสมาชิกฟิตเนส', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090027' },
      { id: '69319090028', name: 'นายปัญญพัฒน์ บุญเกตุ', project: 'ระบบตรวจสอบลิขสิทธิ์ซอฟต์แวร์ Gaming Store', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090028' },
      { id: '69319090031', name: 'นายพีรพัฒน์ พาหุรัตน์', project: 'PULSE TICKET ระบบจำหน่ายบัตรคอนเสิร์ต', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090031' },
      { id: '69319090032', name: 'นายภาณุวัฒน์ ปั่นสันเที่ยะ', project: 'Dream_OS ระบบจัดการเครื่องแม่ข่ายบนเว็บ', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090032' },
      { id: '69319090034', name: 'นายรชต เปลี่ยนศรี', project: 'RACHATA SHOP ร้านรองเท้าบาสเกตบอล', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090034' }
    ]

    for (const item of sampleRoster) {
      db.saveStudent({
        studentId: item.id,
        fullName: item.name,
        projectTitle: item.project,
        department: item.dept,
        password: item.pass,
        token: item.pass,
        influxBucket: `telemetry-${item.id}`,
        influxToken: `lbtech_${item.id}_token_live`,
        influxOrg: 'lbtech',
        mqttUsername: item.id,
        mqttTopicPrefix: `lbtech/${item.id}/`,
        createdAt: new Date().toISOString()
      })
    }

    // Add 1 sample pending request for preview
    db.saveRequest({
      id: 'req_seed_sample_01',
      studentId: '69319090024',
      fullName: 'นายทินภัทร มะนาวหวาน',
      projectTitle: 'ระบบจองห้องพักและห้องประชุมอัจฉริยะ',
      serverName: 'booking-api',
      os: 'debian-12',
      vcpu: 1,
      ram: 1024,
      disk: 10,
      purpose: 'รัน Node.js API และเชื่อมต่อ InfluxDB บันทึกสถานะการใช้งานห้องประชุมแบบ Real-time',
      status: 'pending',
      createdAt: new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    })

    console.log('[DB] Seeding completed successfully.')
  }
}

seedIfEmpty()

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`)
  console.log(`🚀 LBTech Centralized IoT & CT Provisioning Backend`)
  console.log(`📡 Listening on: http://0.0.0.0:${PORT}`)
  console.log(`====================================================`)
})
