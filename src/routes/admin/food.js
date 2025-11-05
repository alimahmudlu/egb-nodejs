import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

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

export default router