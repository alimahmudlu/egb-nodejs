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

    const {rows} = await db.query(`SELECT *,
                                          (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                           FROM task_statuses ts WHERE status = ts.id LIMIT 1) as status,
       (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
        FROM employees e WHERE id = t.assigned_employee_id LIMIT 1) as assigned_employee,
       (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
        FROM employees e WHERE id = t.reporter_employee_id LIMIT 1) as reporter_employee
                                   FROM tasks t WHERE t.project_id = $1 AND t.assigned_employee_id = $2`, [id, req?.currentUserId])

    res.json({
        success: true,
        message: 'Project tasks fetched successfully by ID',
        data: rows || []
    })
})

router.get('/item/:id/tasks/item/:task_id', checkAuth, async (req, res) => {
    const {id, task_id} = req.params;

    const {rows} = await db.query(`SELECT *,
                                          (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                           FROM task_statuses ts WHERE status = ts.id LIMIT 1) as status,
       (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
        FROM employees e WHERE id = t.assigned_employee_id LIMIT 1) as assigned_employee,
       (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
        FROM employees e WHERE id = t.reporter_employee_id LIMIT 1) as reporter_employee
                                   FROM tasks t WHERE t.project_id = $1 AND t.assigned_employee_id = $2 AND t.id = $3`, [id, req?.currentUserId, task_id])


    res.json({
        success: true,
        message: 'Project task fetched successfully by ID and task ID',
        data: rows?.[0] || {}
    })
})

router.post('/item/:id/tasks/item/:task_id/status', checkAuth, async (req, res) => {
    const {task_id} = req.params;
    const {date, status, files} = req.body;

    const {rows} = await db.query(`
                INSERT INTO task_activities
                (
                    task_id,
                    status_id,
                    created_at,
                    created_employee_id
                )
                VALUES ($1, $2, $3, $4) RETURNING *
        `,
        [task_id, status, date, req.currentUserId])

    if (files.length > 0) {
        const valuesClause = files.map(
            (row, i) => `($${i * row.length + 1}, $${i * row.length + 2}), $${i * row.length + 3}), $${i * row.length + 4})`
        ).join(', ');

        const values = files.map((row, i) => (
            [rows?.[0]?.id, row.id, date, req.currentUserId]
        )).flat()


        const {rows: createFileRows} = await db.query(`
            INSERT INTO task_files
            (
                task_activity_id,
                upload_id,
                created_at,
                created_employee_id
            )
            VALUES ${valuesClause} RETURNING *
    `,
            values)
    }



    res.json({
        success: true,
        message: 'Project task status change successful',
        data: rows?.[0] || {}
    })
})

export default router