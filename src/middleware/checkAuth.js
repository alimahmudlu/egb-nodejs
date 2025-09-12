import verifyJWT from "../helper/verifyJWT.js";
import db from "../helper/db.js";
import moment from "moment";

async function checkAuth (req, res, next) {
    const access_token = req.headers?.authorization;

    try {
        const {id} = verifyJWT(access_token);
        const {rows: userAuthRows} = await db.query('SELECT * FROM employee_auth WHERE employee_id = $1', [id])
        if (!userAuthRows || userAuthRows.length === 0) {
            throw new Error('User not found');
        }
        req.currentUserId = id;

        console.log(req?.method !== 'GET' || req?.method !== 'get', req?.method, 'req.method')
        if (req?.method !== 'GET' || req?.method !== 'get') {
            console.log('ssss')
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

export default checkAuth