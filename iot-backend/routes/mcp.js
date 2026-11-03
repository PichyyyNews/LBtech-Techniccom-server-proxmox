import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from '../database.js'

const router = express.Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Standard MCP Tool Definitions
const MCP_TOOLS = [
  {
    name: 'lbtech_get_student_credentials',
    description: 'Get MQTT credentials, topic namespace, and InfluxDB configuration for a student group on LBTech IoT Cloud',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Student ID (e.g. 69123456789)' }
      },
      required: ['studentId']
    }
  },
  {
    name: 'lbtech_get_server_status',
    description: 'Check current status, specs (vCPU, RAM, SSD), IP/port, and container details for a student',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Student ID to inspect' }
      },
      required: ['studentId']
    }
  },
  {
    name: 'lbtech_power_server',
    description: 'Control container power: start, stop, or reboot a student micro-container',
    inputSchema: {
      type: 'object',
      properties: {
        vmid: { type: 'integer', description: 'Container VMID (e.g. 109, 110)' },
        action: { type: 'string', enum: ['start', 'stop', 'reboot'], description: 'Power action to execute' }
      },
      required: ['vmid', 'action']
    }
  },
  {
    name: 'lbtech_submit_ticket',
    description: 'Submit an automated technical support or quota increase ticket to admin/instructors',
    inputSchema: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: 'Student ID' },
        subject: { type: 'string', description: 'Ticket subject line' },
        category: { type: 'string', enum: ['quota', 'network', 'server', 'general'], description: 'Ticket category' },
        description: { type: 'string', description: 'Detailed problem or request description' }
      },
      required: ['studentId', 'subject', 'description']
    }
  },
  {
    name: 'lbtech_read_documentation',
    description: 'Read the official LBTech IoT Cloud documentation, starter code examples, and API specifications',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['all', 'mqtt', 'influxdb', 'containers', 'api'], description: 'Documentation section' }
      }
    }
  }
]

// GET /api/mcp: Server info & client config instructions
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    protocol: 'model-context-protocol',
    protocolVersion: '2024-11-05',
    server: {
      name: 'lbtech-iot-mcp',
      title: 'LBTech IoT Cloud Platform MCP Server',
      version: '1.2.0',
      description: 'Model Context Protocol (MCP) Server for LBTech IoT Cloud - Enables Claude, Cursor, and AI agents to inspect resources, check container telemetry, and automate workflows.',
      endpoint: 'https://iot.pichyy.qzz.io/api/mcp'
    },
    toolsCount: MCP_TOOLS.length,
    tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    clientConfiguration: {
      claudeDesktop: {
        mcpServers: {
          'lbtech-iot': {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-fetch', 'https://iot.pichyy.qzz.io/api/mcp']
          }
        }
      },
      cursor: {
        'lbtech-iot': {
          url: 'https://iot.pichyy.qzz.io/api/mcp'
        }
      }
    }
  })
})

