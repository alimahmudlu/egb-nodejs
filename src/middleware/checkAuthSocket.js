import verifyJWT from "../helper/verifyJWT.js";
import db from "../helper/db.js";

async function checkAuthSocket (token) {
    const {id} = verifyJWT(token);
    const {rows: userAuthRows} = await db.query('SELECT * FROM employee_auth WHERE employee_id = $1', [id])
    if (!userAuthRows || userAuthRows.length === 0) {
        throw new Error('User not found');
    }

    return {id};
}

export default checkAuthSocket