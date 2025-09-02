import checkAuth from "../../middleware/checkAuth.js";
import db from "../../helper/db.js";
import express from "express";

const router = express.Router()

// OPTIONS
router.get('/projects', checkAuth, async (req, res) => {
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
        message: 'Option Projects fetched successfully',
        data: rows
    })
})

router.get('/employees/:project_id', checkAuth, async (req, res) => {
    const projectId = req.params.project_id;
    const {rows} = await db.query(`SELECT e.*,
                                          (
                                              SELECT to_jsonb(p.*) FROM positions p WHERE p.id = e.position
                                          ) AS position
                                   FROM project_members pm
                                   LEFT JOIN employees e ON pm.employee_id = e.id and e.is_active = true
                                   where role_id = 1 and pm.project_id = $1 AND pm.status = 1`, [projectId])

    res.json({
        success: true,
        message: 'Option Task Statuses fetched successfully',
        data: rows
    })
})

router.get('/task_statuses', checkAuth, async (req, res) => {
    const {rows} = await db.query(`SELECT * FROM task_statuses`)

    res.json({
        success: true,
        message: 'Option Task Statuses fetched successfully',
        data: rows
    })
})

export default router