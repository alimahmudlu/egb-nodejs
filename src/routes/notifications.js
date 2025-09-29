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

        const {rows: expiredDocs} = await db.query(`SELECT au.date_of_expiry, au.date_of_issue, u.filesize, u.mimetype, u.filepath, u.filename, u.id, au.type
                                   FROM application_uploads au
                                            JOIN uploads u ON u.id = au.upload_id
                                   WHERE au.application_id IN (SELECT application_id FROM employees WHERE id = $1) and au.date_of_expiry < now();
    `, [req.currentUserId])

        return res.json({
            success: true,
            message: 'Notifications fetched successfully',
            data: [...notificationRows, ...expiredDocs],
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