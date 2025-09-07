import checkAuth from "../../middleware/checkAuth.js";
import db from "../../helper/db.js";
import express from "express";

const router = express.Router()

// OPTIONS
router.get('/projects', checkAuth, async (req, res) => {
    const {rows} = await db.query(`SELECT
                                       p.*,
                                       (
                                            SELECT json_build_object('id', r.id, 'name', r.name)  
                                            FROM roles r
                                            WHERE role_id = pm.role_id LIMIT 1
                                       ) as role_id
                                   FROM project_members pm
                                   JOIN projects p ON p.id = pm.project_id
                                   WHERE pm.employee_id = $1  AND pm.status = 1`, [req.currentUserId])

    res.json({
        success: true,
        message: 'Option Projects fetched successfully',
        data: rows
    })
})

export default router