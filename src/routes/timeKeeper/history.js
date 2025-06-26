import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'

const router = express.Router()

router.get('/list', checkAuth, async (req, res) => {
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
        ORDER BY ea.id DESC;
        `)

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows
    })
})

export default router