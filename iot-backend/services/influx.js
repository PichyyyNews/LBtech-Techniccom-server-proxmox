import crypto from 'crypto'

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086'
const INFLUX_ADMIN_USER = process.env.INFLUX_ADMIN_USER || 'iotadmin'
const INFLUX_ADMIN_PASS = process.env.INFLUX_ADMIN_PASS || 'Techniccom.Influx2026'
const INFLUX_ORG = process.env.INFLUX_ORG || 'lbtech'
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '3oSD6wIOp8AiuGi8RIByohv-GufR7fIAaT5aHVB0eQOy2eyGOVucgdt35zx_ZS4FOdKbYsGBdtzTpYQl0L29CA=='

let cachedOrgId = null
let cachedAdminToken = INFLUX_TOKEN

function getAuthHeader() {
  if (cachedAdminToken) {
    return { 'Authorization': `Token ${cachedAdminToken}` }
  }
  return { 'Authorization': `Basic ${Buffer.from(`${INFLUX_ADMIN_USER}:${INFLUX_ADMIN_PASS}`).toString('base64')}` }
}

/**
 * Get or lookup Org ID in InfluxDB
 */
async function getOrgId() {
  if (cachedOrgId) return cachedOrgId

  try {
    const res = await fetch(`${INFLUX_URL}/api/v2/orgs?org=${encodeURIComponent(INFLUX_ORG)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      }
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
  return 'a4f661eac5793a0e' // Default fallback ID for lbtech
}

/**
 * Auto-provision InfluxDB Bucket, User & Auth Token for student using their REGISTERED PASSWORD
 */
export async function provisionStudentTelemetry(studentId, studentPassword = '') {
  const bucketName = `telemetry-${studentId}`
  const deterministicToken = `lbtech_${studentId}_${crypto.createHash('sha256').update(`${studentId}_${INFLUX_ADMIN_PASS}`).digest('hex').substring(0, 32)}`

  let userId = null
  let bucketId = null
  let liveToken = deterministicToken

  try {
    const orgId = await getOrgId()
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    }

    // 1. Create or Find User in InfluxDB
    try {
      const userListRes = await fetch(`${INFLUX_URL}/api/v2/users?name=${encodeURIComponent(studentId)}`, {
        method: 'GET',
        headers
      })

      if (userListRes.ok) {
        const userData = await userListRes.json()
        if (userData.users && userData.users.length > 0) {
          userId = userData.users[0].id
        }
      }

      if (!userId) {
        const createUserRes = await fetch(`${INFLUX_URL}/api/v2/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: studentId })
        })
        if (createUserRes.ok) {
          const newUserData = await createUserRes.json()
          userId = newUserData.id
          console.log(`[InfluxDB] Created user ${studentId} (${userId})`)
        }
      }

      // If password provided, update InfluxDB user password to match portal password
      if (userId && studentPassword) {
        const passRes = await fetch(`${INFLUX_URL}/api/v2/users/${userId}/password`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ password: studentPassword })
        })
        if (passRes.ok || passRes.status === 204) {
          console.log(`[InfluxDB] Synchronized password for ${studentId}`)
        } else {
          console.warn(`[InfluxDB] Set password failed for ${studentId}: HTTP ${passRes.status}`)
        }
      }

      // Add user to Org members
      if (userId && orgId) {
        await fetch(`${INFLUX_URL}/api/v2/orgs/${orgId}/members`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ id: userId })
        }).catch(() => {})
      }
    } catch (uErr) {
      console.warn(`[InfluxDB] User provisioning error for ${studentId}:`, uErr.message)
    }

    // 2. Create or Check Bucket
    try {
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

      if (bucketRes.ok) {
        const bData = await bucketRes.json()
        bucketId = bData.id
      } else if (bucketRes.status === 422) {
        // Already exists, fetch bucket id
        const getBRes = await fetch(`${INFLUX_URL}/api/v2/buckets?name=${encodeURIComponent(bucketName)}&orgID=${orgId}`, {
          method: 'GET',
          headers
        })
        if (getBRes.ok) {
          const bData = await getBRes.json()
          if (bData.buckets && bData.buckets.length > 0) {
            bucketId = bData.buckets[0].id
          }
        }
      }
    } catch (bErr) {
      console.warn(`[InfluxDB] Bucket error for ${studentId}:`, bErr.message)
    }

    // 3. Create Student Authorization Token
    try {
      const authRes = await fetch(`${INFLUX_URL}/api/v2/authorizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orgID: orgId,
          description: `Student Token for ${studentId}`,
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
          liveToken = authData.token
        }
      }
    } catch (aErr) {
      console.warn(`[InfluxDB] Token error for ${studentId}:`, aErr.message)
    }

    return {
      bucket: bucketName,
      token: liveToken,
      org: INFLUX_ORG,
      userReady: !!userId,
      status: 'live_provisioned'
    }
  } catch (err) {
    console.warn(`[InfluxDB] Auto-provision warning for ${studentId}:`, err.message)
  }

  return {
    bucket: bucketName,
    token: deterministicToken,
    org: INFLUX_ORG,
    userReady: true,
    status: 'fallback_ready'
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
    const headers = {
      'Content-Type': 'text/plain; charset=utf-8',
      ...getAuthHeader()
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
