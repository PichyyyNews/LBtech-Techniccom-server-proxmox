import Docker from 'dockerode'
import fs from 'fs'
import path from 'path'

// Connect to Docker daemon via local unix socket
export const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const IMAGE_MAP = {
  'debian-12': 'debian:12-slim',
  'ubuntu-24': 'ubuntu:24.04',
  'alpine-3': 'alpine:latest'
}

const OS_LABELS = {
  'debian-12': 'Debian 12 (Bookworm)',
  'ubuntu-24': 'Ubuntu 24.04 LTS',
  'alpine-3': 'Alpine Linux 3.22'
}

/**
 * Sanitize studentId and serverName for 100% compliant Docker container & filesystem names
 * Docker pattern: [a-zA-Z0-9][a-zA-Z0-9_.-]*
 */
export function sanitizeContainerIdentifier(studentId, serverName) {
  const cleanStudentId = String(studentId || 'std')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '') || 'std'

  let cleanName = String(serverName || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .replace(/[-_.]{2,}/g, '_')

  if (!cleanName || cleanName.length < 2) {
    cleanName = `app_${Math.random().toString(36).substring(2, 6)}`
  }

  // Docker container name length limit and allowed format
  const containerName = `std-${cleanStudentId}-${cleanName}`.slice(0, 63).replace(/[-_.]+$/, '')
  return { cleanStudentId, cleanName, containerName }
}

/**
 * Ensure student persistent directory exists on host
 */
function ensureWorkspaceDir(studentId, serverName) {
  const dataDir = process.env.DATA_DIR || '/app/data'
  const { cleanStudentId, cleanName } = sanitizeContainerIdentifier(studentId, serverName)
  const workspacePath = path.join(dataDir, 'workspaces', cleanStudentId, cleanName)
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true })
    // Write a starter README
    const readme = `# Workspace: ${serverName}\nStudent: ${studentId}\nReady for development.\n`
    fs.writeFileSync(path.join(workspacePath, 'README.md'), readme, 'utf8')
  }
  return workspacePath
}

/**
 * Create and start an isolated micro-container for student
 */
export async function createStudentContainer({
  name,
  studentId,
  osKey = 'debian-12',
  vcpu = 1,
  ram = 1024,
  disk = 10,
  password = ''
}) {
  const image = IMAGE_MAP[osKey] || 'debian:12-slim'
  const { containerName, cleanName } = sanitizeContainerIdentifier(studentId, name)

  console.log(`[DOCKER] Provisioning student container: ${containerName} using ${image}...`)

  // Check if container already exists, remove old one if exists
  try {
    const existing = docker.getContainer(containerName)
    const info = await existing.inspect()
    if (info) {
      console.log(`[DOCKER] Removing preexisting container ${containerName}...`)
      if (info.State.Running) {
        await existing.stop({ t: 1 }).catch(() => {})
      }
      await existing.remove({ force: true }).catch(() => {})
    }
  } catch {
    // container doesn't exist, proceed
  }

  // Ensure workspace directory exists
  const workspaceHostPath = ensureWorkspaceDir(studentId, name)

  // Configure resources
  const memoryBytes = Math.max(256, ram) * 1024 * 1024
  const nanoCpus = Math.max(1, vcpu) * 1_000_000_000

  // Create container
  const container = await docker.createContainer({
    Image: image,
    name: containerName,
    Tty: true,
    OpenStdin: true,
    StdinOnce: false,
    Cmd: ['/bin/sh', '-c', 'while true; do sleep 3600; done'],
    WorkingDir: '/workspace',
    Env: [
      `STUDENT_ID=${studentId}`,
      `SERVER_NAME=${name}`,
      `TERM=xterm-256color`,
      `LANG=C.UTF-8`
    ],
    HostConfig: {
      RestartPolicy: { Name: 'unless-stopped' },
      Memory: memoryBytes,
      NanoCPUs: nanoCpus,
      Binds: [
        `${workspaceHostPath}:/workspace`
      ]
    },
    Labels: {
      'lbtech.studentId': studentId,
      'lbtech.serverName': name,
      'lbtech.managed': 'true',
      'lbtech.osKey': osKey
    }
  })

  // Start container
  await container.start()
  const info = await container.inspect()
  const ip = info.NetworkSettings?.IPAddress || '127.0.0.1'

  // Connect container to iot-stack_default network for internal web preview routing
  try {
    const net = docker.getNetwork('iot-stack_default')
    await net.connect({ Container: container.id })
    console.log(`[DOCKER] Connected ${containerName} to iot-stack_default network`)
  } catch (netErr) {
    // Network might not exist in dev or already attached
  }

  // Set password and initialize SSH daemon & standard dev tools (python3, curl)
  const rootPass = password || 'News030347'
  const initSshCmd = osKey === 'alpine-3'
    ? `(apk add --no-cache openssh-server bash curl python3 2>/dev/null && ssh-keygen -A && echo "root:${rootPass}" | chpasswd && mkdir -p /var/run/sshd && echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && /usr/sbin/sshd) &`
    : `(apt-get update -qq 2>/dev/null && apt-get install -y --no-install-recommends openssh-server bash curl python3 2>/dev/null && mkdir -p /run/sshd && echo "root:${rootPass}" | chpasswd && echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && /usr/sbin/sshd) &`

  try {
    const exec = await container.exec({
      AttachStdin: false,
      AttachStdout: false,
      Cmd: ['/bin/sh', '-c', initSshCmd]
    })
    await exec.start({ detach: true })
    console.log(`[DOCKER] Container ${containerName} SSH & password initialized.`)
  } catch (e) {
    console.warn('[DOCKER] Credentials init warning:', e.message)
  }

  console.log(`[DOCKER] Container ${containerName} started successfully (IP: ${ip})`)

  return {
    containerId: container.id,
    containerName,
    ip,
    status: 'running',
    os: OS_LABELS[osKey] || osKey,
    image
  }
}

