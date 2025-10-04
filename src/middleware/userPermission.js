import db from "../helper/db.js";
import moment from "moment";

async function userPermission (req, res, next) {
    try {
        // const id = req.currentUserId;
        // const {rows: userRole} = await db.query('SELECT * FROM employee_roles WHERE employee_id = $1', [id])
        // if (!['GET', 'get'].includes(req?.method) && userRole?.[0]?.role === 1) {
        //     const {rows: uploadsDoc} = await db.query(`
        //         SELECT
        //             a.amina_user,
        //             (SELECT to_jsonb(au.*) FROM application_uploads au WHERE au.application_id = a.id AND au.type = $2 AND au.status = $3 AND au.deleted_at IS NULL ORDER BY id DESC LIMIT 1) AS registration_card
        //         FROM applications a
        //             LEFT JOIN employees e ON e.application_id = a.id
        //         WHERE e.id = $1
        //         LIMIT 1
        //     `, [id, 'registration_card', 1])
        //
        //
        //     if (!uploadsDoc || uploadsDoc?.length === 0 || uploadsDoc?.[0]?.amina_user || moment(uploadsDoc?.[0]?.registration_card?.date_of_expiry).isBefore(moment())) {
        //         return res.status(403).json({
        //             success: false,
        //             message: 'Permission denied',
        //             error: 'Registration card expired. Please contact admin.',
        //             data: null
        //         });
        //     }
        // }
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