import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

// router.post('/report/daily', checkAuth, userPermission, async (req, res) => {
//     const {date} = req.params;
//
//     const {rows} = await db.query(`
//         INSERT INTO food_reports (turn1order, turn2order, date, employee_id)
//         VALUES ($1, $2, $3, $4)
//         RETURNING *
//     `, [turn1order, turn2order, date, req.currentUserId]);
//
//     return res.status(200).json({
//         success: true,
//         message: 'Food report added successfully',
//         data: rows?.[0]
//     })
// })

router.post('/report/add', checkAuth, userPermission, async (req, res) => {
    const {turn1order, turn2order, date} = req.body;
    // req.currentUserId

    const {rows} = await db.query(`
        INSERT INTO food_reports (turn1order, turn2order, date, employee_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [turn1order, turn2order, date, req.currentUserId]);

    return res.status(200).json({
        success: true,
        message: 'Food report added successfully',
        data: rows?.[0]
    })
})

router.get('/report/list', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`
        SELECT *
        FROM food_reports
        WHERE employee_id = $1
    `, [req.currentUserId]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: rows
    })
})

export default router