/**
 * Start container
 */
export async function startStudentContainer(containerId) {
  const container = docker.getContainer(containerId)
  await container.start()
  return { success: true }
}

/**
 * Stop container
 */
export async function stopStudentContainer(containerId) {
  const container = docker.getContainer(containerId)
  await container.stop({ t: 2 })
  return { success: true }
}

/**
 * Restart container
 */
export async function restartStudentContainer(containerId) {
  const container = docker.getContainer(containerId)
  await container.restart({ t: 2 })
  return { success: true }
}

/**
 * Remove/Destroy container
 */
export async function destroyStudentContainer(containerId) {
  const container = docker.getContainer(containerId)
  try {
    await container.stop({ t: 1 }).catch(() => {})
  } catch {}
  await container.remove({ force: true })
  return { success: true }
}

/**
 * Create interactive PTY stream for WebSocket terminal
 */
export async function createTerminalSession(containerId, { cols = 80, rows = 24 } = {}) {
  const container = docker.getContainer(containerId)

  // Try bash first, fallback to sh
  let shellCmd = ['/bin/bash']
  try {
    const testExec = await container.exec({
      AttachStdout: true,
      Cmd: ['which', 'bash']
    })
    const stream = await testExec.start({})
    let output = ''
    stream.on('data', chunk => { output += chunk.toString() })
    await new Promise(resolve => stream.on('end', resolve))
    if (!output.includes('/bash')) {
      shellCmd = ['/bin/sh']
    }
  } catch {
    shellCmd = ['/bin/sh']
  }

  const exec = await container.exec({
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Cmd: shellCmd,
    Env: [
      'TERM=xterm-256color',
      'LANG=C.UTF-8',
      'COLORTERM=truecolor',
      'PS1=\\u@\\h:\\w\\$ '
    ]
  })

  const stream = await exec.start({
    hijack: true,
    stdin: true,
    Tty: true
  })

  // Resize terminal
  if (cols && rows) {
    await exec.resize({ h: rows, w: cols }).catch(() => {})
  }

  return {
    exec,
    stream,
    resize: (w, h) => exec.resize({ w, h })
  }
}

/**
 * Calculate student workspace directory size in Megabytes
 */
export function getWorkspaceDiskUsageMB(studentId, serverName) {
  try {
    const dataDir = process.env.DATA_DIR || '/app/data'
    const cleanName = (serverName || '').replace(/[^a-zA-Z0-9_-]/g, '_')
    const workspacePath = path.join(dataDir, 'workspaces', studentId, cleanName)
    if (!fs.existsSync(workspacePath)) return 0

    let totalBytes = 0
    function scan(dir) {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const res = path.resolve(dir, entry.name)
          if (entry.isDirectory()) {
            scan(res)
          } else if (entry.isFile()) {
            totalBytes += fs.statSync(res).size
          }
        }
      } catch {}
    }
    scan(workspacePath)
    return Number((totalBytes / (1024 * 1024)).toFixed(1))
  } catch {
    return 0
  }
}

/**
 * Fetch live container resource statistics (CPU %, Memory %, Disk %, Network, PIDs)
 */
