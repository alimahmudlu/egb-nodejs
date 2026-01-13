import checkAuth from "../../middleware/checkAuth.js";
import db from "../../helper/db.js";
import express from "express";
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

router.get('/task_statuses', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`SELECT * FROM task_statuses`)

    res.json({
        success: true,
        message: 'Option Task Statuses fetched successfully',
        data: rows
    })
})

export default router