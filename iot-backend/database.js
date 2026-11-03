import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'iot_storage.json')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

class Database {
  constructor() {
    this.data = {
      students: {},
      ct_requests: [],
      ct_servers: [],
      audit_logs: []
    }
    this.load()
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8')
        this.data = JSON.parse(raw)
      } else {
        this.save()
      }
    } catch (err) {
      console.error('[DB] Error loading database:', err)
    }
  }

  save() {
    try {
      const tempPath = `${DB_FILE}.tmp`
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8')
      fs.renameSync(tempPath, DB_FILE)
    } catch (err) {
      console.error('[DB] Error saving database:', err)
    }
  }

  // --- Students ---
  getStudent(studentId) {
    return this.data.students[studentId] || null
  }

  getAllStudents() {
    return Object.values(this.data.students)
  }

  saveStudent(student) {
    const existing = this.data.students[student.studentId] || {}
    this.data.students[student.studentId] = {
      ...existing,
      ...student,
      updatedAt: new Date().toISOString()
    }
    this.save()
    return this.data.students[student.studentId]
  }

  // --- CT Requests ---
  getRequests(studentId = null) {
    if (studentId) {
      return this.data.ct_requests.filter(r => r.studentId === studentId)
    }
    return this.data.ct_requests
  }

  getRequestById(id) {
    return this.data.ct_requests.find(r => r.id === id) || null
  }

  saveRequest(req) {
    const index = this.data.ct_requests.findIndex(r => r.id === req.id)
    if (index >= 0) {
      this.data.ct_requests[index] = { ...this.data.ct_requests[index], ...req }
    } else {
      this.data.ct_requests.unshift(req)
    }
    this.save()
    return req
  }

  // --- CT Servers ---
  getServers(studentId = null) {
    if (studentId) {
      return this.data.ct_servers.filter(s => s.studentId === studentId)
    }
    return this.data.ct_servers
  }

  getServerByVmid(vmid) {
    return this.data.ct_servers.find(s => s.vmid === Number(vmid)) || null
  }

  saveServer(server) {
    const vmid = Number(server.vmid)
    const index = this.data.ct_servers.findIndex(s => s.vmid === vmid)
    const normalized = { ...server, vmid }
    if (index >= 0) {
      this.data.ct_servers[index] = { ...this.data.ct_servers[index], ...normalized }
    } else {
      this.data.ct_servers.unshift(normalized)
    }
    this.save()
    return normalized
  }

  deleteServer(vmid) {
    return this.removeServer(vmid)
  }

  removeServer(vmid) {
    const num = Number(vmid)
    this.data.ct_servers = this.data.ct_servers.filter(s => {
      if (!isNaN(num) && s.vmid === num) return false
      if (String(s.vmid) === String(vmid)) return false
      if (s.containerId === vmid) return false
      if (s.name === vmid) return false
      return true
    })
    this.save()
    return true
  }

  // --- Audit Logs ---
  addLog(action, details = {}) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      action,
      details,
      timestamp: new Date().toISOString()
    }
    this.data.audit_logs.unshift(entry)
    if (this.data.audit_logs.length > 500) {
      this.data.audit_logs.pop()
    }
    this.save()
    return entry
  }
}

export const db = new Database()