export async function getContainerLiveStats(containerId, serverMeta = null) {
  try {
    const container = docker.getContainer(containerId)
    const stats = await container.stats({ stream: false })

    // CPU % calculation
    let cpuPercent = 0.0
    if (stats.cpu_stats && stats.precpu_stats) {
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
      const systemDelta = (stats.cpu_stats.system_cpu_usage || 0) - (stats.precpu_stats.system_cpu_usage || 0)
      const numCpus = stats.cpu_stats.online_cpus || (stats.cpu_stats.cpu_usage.percpu_usage ? stats.cpu_stats.cpu_usage.percpu_usage.length : 1)
      if (systemDelta > 0 && cpuDelta > 0) {
        cpuPercent = (cpuDelta / systemDelta) * numCpus * 100.0
      }
    }

    // Memory calculation
    let memUsage = stats.memory_stats?.usage || 0
    const statsObj = stats.memory_stats?.stats || {}
    const cache = statsObj.inactive_file || statsObj.cache || 0
    if (memUsage > cache) {
      memUsage -= cache
    }
    const memLimit = stats.memory_stats?.limit || (1024 * 1024 * 1024)
    const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100.0 : 0.0

    // Disk Storage Quota Calculation
    let diskUsageMB = 0
    let diskLimitGB = Number(serverMeta?.disk || 10)
    let diskPercent = 0
    let diskQuotaExceeded = false

    if (serverMeta && serverMeta.studentId && serverMeta.name) {
      diskUsageMB = getWorkspaceDiskUsageMB(serverMeta.studentId, serverMeta.name)
      const diskLimitMB = diskLimitGB * 1024
      diskPercent = diskLimitMB > 0 ? Number(((diskUsageMB / diskLimitMB) * 100).toFixed(1)) : 0
      diskQuotaExceeded = diskUsageMB >= diskLimitMB
    }

    return {
      running: true,
      cpuPercent: Math.min(100, Math.max(0, Number(cpuPercent.toFixed(1)))),
      memPercent: Math.min(100, Math.max(0, Number(memPercent.toFixed(1)))),
      memUsageMB: Number((memUsage / (1024 * 1024)).toFixed(1)),
      memLimitMB: Number((memLimit / (1024 * 1024)).toFixed(0)),
      diskUsageMB,
      diskLimitGB,
      diskPercent: Math.min(100, diskPercent),
      diskQuotaExceeded,
      pids: stats.pids_stats?.current || 0
    }
  } catch (err) {
    return {
      running: false,
      cpuPercent: 0,
      memPercent: 0,
      memUsageMB: 0,
      memLimitMB: 0,
      diskUsageMB: 0,
      diskLimitGB: Number(serverMeta?.disk || 10),
      diskPercent: 0,
      diskQuotaExceeded: false,
      pids: 0
    }
  }
}

/**
 * Fetch list of active processes inside container (ps aux)
 */
export async function getContainerProcesses(containerId) {
  try {
    const container = docker.getContainer(containerId)
    let topData = null
    try {
      topData = await container.top({ ps_args: 'aux' })
    } catch {
      topData = await container.top()
    }

    if (!topData || !topData.Processes) {
      return []
    }

    const titles = (topData.Titles || []).map(t => String(t).toUpperCase().trim())
    const userIdx = titles.indexOf('USER') !== -1 ? titles.indexOf('USER') : 0
    const pidIdx = titles.indexOf('PID') !== -1 ? titles.indexOf('PID') : 1
    const cpuIdx = titles.indexOf('%CPU') !== -1 ? titles.indexOf('%CPU') : 2
    const memIdx = titles.indexOf('%MEM') !== -1 ? titles.indexOf('%MEM') : 3
    const vszIdx = titles.indexOf('VSZ') !== -1 ? titles.indexOf('VSZ') : 4
    const rssIdx = titles.indexOf('RSS') !== -1 ? titles.indexOf('RSS') : 5
    const statIdx = titles.indexOf('STAT') !== -1 ? titles.indexOf('STAT') : 7
    const timeIdx = titles.indexOf('TIME') !== -1 ? titles.indexOf('TIME') : 9
    const cmdIdx = titles.indexOf('COMMAND') !== -1 ? titles.indexOf('COMMAND') : 10

    return topData.Processes.map(proc => {
      const cmd = proc.slice(cmdIdx).join(' ') || proc[cmdIdx] || ''
      return {
        user: proc[userIdx] || 'root',
        pid: parseInt(proc[pidIdx], 10) || proc[pidIdx],
        cpu: parseFloat(proc[cpuIdx]) || 0.0,
        mem: parseFloat(proc[memIdx]) || 0.0,
        vsz: proc[vszIdx] || '-',
        rss: proc[rssIdx] || '-',
        stat: proc[statIdx] || '-',
        time: proc[timeIdx] || '-',
        command: cmd
      }
    }).sort((a, b) => b.cpu - a.cpu || b.mem - a.mem)
  } catch (err) {
    return []
  }
}

/**
 * Kill a specific process inside student container
 */
