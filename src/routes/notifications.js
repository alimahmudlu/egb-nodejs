import express from 'express';
import db from '../helper/db.js';
import checkAuth from "../middleware/checkAuth.js";
import moment from "moment";

const router = express.Router();

router.get('/', checkAuth, async (req, res) => {
    try {
        const {rows: notificationRows} = await db.query(`
            SELECT * from notifications 
            WHERE user_id = $1
            ORDER BY id DESC;
        `, [req.currentUserId]);

        return res.json({
            success: true,
            message: 'Notifications fetched successfully',
            data: [...notificationRows],
        })
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message,
            data: null
        })
    }
})

router.post('/read', checkAuth, async (req, res) => {
    const {url, id} = req.body;
    const currentUserId = req.currentUserId;

    const {rows: updatedRows} = await db.query(`
        UPDATE notifications
        SET read = 1
        WHERE id = $1 AND user_id = $2 RETURNING *;
    `, [id, currentUserId])

    return res.json({
        success: true,
        message: 'Notifications read successfully',
        data: updatedRows
    })
})

router.post('/read/group', checkAuth, async (req, res) => {
    const {group} = req.body;
    const currentUserId = req.currentUserId;

    const {rows: updatedRows} = await db.query(`
        UPDATE notifications
        SET read = 1
        WHERE type = $1 AND user_id = $2 RETURNING *;
    `, [group, currentUserId])

    return res.json({
        success: true,
        message: 'Notifications read successfully',
        data: updatedRows
    })
})

export default router;