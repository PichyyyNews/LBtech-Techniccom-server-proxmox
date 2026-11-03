import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Pool } = pg

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
      audit_logs: [],
      login_security: {} // identifier -> { failedCount, lockedUntil, lastAttempt }
    }
    this.pgPool = null
    this.isPgReady = false

    // Load local file cache first for immediate responsiveness
    this.load()

    // Initialize PostgreSQL
    this.initPostgres()
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8')
        const parsed = JSON.parse(raw)
        this.data = {
          students: parsed.students || {},
          ct_requests: parsed.ct_requests || [],
          ct_servers: parsed.ct_servers || [],
          audit_logs: parsed.audit_logs || [],
          login_security: parsed.login_security || {}
        }
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

  async initPostgres(attempt = 1) {
    const connectionString =
      process.env.POSTGRES_URL ||
      (process.env.POSTGRES_HOST
        ? `postgresql://${process.env.POSTGRES_USER || 'iotuser'}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || 'Techniccom.Postgres2026!')}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'lbtech_iot'}`
        : null)

    if (!connectionString) {
      console.log('[POSTGRES] No POSTGRES_URL or POSTGRES_HOST provided. Running with local persistent replica.')
      return
    }

    try {
      if (!this.pgPool) {
        this.pgPool = new Pool({
          connectionString,
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
          max: 15
        })
      }

      // Test connection
      const client = await this.pgPool.connect()
      console.log('[POSTGRES] Connected successfully to PostgreSQL database:', process.env.POSTGRES_DB || 'lbtech_iot')

      // Create relational tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS students (
          student_id VARCHAR(64) PRIMARY KEY,
          full_name TEXT,
          project_title TEXT,
          department TEXT,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ct_requests (
          id VARCHAR(64) PRIMARY KEY,
          student_id VARCHAR(64) NOT NULL,
          server_name VARCHAR(128) NOT NULL,
          status VARCHAR(32) NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ct_servers (
          vmid INT PRIMARY KEY,
          student_id VARCHAR(64) NOT NULL,
          name VARCHAR(128) NOT NULL,
          os VARCHAR(64),
          status VARCHAR(32) NOT NULL,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          action VARCHAR(64) NOT NULL,
          details JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS login_security (
          identifier VARCHAR(128) PRIMARY KEY,
          failed_count INT DEFAULT 0,
          locked_until TIMESTAMP,
          last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)

      client.release()
      this.isPgReady = true

      // Auto-migrate from JSON into PostgreSQL if PostgreSQL tables are empty
      await this.syncJsonToPostgres()
    } catch (err) {
      console.error(`[POSTGRES] Connection attempt ${attempt} failed:`, err.message)
      this.isPgReady = false
      if (attempt < 5) {
        console.log(`[POSTGRES] Retrying connection to PostgreSQL in 3s (attempt ${attempt + 1}/5)...`)
        setTimeout(() => this.initPostgres(attempt + 1), 3000)
      }
    }
  }

  async syncJsonToPostgres() {
    if (!this.isPgReady || !this.pgPool) return
    try {
      // 1. Sync students
      for (const [sId, s] of Object.entries(this.data.students || {})) {
        await this.pgPool.query(`
          INSERT INTO students (student_id, full_name, project_title, department, data, updated_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (student_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            project_title = EXCLUDED.project_title,
            department = EXCLUDED.department,
            data = EXCLUDED.data,
            updated_at = CURRENT_TIMESTAMP
        `, [sId, s.fullName || '', s.projectTitle || '', s.department || '', JSON.stringify(s)])
      }

      // 2. Sync ct_requests
      for (const req of (this.data.ct_requests || [])) {
        await this.pgPool.query(`
          INSERT INTO ct_requests (id, student_id, server_name, status, data, created_at)
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            data = EXCLUDED.data
        `, [req.id, req.studentId, req.serverName, req.status, JSON.stringify(req)])
      }

      // 3. Sync ct_servers
      for (const s of (this.data.ct_servers || [])) {
        await this.pgPool.query(`
          INSERT INTO ct_servers (vmid, student_id, name, os, status, data, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (vmid) DO UPDATE SET
            name = EXCLUDED.name,
            os = EXCLUDED.os,
            status = EXCLUDED.status,
            data = EXCLUDED.data,
            updated_at = CURRENT_TIMESTAMP
        `, [Number(s.vmid), s.studentId, s.name, s.os, s.status, JSON.stringify(s)])
      }

      console.log('[POSTGRES] Synchronized all existing student data and servers to PostgreSQL!')
    } catch (err) {
      console.error('[POSTGRES] Error syncing JSON to PostgreSQL:', err)
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
    const updated = {
      ...existing,
      ...student,
      updatedAt: new Date().toISOString()
    }
    this.data.students[student.studentId] = updated
    this.save()

    // Async write-through to PostgreSQL
    if (this.isPgReady && this.pgPool) {
      this.pgPool.query(`
        INSERT INTO students (student_id, full_name, project_title, department, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          project_title = EXCLUDED.project_title,
          department = EXCLUDED.department,
          data = EXCLUDED.data,
          updated_at = CURRENT_TIMESTAMP
      `, [student.studentId, updated.fullName || '', updated.projectTitle || '', updated.department || '', JSON.stringify(updated)])
        .catch(err => console.error('[POSTGRES] saveStudent error:', err.message))
    }

    return updated
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

    // Async write-through to PostgreSQL
    if (this.isPgReady && this.pgPool) {
      this.pgPool.query(`
        INSERT INTO ct_requests (id, student_id, server_name, status, data, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          data = EXCLUDED.data
      `, [req.id, req.studentId, req.serverName, req.status, JSON.stringify(req)])
        .catch(err => console.error('[POSTGRES] saveRequest error:', err.message))
    }

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

    // Async write-through to PostgreSQL
    if (this.isPgReady && this.pgPool) {
      this.pgPool.query(`
        INSERT INTO ct_servers (vmid, student_id, name, os, status, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (vmid) DO UPDATE SET
          name = EXCLUDED.name,
          os = EXCLUDED.os,
          status = EXCLUDED.status,
          data = EXCLUDED.data,
          updated_at = CURRENT_TIMESTAMP
      `, [vmid, normalized.studentId, normalized.name, normalized.os, normalized.status, JSON.stringify(normalized)])
        .catch(err => console.error('[POSTGRES] saveServer error:', err.message))
    }

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

    // Remove from PostgreSQL
    if (this.isPgReady && this.pgPool && !isNaN(num)) {
      this.pgPool.query('DELETE FROM ct_servers WHERE vmid = $1', [num])
        .catch(err => console.error('[POSTGRES] removeServer error:', err.message))
    }

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

    // Write to PostgreSQL
    if (this.isPgReady && this.pgPool) {
      this.pgPool.query(`
        INSERT INTO audit_logs (id, action, details, timestamp)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [entry.id, action, JSON.stringify(details)])
        .catch(err => console.error('[POSTGRES] addLog error:', err.message))
    }

    return entry
  }

  getAuditLogs(limit = 100) {
    return this.data.audit_logs.slice(0, limit)
  }

  // --- Brute-Force Password Guessing Protection (ระบบป้องกันการเดารหัสผ่านซ้ำๆ) ---
  checkLoginLockout(identifier) {
    const id = String(identifier || '').trim().toLowerCase()
    const sec = this.data.login_security[id]
    if (!sec) {
      return { locked: false, remainingMinutes: 0 }
    }

    if (sec.lockedUntil) {
      const now = Date.now()
      if (now < sec.lockedUntil) {
        const remainingMinutes = Math.ceil((sec.lockedUntil - now) / (60 * 1000))
        return { locked: true, remainingMinutes }
      } else {
        // Lockout expired, reset
        delete sec.lockedUntil
        sec.failedCount = 0
        this.save()
      }
    }

    return { locked: false, remainingMinutes: 0 }
  }

  recordFailedAttempt(identifier, maxAttempts = 5, lockoutMinutes = 10) {
    const id = String(identifier || '').trim().toLowerCase()
    if (!this.data.login_security[id]) {
      this.data.login_security[id] = { failedCount: 0, lastAttempt: Date.now() }
    }

    const sec = this.data.login_security[id]
    sec.failedCount = (sec.failedCount || 0) + 1
    sec.lastAttempt = Date.now()

    let locked = false
    let remainingAttempts = Math.max(0, maxAttempts - sec.failedCount)

    if (sec.failedCount >= maxAttempts) {
      sec.lockedUntil = Date.now() + (lockoutMinutes * 60 * 1000)
      locked = true
      this.addLog('LOGIN_LOCKOUT_TRIGGERED', {
        identifier: id,
        failedCount: sec.failedCount,
        lockoutMinutes
      })
    }

    this.save()

    // Write to PostgreSQL
    if (this.isPgReady && this.pgPool) {
      const lockedDate = sec.lockedUntil ? new Date(sec.lockedUntil) : null
      this.pgPool.query(`
        INSERT INTO login_security (identifier, failed_count, locked_until, last_attempt)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (identifier) DO UPDATE SET
          failed_count = EXCLUDED.failed_count,
          locked_until = EXCLUDED.locked_until,
          last_attempt = CURRENT_TIMESTAMP
      `, [id, sec.failedCount, lockedDate])
        .catch(() => {})
    }

    return {
      locked,
      failedCount: sec.failedCount,
      remainingAttempts,
      lockoutMinutes
    }
  }

  resetLoginAttempts(identifier) {
    const id = String(identifier || '').trim().toLowerCase()
    if (this.data.login_security[id]) {
      delete this.data.login_security[id]
      this.save()

      if (this.isPgReady && this.pgPool) {
        this.pgPool.query('DELETE FROM login_security WHERE identifier = $1', [id])
          .catch(() => {})
      }
    }
  }
}

export const db = new Database()
