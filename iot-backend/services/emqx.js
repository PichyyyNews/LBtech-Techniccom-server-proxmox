const EMQX_URL = process.env.EMQX_URL || 'http://emqx:18083'
const EMQX_USER = process.env.EMQX_USER || 'tc-iotadmin'
const EMQX_PASS = process.env.EMQX_PASS || 'Techniccom.IoT2026'

/**
 * Auto-provision EMQX MQTT User & ACL for student
 */
export async function provisionMqttUser(studentId, password) {
  const topicPrefix = `lbtech/${studentId}/#`
  const base64Auth = Buffer.from(`${EMQX_USER}:${EMQX_PASS}`).toString('base64')

  try {
    // 1. Add user to EMQX Built-in Database
    const userRes = await fetch(`${EMQX_URL}/api/v5/authentication/password_based:built_in_database/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${base64Auth}`
      },
      body: JSON.stringify({
        user_id: studentId,
        password: password
      })
    })

    let userAdded = userRes.ok
    if (!userAdded && userRes.status === 400) {
      // User might already exist, update password
      const updateRes = await fetch(`${EMQX_URL}/api/v5/authentication/password_based:built_in_database/users/${encodeURIComponent(studentId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${base64Auth}`
        },
        body: JSON.stringify({
          password: password
        })
      })
      userAdded = updateRes.ok
    }

    // 2. Add ACL rule (Publish & Subscribe permissions to student's topic)
    try {
      await fetch(`${EMQX_URL}/api/v5/authorization/sources/built_in_database/rules/users/${encodeURIComponent(studentId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${base64Auth}`
        },
        body: JSON.stringify({
          rules: [
            {
              action: 'all',
              permission: 'allow',
              topic: topicPrefix,
              qos: [0, 1, 2],
              retain: 'all'
            }
          ]
        })
      })
    } catch {
      // ignore ACL optional error
    }

    return {
      username: studentId,
      topicPrefix: `lbtech/${studentId}/`,
      status: userAdded ? 'live_provisioned' : 'ready'
    }
  } catch (err) {
    console.warn(`[EMQX] Auto-provision warning for ${studentId}:`, err.message)
    return {
      username: studentId,
      topicPrefix: `lbtech/${studentId}/`,
      status: 'offline_fallback'
    }
  }
}
