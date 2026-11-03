import express from 'express'
import { db } from '../database.js'

const router = express.Router()

// GET /api/tickets: List tickets (filtered by studentId for students, or all for admin)
router.get('/', (req, res) => {
  try {
    const studentId = req.query.studentId
    const tickets = db.getTickets({ studentId })
    res.json({
      success: true,
      count: tickets.length,
      tickets
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve tickets: ' + err.message })
  }
})

// POST /api/tickets: Create a new support ticket
router.post('/', (req, res) => {
  try {
    const { studentId, studentName, category, subject, description } = req.body

    if (!studentId || !subject || !description) {
      return res.status(400).json({
        error: 'กรุณากรอกข้อมูลให้ครบถ้วน (studentId, subject, description จำเป็น)'
      })
    }

    const ticket = db.createTicket({
      studentId,
      studentName: studentName || '',
      category: category || 'general',
      subject,
      description
    })

    res.status(201).json({
      success: true,
      message: 'ส่งคำร้องช่วยเหลือเรียบร้อยแล้ว แอดมินจะตรวจสอบโดยเร็ว',
      ticket
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket: ' + err.message })
  }
})

// PATCH /api/tickets/:id: Admin updates status or replies to ticket
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params
    const { status, adminReply } = req.body

    const updated = db.updateTicket(id, { status, adminReply })
    if (!updated) {
      return res.status(404).json({ error: 'ไม่พบ Ticket หมายเลขนี้' })
    }

    res.json({
      success: true,
      message: 'อัปเดตสถานะ Ticket สำเร็จ',
      ticket: updated
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ticket: ' + err.message })
  }
})

export default router
