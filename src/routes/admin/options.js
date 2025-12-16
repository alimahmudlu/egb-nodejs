import checkAuth from "../../middleware/checkAuth.js";
import db from "../../helper/db.js";
import express from "express";
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

// OPTIONS
router.get('/projects', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`SELECT
                                       p.*,
                                       (
                                            SELECT json_build_object('id', r.id, 'name', r.name)  
                                            FROM roles r
                                            WHERE role_id = pm.role_id LIMIT 1
                                       ) as role_id,
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
                                                ),
                                                '[]'::jsonb
                                            )
                                            FROM project_members pm1
                                            JOIN employees e1 ON e1.id = pm1.employee_id
                                            LEFT JOIN employee_roles er ON er.employee_id = e1.id
                                            LEFT JOIN roles r ON r.id = er.role
                                            WHERE pm1.project_id = p.id
                                        ) AS members
                                   FROM projects p`, [])

    res.json({
        success: true,
        message: 'Option Projects fetched successfully',
        data: rows
    })
})

export default router