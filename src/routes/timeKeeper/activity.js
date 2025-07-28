import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import moment from 'moment'

import { getIO, userSocketMap } from "./../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";


const router = express.Router()

router.get('/list', checkAuth, async (req, res) => {
    const {rows} = await db.query(`
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee,
               (
                   SELECT json_build_object(
                                  'id', e.id,
                                  'full_name', e.full_name
                          )
                   FROM employees e
                   WHERE e.id = ea.reviewer_employee_id
                   LIMIT 1
            ) AS reviewer
            FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role
        ORDER BY ea.id DESC;
        `)

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows
    })
})

router.post('/accept', checkAuth, async (req, res) => {
    const {activity_id, employee_id, type, confirm_time, timezone} = req.body

    if (!activity_id || !employee_id || !type) {
        return res.status(400).json({
            success: false,
            message: 'Activity ID, Employee ID and type are required'
        })
    }

    const {rows: checkInControlRow} = await db.query(`
        SELECT * FROM employee_activities ea WHERE employee_id = $1 and status = $2 and completed_status = $3 and type = $4
    `, [employee_id, 2, 0, 1])

    let diff = {
        hours: 0,
        minutes: 0
    }

    if (checkInControlRow?.[0]?.review_time && type === 2) {

        const start = moment(checkInControlRow?.[0].review_time, 'YYYY-MM-DD HH:mm');
        const end = moment(confirm_time, 'YYYY-MM-DD HH:mm');

        const duration = moment.duration(end.diff(start));

        diff = {
            hours: Math.floor(duration.asHours()),
            minutes: duration.minutes()
        }
    }

    const {rows: checkInRow} = await db.query(`
        UPDATE employee_activities ea
        SET completed_status = $1, work_time = $6
        WHERE employee_id = $2 and status = $3 and completed_status = $4 and type = $5
            RETURNING *;
    `, [1, employee_id, 2, 0, 1, `${diff?.hours}:${diff?.minutes}`])

    const {rows} = await db.query(`
        UPDATE employee_activities 
        SET reviewer_employee_id = $1, reviewer_timezone = $2, review_time = $3, completed_status = $4, status = $9
        WHERE id = $5 and employee_id = $6 and status = $7 and type = $8
        RETURNING *;
    `, [req.currentUserId, timezone, confirm_time, type === 1 ? 0 : 1, activity_id, employee_id, 1,  type, 2])


    if (rows.length === 0 && (type === 2 ? checkInRow.length === 0 : false)) {
        return res.status(404).json({
            success: false,
            message: 'Activity not found or already accepted'
        })
    }

    const {rows: returnedRow} = await db.query(
        `SELECT ea.*,
                (
                    SELECT json_build_object(
                                   'id', e.id,
                                   'full_name', e.full_name
                           )
                    FROM employees e
                    WHERE e.id = ea.reviewer_employee_id
                    LIMIT 1
             ) AS reviewer
         FROM employee_activities ea
         WHERE ea.id = $1`, [rows?.[0]?.id]
    )


    const io = getIO();
    const socketId = userSocketMap.get(employee_id);

    console.log('socket_id', socketId, returnedRow?.[0])

    if (socketId) {
        io.to(socketId).emit("update_activity", {
            success: true,
            from: req.currentUserId,
            message: 'Activity status changed successfully',
            data: returnedRow?.[0]
        });
    }

    sendPushNotification(employee_id, 'test', 'salam')

    return res.status(200).json({
        success: true,
        message: 'Activity accepted successfully',
        data: returnedRow?.[0]
    })
})

router.post('/reject', checkAuth, async (req, res) => {
    const {activity_id, employee_id, type, confirm_time, timezone, reject_reason} = req.body

    if (!activity_id || !employee_id || !type || !reject_reason) {
        return res.status(400).json({
            success: false,
            message: 'Activity ID, Employee ID, type and reject_reason are required'
        })
    }

    const {rows} = await db.query(`
        UPDATE employee_activities 
        SET reviewer_employee_id = $1, reviewer_timezone = $2, review_time = $3, status = $4, completed_status = $5, reject_reason = $6
        WHERE id = $7 and employee_id = $8 and status = $9
        RETURNING *;
    `,
        [req.currentUserId, timezone, confirm_time, 3, 1, reject_reason, activity_id, employee_id, 1])

    if (rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Activity not found or already rejected'
        })
    }

    const {rows: returnedRow} = await db.query(
        `SELECT ea.*,
                (
                    SELECT json_build_object(
                                   'id', e.id,
                                   'full_name', e.full_name
                           )
                    FROM employees e
                    WHERE e.id = ea.reviewer_employee_id
                    LIMIT 1
             ) AS reviewer
         FROM employee_activities ea
         WHERE ea.id = $1`, [rows?.[0]?.id]
    )

    const io = getIO();
    const socketId = userSocketMap.get(employee_id);

    if (socketId) {
        io.to(socketId).emit("update_activity", {
            success: true,
            from: req.currentUserId,
            message: 'Activity status changed successfully',
            data: returnedRow?.[0]
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Activity rejected successfully',
        data: returnedRow?.[0]
    })
})

router.get('/checkin', checkAuth, async (req, res) => {
    const {rows} = await db.query(`
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role
        WHERE ea.type = 1 AND ea.status > 0
        ORDER BY ea.id DESC;
        `)

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows || []
    })
})

router.get('/checkout', checkAuth, async (req, res) => {
    const {rows} = await db.query(`
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role
        WHERE ea.type = 2 AND ea.status > 0
        ORDER BY ea.id DESC;
        `)

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows || []
    })
})


export default router