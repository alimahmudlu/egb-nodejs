import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

router.get('/details/:employee_id', checkAuth, userPermission, async (req, res) => {
    const {employee_id} = req.params;
    
    const {rows} = await db.query(`
        SELECT
            e.*,

            -- Active task count (status_id < 5 OR fallback 1 < 5)
            (
                SELECT COUNT(*)
                FROM tasks t
                         LEFT JOIN (
                    SELECT DISTINCT ON (ta.task_id) ta.task_id, ta.status_id
                    FROM task_activities ta
                    ORDER BY ta.task_id, ta.created_at DESC
                ) last_status ON last_status.task_id = t.id
                WHERE t.assigned_employee_id = e.id
                  AND t.deleted_at IS NULL
                  AND COALESCE(last_status.status_id, 1) < 5
            ) AS active_task_count,

            -- Completed task count (status_id = 5)
            (
                SELECT COUNT(*)
                FROM tasks t
                         LEFT JOIN (
                    SELECT DISTINCT ON (ta.task_id) ta.task_id, ta.status_id
                    FROM task_activities ta
                    ORDER BY ta.task_id, ta.created_at DESC
                ) last_status ON last_status.task_id = t.id
                WHERE t.assigned_employee_id = e.id
                  AND t.deleted_at IS NULL
                  AND COALESCE(last_status.status_id, 1) = 5
            ) AS completed_task_count,

            -- Sum of points
            (
                SELECT SUM(t.points)
                FROM tasks t
                WHERE t.assigned_employee_id = e.id
                  AND t.deleted_at IS NULL
            ) AS points_sum,

            -- Average of points
            (
                SELECT AVG(t.points)
                FROM tasks t
                WHERE t.assigned_employee_id = e.id
                  AND t.deleted_at IS NULL
            ) AS points_avg,
            
            -- Average work time (HH:MI format)
            (
                SELECT to_char(
                               make_interval(secs := ROUND(AVG(EXTRACT(EPOCH FROM (exit.review_time - entry.review_time)))))
                           , 'HH24:MI'
                       )
                FROM employee_activities exit
                         JOIN employee_activities entry
                              ON exit.employee_id = entry.employee_id
                                  AND entry.type = 1
                                  AND exit.type = 2
                                  AND entry.status = 2 AND entry.completed_status = 1
                                  AND exit.status = 2 AND exit.completed_status = 1
                                  AND entry.review_time < exit.review_time
                                  AND NOT EXISTS (
                                      SELECT 1
                                      FROM employee_activities e2
                                      WHERE e2.employee_id = entry.employee_id
                                        AND e2.type = 1
                                        AND e2.status = 2 AND e2.completed_status = 1
                                        AND e2.review_time > entry.review_time
                                        AND e2.review_time < exit.review_time
                                  )
                WHERE exit.employee_id = e.id
            ) AS work_time_avg

        FROM employees e
        WHERE e.id = $1
    `, [employee_id])

    return res.status(200).json({
        success: true,
        message: '',
        data: rows?.[0]
    })
})

export default router