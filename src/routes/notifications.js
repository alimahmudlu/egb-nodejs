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

export default router;