// POST /api/mcp: JSON-RPC 2.0 Handler
router.post('/', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {}

  if (jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      id: id || null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }
    })
  }

  try {
    // 1. Initialize
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false }
          },
          serverInfo: {
            name: 'lbtech-iot-mcp',
            version: '1.2.0'
          }
        }
      })
    }

    // 2. tools/list
    if (method === 'tools/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS
        }
      })
    }

    // 3. resources/list
    if (method === 'resources/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'lbtech://docs/llms.txt',
              name: 'LLM Complete System Documentation',
              mimeType: 'text/plain',
              description: 'Official system endpoints, starter code, and platform architecture'
            },
            {
              uri: 'lbtech://system/overview',
              name: 'LBTech IoT System Specs & Status',
              mimeType: 'application/json',
              description: 'Real-time overview of active containers and registered students'
            }
          ]
        }
      })
    }

    // 4. resources/read
    if (method === 'resources/read') {
      const uri = params?.uri
      if (uri === 'lbtech://docs/llms.txt') {
        const docPath = path.resolve(__dirname, '../../iot-portal/public/llms.txt')
        const content = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '# LBTech IoT Platform Docs'
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            contents: [{ uri, mimeType: 'text/plain', text: content }]
          }
        })
      }

      if (uri === 'lbtech://system/overview') {
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                registeredStudents: db.getAllStudents().length,
                activeContainers: db.getServers().length,
                mqttBroker: 'mqtt.pichyy.qzz.io:443 (WSS)',
                influxDB: 'https://influx.pichyy.qzz.io',
                systemUptime: process.uptime()
              }, null, 2)
            }]
          }
        })
      }

      return res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Resource not found: ${uri}` }
      })
    }

    // 5. tools/call
    if (method === 'tools/call') {
      const toolName = params?.name
      const args = params?.arguments || {}

      if (toolName === 'lbtech_get_student_credentials') {
        const student = db.getStudent(args.studentId)
        if (!student) {
          return res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `ไม่พบข้อมูลนักศึกษารหัส ${args.studentId} ในระบบ LBTech IoT` }]
            }
          })
        }

        const creds = {
          studentId: student.studentId,
          name: student.name,
          project: student.project,
          mqtt: {
            host: 'mqtt.pichyy.qzz.io',
            port: 443,
            path: '/mqtt',
            username: student.studentId,
            password: student.password,
            publishTopic: `project/${student.studentId}/sensor`,
            subscribeTopic: `project/${student.studentId}/#`
          },
          influxdb: {
            host: 'https://influx.pichyy.qzz.io',
            org: 'lbtech',
            bucket: student.influxBucket || `bucket_${student.studentId}`,
            token: student.influxToken || `lbtech_${student.studentId}_token`
          },
          sshBastion: {
            command: `ssh ${student.studentId}@techniccom.tail59415d.ts.net -p 10000`,
            host: 'techniccom.tail59415d.ts.net',
            port: 10000,
            user: student.studentId
          }
        }

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(creds, null, 2) }]
          }
        })
      }

      if (toolName === 'lbtech_get_server_status') {
        const servers = db.getServers().filter(s => s.studentId === args.studentId)
        if (servers.length === 0) {
          return res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `นักศึกษารหัส ${args.studentId} ยังไม่มี Cloud Micro-Container ในระบบ` }]
            }
          })
        }

        const summary = servers.map(s => ({
          vmid: s.vmid,
          name: s.name,
          os: s.os,
          status: s.status,
          cores: s.cores || 1,
          memoryMB: s.memory || 512,
          diskGB: s.disk || 5,
          ip: s.ip || '127.0.0.1',
          sshPort: s.sshPort || 10000
        }))

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
          }
        })
      }

      if (toolName === 'lbtech_power_server') {
        const server = db.getServers().find(s => s.vmid === Number(args.vmid))
        if (!server) {
          return res.json({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `ไม่พบ Cloud Container VMID ${args.vmid}` }]
            }
          })
        }

        const action = args.action
        const newStatus = action === 'start' ? 'running' : (action === 'stop' ? 'stopped' : 'running')
        db.updateServer(server.vmid, { status: newStatus })

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `สั่งการ ${action} สำหรับ ${server.name} (VMID: ${server.vmid}) สำเร็จ สถานะปัจจุบัน: ${newStatus}` }]
          }
        })
      }

      if (toolName === 'lbtech_submit_ticket') {
        const ticket = db.createTicket({
          studentId: args.studentId,
          studentName: 'MCP Autonomous Agent',
          category: args.category || 'general',
          subject: args.subject,
          description: args.description
        })

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `สร้าง Ticket สำเร็จ รหัส: ${ticket.id} สถานะ: pending` }]
          }
        })
      }

      if (toolName === 'lbtech_read_documentation') {
        const docPath = path.resolve(__dirname, '../../iot-portal/public/llms.txt')
        const content = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : 'No docs'
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: content }]
          }
        })
      }

      return res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` }
      })
    }

    return res.status(404).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not implemented: ${method}` }
    })
  } catch (err) {
    return res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: `Internal error: ${err.message}` }
    })
  }
})

export default router
