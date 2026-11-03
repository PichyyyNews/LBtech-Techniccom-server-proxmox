import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'

import authRoutes from './routes/auth.js'
import ctRoutes from './routes/ct.js'
import adminRoutes from './routes/admin.js'
import telemetryRoutes from './routes/telemetry.js'
import { db } from './database.js'
import { createTerminalSession } from './services/docker_provisioner.js'
import { startSshBastion } from './services/ssh_bastion.js'

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
    version: '1.1.0',
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
      { id: '69319090023', name: 'นางสาวนัฐฐา แสงบุญเกิด', project: 'ระบบบริหารจัดการคลินิกเวชกรรม', dept: 'เทคโนโลยีคอมพิวเตอร์', pass: 'Std@69319090023' }
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
        influxToken: `lbtech_${item.id}_token`,
        influxOrg: 'lbtech',
        mqttUsername: item.id,
        mqttTopicPrefix: `lbtech/${item.id}/`,
        createdAt: new Date().toISOString()
      })
    }
    console.log('[DB] Seeding completed successfully.')
  }
}

seedIfEmpty()

// Create HTTP and WebSocket Server for Web Terminal
const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  if (url.pathname.startsWith('/api/ct/terminal/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, url)
    })
  } else {
    socket.destroy()
  }
})

wss.on('connection', async (ws, req, url) => {
  const parts = url.pathname.split('/')
  const targetId = parts[parts.length - 1]
  console.log(`[WS-TERMINAL] Client connected for terminal: ${targetId}`)

  // Find server info from database
  const serverObj = db.getServerByVmid(targetId) ||
    db.getServers().find(s => s.containerId === targetId || s.name === targetId || String(s.vmid) === targetId)

  const containerIdentifier = serverObj?.containerId || serverObj?.containerName || targetId

  try {
    const session = await createTerminalSession(containerIdentifier, { cols: 80, rows: 24 })

    // Welcome banner
    const welcome = `\r\n\x1b[32m=== LBTech Cloud Container Terminal ===\x1b[0m\r\n` +
      `\x1b[90mConnected to: ${serverObj?.name || targetId} (${serverObj?.os || 'Linux'})\x1b[0m\r\n` +
      `\x1b[90mWorkspace: /workspace (Persistent Storage)\x1b[0m\r\n\r\n`
    ws.send(welcome)

    // Pipe Container Output -> WebSocket Client
    session.stream.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk)
      }
    })

    session.stream.on('end', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send('\r\n\x1b[33m[Session Closed]\x1b[0m\r\n')
        ws.close()
      }
    })

    // Pipe WebSocket Client -> Container Stdin
    ws.on('message', (msg) => {
      try {
        const text = msg.toString()
        if (text.startsWith('{') && text.endsWith('}')) {
          const parsed = JSON.parse(text)
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            session.resize(parsed.cols, parsed.rows)
            return
          }
        }
      } catch {}

      session.stream.write(msg)
    })

    ws.on('close', () => {
      console.log(`[WS-TERMINAL] Connection closed for: ${targetId}`)
      session.stream.end()
    })
  } catch (err) {
    console.error(`[WS-TERMINAL] Failed session for ${containerIdentifier}:`, err.message)
    ws.send(`\r\n\x1b[31m[Console Error] ไม่สามารถเชื่อมต่อ TTY ของคอนเทนเนอร์ได้: ${err.message}\x1b[0m\r\n` +
      `\x1b[90mกำลังเปิดโหมดจำลองคำสั่งฉุกเฉิน...\x1b[0m\r\n\r\nroot@${serverObj?.name || 'lbtech'}:~# `)

    ws.on('message', (msg) => {
      const cmd = msg.toString().trim()
      if (cmd === 'help') {
        ws.send(`\r\nคำสั่งที่ใช้ได้: help, uname -a, free -m, df -h, ls -la, exit\r\nroot@${serverObj?.name || 'lbtech'}:~# `)
      } else if (cmd === 'uname -a') {
        ws.send(`\r\nLinux ${serverObj?.name || 'lbtech'} 6.8.12-2-pve #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\r\nroot@${serverObj?.name || 'lbtech'}:~# `)
      } else if (cmd) {
        ws.send(`\r\n[Mock Command Executed]: ${cmd}\r\nroot@${serverObj?.name || 'lbtech'}:~# `)
      }
    })
  }
})

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`)
  console.log(`🚀 LBTech Centralized IoT & Micro-Container API`)
  console.log(`📡 HTTP Server: http://0.0.0.0:${PORT}`)
  console.log(`🖥️ WebSocket Terminal: ws://0.0.0.0:${PORT}/api/ct/terminal/:id`)
  console.log(`====================================================`)
})

// Start Smart SSH Bastion for Public Tailscale Funnel Access
const SSH_BASTION_PORT = Number(process.env.SSH_BASTION_PORT) || 2222
startSshBastion(SSH_BASTION_PORT)
