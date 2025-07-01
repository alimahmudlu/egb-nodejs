import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'

const router = express.Router()

router.get('/list', checkAuth, async (req, res) => {
    const {rows} = await db.query(`SELECT
                                       p.*,
                                       (SELECT json_build_object('id', r.id, 'name', r.name)  FROM roles r
                                        WHERE role_id = pm.role_id LIMIT 1) as role_id,
    (
        SELECT COALESCE(
                       jsonb_agg(
                               jsonb_build_object(
                                       'id', e1.id,
                                       'full_name', e1.full_name,
                                       'phone_number', e1.phone_number,
                                       'role', jsonb_build_object(
                                               'id', r.id,
                                               'name', r.name
                                               )
                               )
                       ),
                       '[]'::jsonb
               )
        FROM project_members pm1
                 JOIN employees e1 ON e1.id = pm1.employee_id
                 LEFT JOIN employee_roles er ON er.employee_id = e1.id
                 LEFT JOIN roles r ON r.id = er.role
        WHERE pm1.project_id = p.id
    ) AS members
                                   FROM project_members pm
                                       LEFT JOIN projects p ON p.id = pm.project_id
                                   WHERE pm.employee_id = $1`, [req.currentUserId])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

router.get('/item/:id', checkAuth, async (req, res) => {
    const {id} = req.params;
    const {rows} = await db.query(`SELECT * FROM projects WHERE id = $1`, [id])

    res.json({
        success: true,
        message: 'Project fetched successfully by ID',
        data: rows?.[0] || {}
    })
})

router.get('/item/:id/tasks', checkAuth, async (req, res) => {
    const {id} = req.params;

    // const {rows} = await db.query(`SELECT *,
    //                                       (SELECT json_build_object('id', ts.id, 'name', ts.name)
    //                                        FROM task_statuses ts WHERE status = ts.id LIMIT 1) as status,
    //    (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
    //     FROM employees e WHERE id = t.assigned_employee_id LIMIT 1) as assigned_employee,
    //    (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
    //     FROM employees e WHERE id = t.reporter_employee_id LIMIT 1) as reporter_employee
    //                                FROM tasks t WHERE t.project_id = $1`, [id])

    const {rows} = await db.query(`SELECT
                                        t.*,
                                        (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                         FROM task_statuses ts
                                         WHERE ts.id = COALESCE((
                                                                    SELECT ta.status_id
                                                                    FROM task_activities ta
                                                                    WHERE ta.task_id = t.id
                                                                    ORDER BY ta.created_at DESC
                                                                LIMIT 1
                                             ), 1)
                                            LIMIT 1
                                       ) as status,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE assigned_employee_id = e.id LIMIT 1) as assigned_employee
                                    FROM tasks t
                                    WHERE project_id = $1 AND deleted_at IS NULL`, [id]);

    res.json({
        success: true,
        message: 'Project tasks fetched successfully by ID',
        data: rows || []
    })
})

router.get('/item/:id/tasks/item/:task_id', checkAuth, async (req, res) => {
    const {id, task_id} = req.params;

    const {rows} = await db.query(`SELECT t.*,
                                          (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                           FROM task_statuses ts
                                           WHERE ts.id = COALESCE((
                                                                      SELECT ta.status_id
                                                                      FROM task_activities ta
                                                                      WHERE ta.task_id = t.id
                                                                      ORDER BY ta.created_at DESC
                                                                  LIMIT 1
                                               ), 1)
                                              LIMIT 1
                                       ) as status,
                                    (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE assigned_employee_id = e.id LIMIT 1) as assigned_employee,
                                    (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE reporter_employee_id = e.id LIMIT 1) as reporter_employee
                                    FROM tasks t
                                    WHERE  t.project_id = $1 AND created_employee_id = $2 AND t.id = $3`, [id, req?.currentUserId, task_id])


    res.json({
        success: true,
        message: 'Project task fetched successfully by ID and task ID',
        data: rows?.[0] || {}
    })
})


export default router