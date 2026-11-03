import express from 'express'
import { db } from '../database.js'
import { writeTelemetryToInflux } from '../services/influx.js'
import { publishMqttMessage } from '../services/emqx.js'

const router = express.Router()

/**
 * POST /api/v1/telemetry
 * Ingest HTTP JSON sensor data and forward to InfluxDB v2 & EMQX Broker
 */
router.post('/telemetry', async (req, res) => {
  try {
    // 1. Authenticate Request
    const studentId = (
      req.headers['x-student-id'] ||
      req.body.studentId ||
      req.query.studentId ||
      ''
    ).trim()

    const projectToken = (
      req.headers['x-project-token'] ||
      req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
      req.body.token ||
      req.query.token ||
      ''
    ).trim()

    if (!studentId) {
      return res.status(401).json({
        error: 'Missing authentication: X-Student-ID header is required'
      })
    }

    let student = db.getStudent(studentId)

    // Verify token if student exists in database
    if (student && student.password && projectToken) {
      if (student.password !== projectToken && student.token !== projectToken) {
        return res.status(403).json({
          error: 'Invalid authentication: X-Project-Token does not match'
        })
      }
    } else if (!student) {
      // Auto-register student if missing
      student = {
        studentId,
        fullName: `Student ${studentId}`,
        projectTitle: 'IoT Telemetry Device',
        department: 'เทคโนโลยีคอมพิวเตอร์',
        password: projectToken || '07072569',
        token: projectToken || '07072569',
        influxBucket: `telemetry-${studentId}`,
        influxToken: `lbtech_${studentId}_token`,
        createdAt: new Date().toISOString()
      }
      db.saveStudent(student)
    }

    const payload = req.body || {}
    console.log(`[TELEMETRY] Received data from ${studentId}:`, JSON.stringify(payload))

    const topic = `lbtech/${studentId}/telemetry`
    const bucket = student.influxBucket || `telemetry-${studentId}`

    // 2. Forward to InfluxDB v2 (Line Protocol)
    const influxRes = await writeTelemetryToInflux(studentId, payload)

    // 3. Forward to EMQX Broker (MQTT Publish)
    const emqxRes = await publishMqttMessage(topic, payload)

    // 4. Log in Audit History
    db.addLog('TELEMETRY_INGEST', {
      studentId,
      topic,
      bucket,
      sensor: payload.sensor || 'generic',
      influxSuccess: influxRes.success,
      emqxSuccess: emqxRes.success
    })

    res.status(200).json({
      success: true,
      message: 'Telemetry received and forwarded successfully',
      studentId,
      destination: {
        influxdb: {
          bucket,
          org: 'lbtech',
          status: influxRes.success ? 'written' : 'queued_or_fallback',
          lineProtocol: influxRes.lineProtocol
        },
        emqx: {
          topic,
          status: emqxRes.success ? 'published' : 'broker_queued'
        }
      },
      receivedPayload: payload,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    console.error('[TELEMETRY] Ingest error:', err)
    res.status(500).json({
      error: 'Internal Server Error while ingesting telemetry: ' + err.message
    })
  }
})

export default router
