import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import moment from "moment/moment.js";

const router = express.Router()

router.get('/list', checkAuth, async (req, res) => {
    const {start_date, end_date, full_name} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (start_date) {
        filters.push(`review_time >= $${idx}`);
        values.push(moment(start_date).format())
        idx++
    }
    if (end_date) {
        filters.push(`review_time <= $${idx}`);
        values.push(moment(end_date).format())
        idx++
    }
    if (full_name) {
        filters.push(`e.full_name = $${idx}`);
        values.push(full_name)
        idx++
    }
    const {rows} = await db.query(`
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'manual', e.dont_have_phone,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role

        WHERE EXISTS (
            SELECT 1
            FROM project_members pm1
                     JOIN project_members pm2 ON pm1.project_id = pm2.project_id
            WHERE pm1.employee_id = ea.employee_id
              AND pm2.employee_id = $1
        )
                                   ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}
        ORDER BY ea.id DESC;
        `, [req.currentUserId, ...values])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows
    })
})

export default router