import express from 'express';
import db from '../helper/db.js';
import checkAuth from "../middleware/checkAuth.js";
import moment from "moment";

const router = express.Router();

router.get('/', checkAuth, async (req, res) => {
    const { page, limit } = req.query;

    let limits = '';
    const offset = (page - 1) * limit < 0 ? 0 : (page - 1) * limit;

    if (page && limit) {
        limits = ` LIMIT ${limit} OFFSET ${offset} `;
    }


    try {
        const {rows: notificationRows} = await db.query(`
            SELECT *, COUNT(*) OVER() AS total_count from notifications 
            WHERE user_id = $1
            ORDER BY id DESC ${limits ? limits : ''};
        `, [req.currentUserId]);

        if (limits) {
            return res.json({
                success: true,
                message: 'Notifications fetched successfully',
                data: {
                    total: notificationRows?.[0]?.total_count || 0,
                    page: page,
                    data: notificationRows
                }
            })
        }
        else {
            return res.json({
                success: true,
                message: 'Notifications fetched successfully',
                data: notificationRows
            })
        }
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
router.get('/count', checkAuth, async (req, res) => {
    try {
        const {rows: notificationRows} = await db.query(`
            SELECT COUNT(id) AS total_notifications_count,
                   COUNT(CASE WHEN read = 0 THEN 1 END) AS unread_notifications_count from notifications 
            WHERE user_id = $1
        `, [req.currentUserId]);


            return res.json({
                success: true,
                message: 'Notifications fetched successfully',
                data: notificationRows?.[0]
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