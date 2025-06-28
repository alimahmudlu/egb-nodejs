import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import moment from "moment/moment.js";

const router = express.Router()

router.get('/list', checkAuth, async (req, res) => {
    const {start_date, end_date} = req.query;
    const filters = [];
    const values = [];
    let idx = 1;

    if (start_date) {
        filters.push(`review_time >= $${idx}`);
        values.push(start_date)
        idx++
    }
    if (end_date) {
        filters.push(`review_time <= $${idx}`);
        values.push(end_date)
        idx++
    }
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
                                   WHERE ${filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''}
        ORDER BY ea.id DESC;
        `, [...values])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows
    })
})

export default router