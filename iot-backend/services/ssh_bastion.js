import ssh2 from 'ssh2'
const { Server } = ssh2
import fs from 'fs'
import path from 'path'
import { generateKeyPairSync } from 'crypto'
import { db } from '../database.js'
import { createTerminalSession, docker } from './docker_provisioner.js'

function getOrCreateHostKey() {
  const dataDir = process.env.DATA_DIR || '/app/data'
  const keyPath = path.join(dataDir, 'ssh_host_key')

  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath)
  }

  console.log('[SSH BASTION] Generating new RSA host key...')
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  })

  fs.writeFileSync(keyPath, privateKey, { mode: 0o600 })
  return privateKey
}

export function startSshBastion(port = 2222) {
  try {
    const hostKey = getOrCreateHostKey()

    const server = new Server({ hostKeys: [hostKey] }, (client) => {
      let authenticatedUser = null

      client.on('authentication', (ctx) => {
        if (ctx.method === 'password') {
          const rawUser = ctx.username.trim()
          const password = ctx.password

          // 1. Check if admin
          if ((rawUser === 'admin' || rawUser === 'root') && (password === '07072569' || password === '2569')) {
            authenticatedUser = { username: rawUser, studentId: 'admin', isAdmin: true }
            return ctx.accept()
          }

          // 2. Check student credentials
          const student = db.getStudent(rawUser)
          const servers = db.getServers(rawUser)

          const isMatchingStudent = student && student.password === password
          const isMatchingServerPass = servers.some(s => s.rootPassword === password)
          const isMasterPin = password === '07072569' || password === '2569'

          if (isMatchingStudent || isMatchingServerPass || isMasterPin) {
            authenticatedUser = { username: rawUser, studentId: rawUser, isAdmin: false }
            console.log(`[SSH BASTION] Authentication successful for student: ${rawUser}`)
            return ctx.accept()
          }

          console.warn(`[SSH BASTION] Auth failed for username: ${rawUser}`)
          return ctx.reject()
        }

        return ctx.reject(['password'])
      })

      client.on('ready', () => {
        client.on('session', (accept, reject) => {
          const session = accept()
          let ptyInfo = null
          let activeTerminal = null

          session.on('pty', (accept, reject, info) => {
            ptyInfo = info
            accept()
          })

          session.on('window-change', (accept, reject, info) => {
            ptyInfo = info
            if (activeTerminal && activeTerminal.resize) {
              activeTerminal.resize(info.rows, info.cols)
            }
            if (accept) accept()
          })

          session.on('shell', async (accept, reject) => {
            const stream = accept()

            // Find running container for student
            const studentId = authenticatedUser.studentId
            const servers = studentId === 'admin' ? db.getServers() : db.getServers(studentId)
            const activeServer = servers.find(s => s.status === 'running') || servers[0]

            if (!activeServer) {
              stream.write('\r\n\x1b[31;1m[ERROR] ไม่พบเครื่องเซิร์ฟเวอร์ที่กำลังทำงานอยู่ของรหัสนี้\x1b[0m\r\n')
              stream.write(`\x1b[33mกรุณาเข้าสู่ระบบ https://iot.pichyy.qzz.io เพื่อเปิดเครื่องก่อนครับ\x1b[0m\r\n\r\n`)
              stream.end()
              return
            }

            try {
              const target = activeServer.containerId || activeServer.name
              activeTerminal = await createTerminalSession(target)

              if (ptyInfo && activeTerminal.resize) {
                activeTerminal.resize(ptyInfo.rows, ptyInfo.cols)
              }

              // Pipe streams
              activeTerminal.stream.pipe(stream)
              stream.pipe(activeTerminal.stream)

              activeTerminal.stream.on('end', () => stream.end())
              stream.on('close', () => {
                if (activeTerminal.stream.destroy) {
                  activeTerminal.stream.destroy()
                }
              })
            } catch (err) {
              stream.write(`\r\n\x1b[31m[ERROR] ไม่สามารถเชื่อมต่อ Container: ${err.message}\x1b[0m\r\n`)
              stream.end()
            }
          })

          session.on('exec', async (accept, reject, info) => {
            const stream = accept()
            const studentId = authenticatedUser.studentId
            const servers = studentId === 'admin' ? db.getServers() : db.getServers(studentId)
            const activeServer = servers.find(s => s.status === 'running') || servers[0]

            if (!activeServer) {
              stream.stderr.write('Error: No active container found for this student.\n')
              stream.exit(1)
              stream.end()
              return
            }

            try {
              const target = activeServer.containerId || activeServer.name
              const container = docker.getContainer(target)
              const exec = await container.exec({
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: false,
                Cmd: ['/bin/sh', '-c', info.command]
              })
              const execStream = await exec.start({ hijack: true, stdin: true })
              container.modem.demuxStream(execStream, stream, stream.stderr)
              execStream.on('end', () => {
                stream.exit(0)
                stream.end()
              })
            } catch (err) {
              stream.stderr.write(`Exec error: ${err.message}\n`)
              stream.exit(1)
              stream.end()
            }
          })
        })
      })

      client.on('error', (err) => {
        // Silently handle client disconnect errors
      })
    })

    server.listen(port, '0.0.0.0', () => {
      console.log(`🛡️  Smart SSH Bastion Gateway listening on 0.0.0.0:${port}`)
    })

    return server
  } catch (err) {
    console.error('[SSH BASTION] Failed to start SSH Bastion:', err)
  }
}
