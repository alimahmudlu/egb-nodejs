import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

router.get('/details/:employee_id', checkAuth, userPermission, async (req, res) => {
    const {employee_id} = req.params;
    
    const {rows} = await db.query(`
        WITH TaskStats AS (
            -- Taskların son statuslarını bir dəfə hesablayırıq
            SELECT
                t.assigned_employee_id,
                COUNT(*) FILTER (WHERE COALESCE(ls.status_id, 1) != 7) AS active_task_count,
                COUNT(*) FILTER (WHERE ls.status_id = 7) AS completed_task_count,
                SUM(t.points) AS points_sum,
                AVG(t.points) AS points_avg
            FROM tasks t
                     LEFT JOIN LATERAL (
                SELECT ta.status_id
                FROM task_activities ta
                WHERE ta.task_id = t.id
                ORDER BY ta.created_at DESC
                    LIMIT 1
            ) ls ON TRUE
        WHERE t.deleted_at IS NULL
        GROUP BY t.assigned_employee_id
            ),
            WorkTimeStats AS (
        -- İş vaxtının ortalamasını hesablayırıq
        SELECT
            entry.employee_id,
            TO_CHAR(AVG(
            make_interval(
            hours := split_part(entry.work_time, ':', 1)::int,
            mins  := split_part(entry.work_time, ':', 2)::int
            )
            ), 'HH24:MI') AS work_time_avg
        FROM employee_activities entry
            JOIN employee_activities exit ON entry.employee_id = exit.employee_id
            AND entry.type = 1 AND exit.type = 2
            AND entry.status = 2 AND entry.completed_status = 1
            AND exit.status = 2 AND exit.completed_status = 1
            AND entry.review_time < exit.review_time
        WHERE NOT EXISTS (
            SELECT 1 FROM employee_activities e2
            WHERE e2.employee_id = entry.employee_id
          AND e2.type = 1
          AND e2.review_time > entry.review_time
          AND e2.review_time < exit.review_time
            )
        GROUP BY entry.employee_id
            )

        SELECT
            e.*,
            COALESCE(ts.active_task_count, 0) AS active_task_count,
            COALESCE(ts.completed_task_count, 0) AS completed_task_count,
            COALESCE(ts.points_sum, 0) AS points_sum,
            COALESCE(ts.points_avg, 0) AS points_avg,
            COALESCE(wts.work_time_avg, '00:00') AS work_time_avg
        FROM employees e
                 LEFT JOIN TaskStats ts ON e.id = ts.assigned_employee_id
                 LEFT JOIN WorkTimeStats wts ON e.id = wts.employee_id
        WHERE e.id = $1;
    `, [employee_id])

    return res.status(200).json({
        success: true,
        message: '',
        data: rows?.[0]
    })
})

export default router