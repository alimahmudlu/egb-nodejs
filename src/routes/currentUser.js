import express from 'express'
import db from '../helper/db.js'
import checkAuth from "../middleware/checkAuth.js";

const router = express.Router()

router.get('/', checkAuth, async (req, res) => {
    const {rows: userDataRows} =
        await db.query(`
                SELECT
                    e.*,
                    (
                        SELECT jsonb_build_object('id', r.id, 'name', r.name)
                        FROM employee_roles er
                                 LEFT JOIN roles r ON r.id = er.role
                        WHERE er.employee_id = e.id
                        LIMIT 1
                    ) AS role,
                    (SELECT sum(t.points) FROM tasks t WHERE (assigned_employee_id = e.id OR reporter_employee_id = e.id) AND EXISTS (
                SELECT 1
                FROM task_activities ta
                WHERE ta.task_id = t.id
                  AND ta.status_id = 5
            )) AS rating,
                    (
                        SELECT to_jsonb(p.*) FROM positions p WHERE p.id = e.position
                    ) AS position,
                    (
                        SELECT flow_id FROM applications a WHERE a.id = e.application_id LIMIT 1
                    ) AS flow
                FROM employees e
                WHERE e.id = $1;
            `, [req.currentUserId])

    return res.json({
        success: true,
        message: 'Current user data fetched successfully',
        data: userDataRows[0]
    })

})

export default router