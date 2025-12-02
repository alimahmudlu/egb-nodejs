import verifyJWT from "../helper/verifyJWT.js";
import db from "../helper/db.js";
import moment from "moment";

async function checkAuth (req, res, next) {
    const access_token = req.headers?.authorization;

    try {
        const {id} = verifyJWT(access_token);
        const {rows: userAuthRows} = await db.query('SELECT * FROM employee_auth WHERE employee_id = $1', [id])
        const {rows: userRole} = await db.query('SELECT * FROM employee_roles WHERE employee_id = $1', [id])

        console.log(userAuthRows, id)

        if (!userAuthRows || userAuthRows.length === 0) {
            throw new Error('User not found');
        }
        req.currentUserId = id;

        next()
    }
    catch (error) {
        // return res.status(401).json({
        //     message: 'Unauthorized',
        //     error: error.message,
        //     data: null
        // });
        console.log(error)
    }
}

export default checkAuth