import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'

const router = express.Router()

router.post('/checkin', checkAuth, async (req, res) => {
    const {time, latitude, longitude} = req.body;

    // type: 1- checkin, 2 - checkout
    // status: 0 - requested, 1 - accept, 2 - reject
    const status = 0;
    const type = 1;

    const {rows: checkedInRows} = await db.query(`SELECT * FROM employee_activities WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`, [req.currentUserId])
    if (checkedInRows.length === 0 || (checkedInRows.length > 0 && checkedInRows[0].type !== type)) {
        const {rows} = await db.query(`INSERT INTO employee_activities 
            (employee_id, confirm_employee_id, time, latitude, longitude, work_time, type, status, confirm_time, reject_reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * `,
            [req.currentUserId, null, time, latitude, longitude, null, type, status, null, null])

        res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: rows[0]
        })
    }
    else {
        res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})

/*router.post('/checkout', checkAuth, async (req, res) => {
    const {time, latitude, longitude} = req.body;

    // type: 1- checkin, 2 - checkout
    // status: 0 - requested, 1 - accept, 2 - reject
    const status = 0;
    const type = 2;

    const {rows: checkedOutRows} = await db.query(`SELECT * FROM employee_activities WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`, [req.currentUserId])
    if (checkedOutRows.length === 0 || (checkedOutRows.length > 0 && checkedOutRows[0].type !== type)) {
        const {rows} = await db.query(`INSERT INTO employee_activities 
            (employee_id, confirm_employee_id, time, latitude, longitude, work_time, type, status, confirm_time, completed_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * `,
            [req.currentUserId, null, time, latitude, longitude, null, type, status, null, 0])

        res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: rows[0]
        })
    }
    else {
        res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})*/
router.post('/checkout', checkAuth, async (req, res) => {
    const {time, latitude, longitude} = req.body;

    // type: 1- checkin, 2 - checkout
    // status: 0 - requested, 1 - accept, 2 - reject
    const status = 2;
    const type = 2;

    const {rows: checkedOutRows} = await db.query(`SELECT * FROM employee_activities WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`, [req.currentUserId])
    if (checkedOutRows.length === 0 || (checkedOutRows.length > 0 && checkedOutRows[0].type !== type)) {
        const {rows} = await db.query(`INSERT INTO employee_activities 
            (employee_id, confirm_employee_id, time, latitude, longitude, work_time, type, status, confirm_time, completed_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * `,
            [req.currentUserId, null, time, latitude, longitude, null, type, status, time, 1]);












        res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: rows[0]
        })
    }
    else {
        res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})

export default router