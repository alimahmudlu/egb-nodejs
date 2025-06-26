import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'

const router = express.Router()

router.get('/details/:employee_id', checkAuth, async (req, res) => {
    const {employee_id} = req.params;

    const {rows} = await db.query(`
        SELECT
            e.*,
            COALESCE(ci.check_in_count, 0) AS check_in_count,
            COALESCE(co.check_out_count, 0) AS check_out_count,
            json_build_object(
                    'id', er.id,
                    'name', r.name
            ) AS role
        FROM employees e
                 LEFT JOIN (
            SELECT employee_id, COUNT(*) AS check_in_count
            FROM employee_activities
            WHERE type = 1 AND status > 0
            GROUP BY employee_id
        ) ci ON ci.employee_id = e.id
                 LEFT JOIN (
            SELECT employee_id, COUNT(*) AS check_out_count
            FROM employee_activities
            WHERE type = 2 AND status > 0
            GROUP BY employee_id
        ) co ON co.employee_id = e.id
                 LEFT JOIN employee_roles er ON e.id = er.employee_id
                 LEFT JOIN roles r ON r.id = er.role
        WHERE e.id = $1;
        `, [employee_id])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows?.[0] || {}
    })
})

router.get('/history/:employee_id/checkin', checkAuth, async (req, res) => {
    const {employee_id} = req.params;

    const {rows} = await db.query(`
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role
        WHERE ea.employee_id = $1 AND ea.type = 1 AND ea.status > 0
        ORDER BY ea.id DESC;
        `, [employee_id])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows || []
    })
})

router.get('/history/:employee_id/checkout', checkAuth, async (req, res) => {
    const {employee_id} = req.params;

    const {rows} = await db.query(`
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role
        WHERE ea.employee_id = $1 AND ea.type = 2 AND ea.status > 0
        ORDER BY ea.id DESC;
        `, [employee_id])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows || []
    })
})

export default router