import express from "express";
import checkAuth from "../../middleware/checkAuth.js";
import db from "../../helper/db.js";
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import moment from "moment";
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

router.get('/clickup/list', checkAuth, userPermission, async (req, res) => {
    const query = `
                    SELECT
                        t.*,
                        (
                            SELECT 
                                json_build_object('id', ts.id, 'name', ts.name)
                            FROM 
                                task_statuses ts
                            WHERE 
                                ts.id = COALESCE((
                                    SELECT 
                                        ta.status_id
                                    FROM
                                        task_activities ta
                                    WHERE 
                                        ta.task_id = t.id
                                    ORDER BY 
                                        ta.created_at DESC
                                    LIMIT 1
                                ), 1)
                            LIMIT 1
                        ) as status,
                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE assigned_employee_id = e.id LIMIT 1) as assigned_employee,
                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE reporter_employee_id = e.id LIMIT 1) as reporter_employee,
                        COALESCE(t_a.status_id, 1) AS current_status_id,
                        CASE 
                            WHEN t_a.status_id IS NULL THEN 1
                            
                            WHEN t_a.status_id IN (2,3,4,5,6,8) THEN 2
                            
                            WHEN t_a.status_id = 7 THEN 3
                            
                            ELSE t_a.status_id
                            END AS current_status_id_mapped,
                        COUNT(t.id) OVER() AS total_tasks_count
                    FROM 
                        tasks t
                    LEFT JOIN (
                        SELECT
                            task_id,
                            status_id,
                            created_at,
                            ROW_NUMBER() OVER(PARTITION BY task_id ORDER BY created_at DESC) as rn
                        FROM
                            task_activities
                    ) t_a ON t.id = t_a.task_id AND t_a.rn = 1
                                WHERE t.assigned_employee_id = $1 AND deleted_at IS NULL AND
                                    EXISTS (
                                        SELECT 1
                                        FROM project_members pm1
                                        WHERE pm1.employee_id = $1
                                        AND pm1.status = 1
                                    )
                    ORDER BY
                         current_status_id, t.created_at DESC;`

    const {rows} = await db.query(query, [req.currentUserId]);

    console.log(rows, 'rows')

    res.status(200).json({
        success: true,
        message: 'Tasks fetched successfully',
        data: rows
    })
})

export default router