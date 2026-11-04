import crypto from 'crypto'

const INFLUX_URL = process.env.INFLUX_URL || 'http://influxdb:8086'
const INFLUX_ADMIN_USER = process.env.INFLUX_ADMIN_USER || 'iotadmin'
const INFLUX_ADMIN_PASS = process.env.INFLUX_ADMIN_PASS || 'Techniccom.Influx2026'
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || '3oSD6wIOp8AiuGi8RIByohv-GufR7fIAaT5aHVB0eQOy2eyGOVucgdt35zx_ZS4FOdKbYsGBdtzTpYQl0L29CA=='

function getAuthHeader() {
  if (INFLUX_TOKEN) {
    return { 'Authorization': `Token ${INFLUX_TOKEN}` }
  }
  return { 'Authorization': `Basic ${Buffer.from(`${INFLUX_ADMIN_USER}:${INFLUX_ADMIN_PASS}`).toString('base64')}` }
}

/**
 * Get or create isolated Org ID for student (e.g. std-69123456789)
 */
async function getOrCreateStudentOrg(studentId) {
  const orgName = `std-${studentId}`
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader()
  }

  try {
    const res = await fetch(`${INFLUX_URL}/api/v2/orgs?org=${encodeURIComponent(orgName)}`, {
      method: 'GET',
      headers
    })

    if (res.ok) {
      const data = await res.json()
      if (data.orgs && data.orgs.length > 0) {
        return { orgId: data.orgs[0].id, orgName }
      }
    }

    // Create if not exists
    const createRes = await fetch(`${INFLUX_URL}/api/v2/orgs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: orgName })
    })

    if (createRes.ok) {
      const data = await createRes.json()
      return { orgId: data.id, orgName }
    }
  } catch (err) {
    console.warn(`[InfluxDB] Org lookup error for ${orgName}:`, err.message)
  }

  return { orgId: null, orgName }
}

/**
 * Auto-provision InfluxDB Isolated Org, User & Auth Token for student
 */
export async function provisionStudentTelemetry(studentId, studentPassword = '') {
  const bucketName = 'telemetry'
  const deterministicToken = `lbtech_${studentId}_${crypto.createHash('sha256').update(`${studentId}_${INFLUX_ADMIN_PASS}`).digest('hex').substring(0, 32)}`

  let userId = null
  let bucketId = null
  let liveToken = deterministicToken

  try {
    const { orgId, orgName } = await getOrCreateStudentOrg(studentId)
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

      // If password provided, update InfluxDB user password to match portal password (enforcing InfluxDB's >= 8 char requirement)
      const validInfluxPassword = (studentPassword && studentPassword.length >= 8)
        ? studentPassword
        : (studentPassword ? studentPassword.padEnd(8, '0') : 'Techniccom2026')

      if (userId && validInfluxPassword) {
        const passRes = await fetch(`${INFLUX_URL}/api/v2/users/${userId}/password`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ password: validInfluxPassword })
        })
        if (passRes.ok || passRes.status === 204) {
          console.log(`[InfluxDB] Synchronized password for ${studentId}`)
        } else {
          const errTxt = await passRes.text().catch(() => '')
          console.warn(`[InfluxDB] Password sync failed for ${studentId}:`, errTxt)
        }
      }

      // Add user as OWNER of their isolated Org
      if (userId && orgId) {
        await fetch(`${INFLUX_URL}/api/v2/orgs/${orgId}/owners`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ id: userId })
        }).catch(() => {})
      }
    } catch (uErr) {
      console.warn(`[InfluxDB] User provisioning error for ${studentId}:`, uErr.message)
    }

    // 2. Create or Check Bucket 'telemetry' in student's isolated Org
    try {
      if (orgId) {
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
        }
      }
    } catch (bErr) {
      console.warn(`[InfluxDB] Bucket error for ${studentId}:`, bErr.message)
    }

    // 3. Create Student Authorization Token
    try {
      if (orgId) {
        const authRes = await fetch(`${INFLUX_URL}/api/v2/authorizations`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            orgID: orgId,
            description: `Student Token for ${studentId}`,
            permissions: [
              {
                action: 'read',
                resource: { type: 'buckets', orgID: orgId }
              },
              {
                action: 'write',
                resource: { type: 'buckets', orgID: orgId }
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
      }
    } catch (aErr) {
      console.warn(`[InfluxDB] Token error for ${studentId}:`, aErr.message)
    }

    return {
      bucket: bucketName,
      token: liveToken,
      org: orgName,
      userReady: !!userId,
      status: 'isolated_provisioned'
    }
  } catch (err) {
    console.warn(`[InfluxDB] Auto-provision warning for ${studentId}:`, err.message)
  }

  return {
    bucket: bucketName,
    token: deterministicToken,
    org: `std-${studentId}`,
    userReady: true,
    status: 'fallback_ready'
  }
}

/**
 * Convert JSON telemetry into InfluxDB Line Protocol and write to InfluxDB
 */
export async function writeTelemetryToInflux(studentId, payload) {
  const orgName = `std-${studentId}`
  const bucket = 'telemetry'
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

    const res = await fetch(`${INFLUX_URL}/api/v2/write?org=${encodeURIComponent(orgName)}&bucket=${encodeURIComponent(bucket)}&precision=ns`, {
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

/**
 * Synchronize all student accounts, organizations, buckets, and passwords in InfluxDB
 */
export async function syncAllStudentsInflux(students = []) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader()
  }

  // 1. Get existing users
  const uRes = await fetch(`${INFLUX_URL}/api/v2/users?limit=100`, { headers })
  const uData = await uRes.json().catch(() => ({ users: [] }))
  const userMap = {}
  for (const u of (uData.users || [])) {
    userMap[u.name] = u.id
  }

  // 2. Get existing orgs
  const oRes = await fetch(`${INFLUX_URL}/api/v2/orgs?limit=100`, { headers })
  const oData = await oRes.json().catch(() => ({ orgs: [] }))
  const orgMap = {}
  for (const o of (oData.orgs || [])) {
    orgMap[o.name] = o.id
  }

  const results = []

  for (const s of students) {
    const studentId = s.studentId
    let password = s.password || 'Techniccom2026'
    if (password.length < 8) {
      password = password.padEnd(8, '0')
    }

    let userId = userMap[studentId]
    if (!userId) {
      const createRes = await fetch(`${INFLUX_URL}/api/v2/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: studentId })
      })
      if (createRes.ok) {
        const nu = await createRes.json()
        userId = nu.id
        userMap[studentId] = userId
      }
    }

    if (userId) {
      await fetch(`${INFLUX_URL}/api/v2/users/${userId}/password`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ password })
      }).catch(() => {})
    }

    const orgName = `std-${studentId}`
    let orgId = orgMap[orgName]
    if (!orgId) {
      const coRes = await fetch(`${INFLUX_URL}/api/v2/orgs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: orgName })
      })
      if (coRes.ok) {
        const no = await coRes.json()
        orgId = no.id
        orgMap[orgName] = orgId
      }
    }

    if (userId && orgId) {
      await fetch(`${INFLUX_URL}/api/v2/orgs/${orgId}/owners`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: userId })
      }).catch(() => {})
      await fetch(`${INFLUX_URL}/api/v2/orgs/${orgId}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: userId })
      }).catch(() => {})
    }

    if (orgId) {
      const bRes = await fetch(`${INFLUX_URL}/api/v2/buckets?orgID=${orgId}`, { headers })
      const bData = await bRes.json().catch(() => ({ buckets: [] }))
      const hasBucket = (bData.buckets || []).some(b => b.name === 'telemetry')
      if (!hasBucket) {
        await fetch(`${INFLUX_URL}/api/v2/buckets`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            orgID: orgId,
            name: 'telemetry',
            retentionRules: [{ type: 'expire', everySeconds: 2592000 }]
          })
        }).catch(() => {})
      }
    }

    // Test signin
    const auth = Buffer.from(`${studentId}:${password}`).toString('base64')
    const testRes = await fetch(`${INFLUX_URL}/api/v2/signin`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}` }
    }).catch(() => ({ ok: false }))

    results.push({
      studentId,
      orgName,
      passwordLen: password.length,
      signinOk: testRes.ok || testRes.status === 204
    })
  }

  return {
    success: true,
    total: students.length,
    successfulLogins: results.filter(r => r.signinOk).length,
    details: results
  }
}
