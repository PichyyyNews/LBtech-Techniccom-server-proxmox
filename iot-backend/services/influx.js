import crypto from 'crypto'

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086'
const INFLUX_ADMIN_USER = process.env.INFLUX_ADMIN_USER || 'iotadmin'
const INFLUX_ADMIN_PASS = process.env.INFLUX_ADMIN_PASS || 'Techniccom.Influx2026'
const INFLUX_ORG = process.env.INFLUX_ORG || 'lbtech'
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || ''

let cachedOrgId = null
let cachedAdminToken = INFLUX_TOKEN

/**
 * Get or lookup Org ID in InfluxDB
 */
async function getOrgId() {
  if (cachedOrgId) return cachedOrgId

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (cachedAdminToken) {
      headers['Authorization'] = `Token ${cachedAdminToken}`
    } else {
      headers['Authorization'] = `Basic ${Buffer.from(`${INFLUX_ADMIN_USER}:${INFLUX_ADMIN_PASS}`).toString('base64')}`
    }

    const res = await fetch(`${INFLUX_URL}/api/v2/orgs?org=${encodeURIComponent(INFLUX_ORG)}`, {
      method: 'GET',
      headers
    })

    if (res.ok) {
      const data = await res.json()
      if (data.orgs && data.orgs.length > 0) {
        cachedOrgId = data.orgs[0].id
        return cachedOrgId
      }
    }
  } catch (err) {
    console.warn('[InfluxDB] Could not fetch org ID from API:', err.message)
  }
  return 'lbtech-default-org'
}

/**
 * Auto-provision InfluxDB Bucket, User & Auth Token for student
 */
export async function provisionStudentTelemetry(studentId, studentPassword = '') {
  const bucketName = `telemetry-${studentId}`
  const deterministicToken = `lbtech_${studentId}_${crypto.createHash('sha256').update(`${studentId}_${INFLUX_ADMIN_PASS}`).digest('hex').substring(0, 32)}`

  let createdBucket = false
  let createdUser = false

  try {
    const orgId = await getOrgId()
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': cachedAdminToken
        ? `Token ${cachedAdminToken}`
        : `Basic ${Buffer.from(`${INFLUX_ADMIN_USER}:${INFLUX_ADMIN_PASS}`).toString('base64')}`
    }

    // 1. Create or Check Bucket
    const bucketRes = await fetch(`${INFLUX_URL}/api/v2/buckets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orgID: orgId,
        name: bucketName,
        retentionRules: [
          {
            type: 'expire',
            everySeconds: 2592000 // 30 Days
          }
        ]
      })
    })

    if (bucketRes.ok || bucketRes.status === 422) { // 422 = already exists
      createdBucket = true
    }

    // 2. Create User for InfluxDB Web UI login
    if (studentPassword) {
      try {
        const userRes = await fetch(`${INFLUX_URL}/api/v2/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: studentId })
        })

        let userId = null
        if (userRes.ok) {
          const userData = await userRes.json()
          userId = userData.id
          createdUser = true
        }

        if (userId) {
          // Set password
          await fetch(`${INFLUX_URL}/api/v2/users/${userId}/password`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ password: studentPassword })
          })

          // Add to Org
          await fetch(`${INFLUX_URL}/api/v2/orgs/${orgId}/members`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: userId })
          })
        }
      } catch (uErr) {
        console.warn(`[InfluxDB] User provisioning error for ${studentId}:`, uErr.message)
      }
    }

    // 3. Create Student Read/Write Authorization Token
    const authRes = await fetch(`${INFLUX_URL}/api/v2/authorizations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orgID: orgId,
        description: `Student Access Token for ${studentId}`,
        permissions: [
          {
            action: 'read',
            resource: { type: 'buckets', name: bucketName, orgID: orgId }
          },
          {
            action: 'write',
            resource: { type: 'buckets', name: bucketName, orgID: orgId }
          }
        ]
      })
    })

    if (authRes.ok) {
      const authData = await authRes.json()
      if (authData.token) {
        return {
          bucket: bucketName,
          token: authData.token,
          org: INFLUX_ORG,
          userReady: createdUser,
          status: 'live_provisioned'
        }
      }
    }
  } catch (err) {
    console.warn(`[InfluxDB] Auto-provision warning for ${studentId}:`, err.message)
  }

  return {
    bucket: bucketName,
    token: deterministicToken,
    org: INFLUX_ORG,
    userReady: true,
    status: createdBucket ? 'bucket_ready' : 'fallback_ready'
  }
}

/**
 * Convert JSON telemetry into InfluxDB Line Protocol and write to InfluxDB
 */
export async function writeTelemetryToInflux(studentId, payload) {
  const bucket = `telemetry-${studentId}`
  const measurement = payload.sensor || payload.measurement || 'telemetry'
  const device = payload.device || payload.sensor || 'esp32'

  // Extract fields (numeric, boolean, string)
  const fields = []
  for (const [key, val] of Object.entries(payload)) {
    if (['sensor', 'device', 'studentId', 'timestamp', 'measurement'].includes(key)) continue

    if (typeof val === 'number') {
      fields.push(`${key}=${val}`)
    } else if (typeof val === 'boolean') {
      fields.push(`${key}=${val ? 'true' : 'false'}`)
    } else if (typeof val === 'string') {
      fields.push(`${key}="${val.replace(/"/g, '\\"')}"`)
    }
  }

  if (fields.length === 0) {
    fields.push('value=1')
  }

  const timestamp = payload.timestamp
    ? (String(payload.timestamp).length === 10 ? `${payload.timestamp}000000000` : `${payload.timestamp}000000`)
    : `${Date.now()}000000`

  const lineProtocol = `${measurement},student_id=${studentId},device=${device} ${fields.join(',')} ${timestamp}`

  try {
    const headers = { 'Content-Type': 'text/plain; charset=utf-8' }
    if (cachedAdminToken) {
      headers['Authorization'] = `Token ${cachedAdminToken}`
    } else {
      headers['Authorization'] = `Basic ${Buffer.from(`${INFLUX_ADMIN_USER}:${INFLUX_ADMIN_PASS}`).toString('base64')}`
    }

    const res = await fetch(`${INFLUX_URL}/api/v2/write?org=${encodeURIComponent(INFLUX_ORG)}&bucket=${encodeURIComponent(bucket)}&precision=ns`, {
      method: 'POST',
      headers,
      body: lineProtocol
    })

    return {
      success: res.ok || res.status === 204,
      status: res.status,
      lineProtocol
    }
  } catch (err) {
    console.warn(`[InfluxDB] Write warning for ${studentId}:`, err.message)
    return {
      success: false,
      error: err.message,
      lineProtocol
    }
  }
}