export async function killContainerProcess(containerId, pid, signal = '9') {
  try {
    const container = docker.getContainer(containerId)
    const cleanPid = parseInt(pid, 10)
    if (!cleanPid || isNaN(cleanPid)) {
      return { success: false, error: 'Invalid PID' }
    }
    const exec = await container.exec({
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['kill', `-${signal}`, String(cleanPid)]
    })
    const stream = await exec.start({})
    let output = ''
    stream.on('data', chunk => { output += chunk.toString() })
    await new Promise(resolve => stream.on('end', resolve))
    return { success: true, output }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Aggregated Cluster / Container Pool Resource & Process Snapshot
 */
export async function getPoolDashboardSnapshot(servers = []) {
  try {
    const dockerInfo = await docker.info().catch(() => ({}))
    const nCpus = dockerInfo.NCPU || 4
    const hostMemTotal = dockerInfo.MemTotal || (8 * 1024 * 1024 * 1024)
    const hostMemTotalMB = Math.round(hostMemTotal / (1024 * 1024))

    let totalAllocatedVcpu = 0
    let totalAllocatedRamMB = 0
    let totalAllocatedDiskGB = 0
    let totalUsedRamMB = 0
    let totalUsedDiskMB = 0
    let totalCpuPercent = 0.0

    const enrichedServers = []
    const allProcesses = []

    for (const s of servers) {
      totalAllocatedVcpu += Number(s.vcpu || 1)
      totalAllocatedRamMB += Number(s.ram || 1024)
      totalAllocatedDiskGB += Number(s.disk || 10)

      const containerId = s.containerId || s.name
      const [stats, processes] = await Promise.all([
        getContainerLiveStats(containerId, s),
        s.status === 'running' ? getContainerProcesses(containerId) : Promise.resolve([])
      ])

      if (stats.running) {
        totalCpuPercent += stats.cpuPercent
        totalUsedRamMB += stats.memUsageMB
      }
      totalUsedDiskMB += stats.diskUsageMB || 0

      // Top process for this container (excluding idle sleep loops if others exist)
      let topProc = processes.length > 0 ? processes[0] : null
      if (processes.length > 1 && topProc && topProc.command.includes('sleep 3600')) {
        const nonSleep = processes.find(p => !p.command.includes('sleep 3600'))
        if (nonSleep) topProc = nonSleep
      }

      enrichedServers.push({
        vmid: s.vmid,
        studentId: s.studentId,
        serverName: s.name,
        containerId,
        containerName: s.containerName || containerId,
        os: s.os || s.osKey,
        osKey: s.osKey,
        ip: s.ip,
        status: stats.running ? 'running' : 'stopped',
        vcpu: s.vcpu || 1,
        ram: s.ram || 1024,
        disk: s.disk || 10,
        customDomain: s.customDomain || '',
        webPort: s.webPort || 80,
        stats,
        processCount: processes.length,
        topProcess: topProc
      })

      if (stats.running && processes.length > 0) {
        for (const p of processes) {
          allProcesses.push({
            vmid: s.vmid,
            serverName: s.name,
            studentId: s.studentId,
            containerId,
            ...p
          })
        }
      }
    }

    allProcesses.sort((a, b) => b.cpu - a.cpu || b.mem - a.mem)
    const topProcesses = allProcesses.slice(0, 15)
    const runningCount = enrichedServers.filter(s => s.status === 'running').length

    return {
      success: true,
      timestamp: new Date().toISOString(),
      nodeInfo: {
        nodeName: 'techniccom',
        model: 'HP ProLiant DL20 Gen9',
        ncpu: nCpus,
        hostMemTotalMB,
        dockerVersion: dockerInfo.ServerVersion || '26.x',
        os: dockerInfo.OperatingSystem || 'Debian GNU/Linux 12 (bookworm)',
        containersRunning: dockerInfo.ContainersRunning || runningCount,
        containersTotal: dockerInfo.Containers || servers.length
      },
      poolSummary: {
        totalServers: servers.length,
        runningServers: runningCount,
        stoppedServers: servers.length - runningCount,
        totalCpuPercent: Math.min(100 * nCpus, Number(totalCpuPercent.toFixed(1))),
        avgCpuPercent: runningCount > 0 ? Number((totalCpuPercent / runningCount).toFixed(1)) : 0,
        totalUsedRamMB: Number(totalUsedRamMB.toFixed(1)),
        totalAllocatedRamMB,
        hostMemTotalMB,
        ramPercentOfHost: Number(((totalUsedRamMB / hostMemTotalMB) * 100).toFixed(1)),
        totalUsedDiskMB: Number(totalUsedDiskMB.toFixed(1)),
        totalAllocatedDiskGB,
        totalAllocatedVcpu
      },
      servers: enrichedServers,
      topProcesses
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    }
  }
}


