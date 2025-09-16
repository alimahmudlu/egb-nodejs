import db from "../helper/db.js";
import moment from "moment";

async function userPermission (req, res, next) {
    try {
        const id = req.currentUserId;
        const {rows: userRole} = await db.query('SELECT * FROM employee_roles WHERE employee_id = $1', [id])
        if (!['GET', 'get'].includes(req?.method) && userRole?.[0]?.role === 1) {
            const {rows: uploadsDoc} = await db.query(`
                SELECT au.*
                FROM application_uploads au
                         LEFT JOIN employees e ON e.id = $1
                WHERE au.application_id = e.application_id AND type = $2 AND status = $3 AND deleted_at IS NULL
                ORDER BY id DESC
            `, [id, 'registration_card', 1])


            if (!uploadsDoc || uploadsDoc?.length === 0 || moment(uploadsDoc?.[0]?.date_of_expiry).isBefore(moment())) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied',
                    error: 'Registration card expired. Please contact admin.',
                    data: null
                });
            }
        }
        next()
    }
    catch (error) {
        return res.status(401).json({
            message: 'Unauthorized',
            error: error.message,
            data: null
        });
    }
}

export default userPermission