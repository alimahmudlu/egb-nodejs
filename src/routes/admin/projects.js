import express from 'express'
import db from '../../helper/db.js'
import checkAuth from "../../middleware/checkAuth.js";
import moment from "moment";

const router = express.Router()

router.get('/', checkAuth, async (req, res) => {
    const {rows} = await db.query(`SELECT
                                       p.*
                                   FROM project_members pm
                                       LEFT JOIN projects p ON p.id = pm.project_id
                                   WHERE pm.employee_id = $1 AND pm.status = 1`, [req.currentUserId])

    return res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })

})

export default router