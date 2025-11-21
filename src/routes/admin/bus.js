import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";
import moment from "moment";

const router = express.Router()

router.get('/projects', checkAuth, userPermission, async (req, res) => {
    const {rows: employees} = await db.query(`
        SELECT
            p.name AS project_name,
            p.id AS project_id,
            COUNT(CASE WHEN ea.turn = 1 THEN 1 END) AS turn1Employees,
            COUNT(CASE WHEN ea.turn = 2 THEN 1 END) AS turn2Employees
        FROM
            projects AS p
                JOIN
            project_members AS pm ON p.id = pm.project_id
                AND pm.status = 1 -- Layihə üzvü aktivdir
                JOIN
            employees AS e ON e.id = pm.employee_id
                JOIN
            employee_activities AS ea ON ea.employee_id = e.id
                AND ea.status = 2 -- Fəaliyyət statusu 2
                AND ea.completed_status = 0 -- Tamamlanma statusu 1
                AND ea.type = 1 -- Fəaliyyət növü 1 (Check-in/out olduğu güman edilir)
                AND DATE(ea.review_time) = $1 -- Tələb olunan tarix
        GROUP BY
            p.id, p.name
        ORDER BY
            p.id;
    `, [moment().format('YYYY-MM-DD')]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: employees
    })
})

export default router