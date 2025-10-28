import express from 'express'
import db from '../helper/db.js'
import checkAuth from '../middleware/checkAuth.js'
import userPermission from "../middleware/userPermission.js";

const router = express.Router()

router.get('/list', checkAuth, userPermission, async (req, res) => {
    const {full_name, role_id} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (role_id) {
        filters.push(`r.id = $${idx}`);
        values.push(role_id);
        idx++
    }
    if (full_name) {
        filters.push(`(LOWER(e1.full_name) LIKE LOWER($${idx}))`);
        values.push(`%${full_name}%`);
        idx++
    }

    const {rows} = await db.query(`SELECT
                                       p.*,
                                       (
                                           SELECT json_build_object('id', r.id, 'name', r.name)
                                           FROM roles r
                                           WHERE r.id = pm.role_id LIMIT 1
                                       ) AS role_info,
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
                    ),
                    'status', pm1.status
                )
            ) ${filters.length > 0 ? ` FILTER (WHERE ${filters.join(' AND ')} )` : ''},
                                       '[]'::jsonb
                                       )
                                       FROM project_members pm1
                                       JOIN employees e1 ON e1.id = pm1.employee_id
                                       LEFT JOIN employee_roles er ON er.employee_id = e1.id
                                       LEFT JOIN roles r ON r.id = er.role
                                       WHERE pm1.project_id = p.id
                                       AND pm1.status = 1
                                       ) AS members
                                   FROM project_members pm
                                       LEFT JOIN projects p ON p.id = pm.project_id
                                   WHERE
                                       pm.employee_id = $1
                                     AND pm.status = 1
                                     `, [req.currentUserId, ...values])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

export default router