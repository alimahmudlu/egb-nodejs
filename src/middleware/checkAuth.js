import verifyJWT from "../helper/verifyJWT.js";
import db from "../helper/db.js";

async function checkAuth (req, res, next) {
    const access_token = req.headers?.authorization;

    try {
        const {id} = verifyJWT(access_token);
        const {rows: userAuthRows} = await db.query('SELECT * FROM employee_auth WHERE employee_id = $1', [id])
        if (!userAuthRows || userAuthRows.length === 0) {
            throw new Error('User not found');
        }
        req.currentUserId = id;

        if (req?.method !== 'GET' || req?.method !== 'get') {
            const {rows: uploadsDoc} = await db.query(`
                SELECT * 
                FROM application_uploads 
                WHERE employee_id = $1 AND type = $2 AND status = $3 AND deleted_at IS NULL 
                ORDER BY id DESC
            `, [id, 'registration_card', 1])

            console.log(uploadsDoc, uploadsDoc?.[0])
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