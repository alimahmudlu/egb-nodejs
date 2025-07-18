
// const express = require('express')
// const db = require("../helper/db");
// const isValidPassword = require("../helper/isValidPassword");

import express from 'express'
import db from '../helper/db.js'
import isValidPassword from '../helper/isValidPassword.js'
import generateJWT from "../helper/generateJWT.js";

const router = express.Router()
/**
 * @api {post} /auth
 * @apiName Auth Login
 * @apiGroup auth
 * @apiPermission credentials: {email, password}
 *
 * @apiDescription Login edir
 *
 * @apiSampleRequest off
 *
 * @apiError (500 Internal Server Error) InternalServerError The server encountered an internal error
 *
 */
router.post('/', async (req, res) => {
    const {id, password} = req.body;

    if (!id || !password) {
        return res.status(400).json({error: 'Email and password are required'});
    }

    const {rows: userAuthRows} = await db.query('SELECT * FROM employee_auth WHERE employee_id = $1', [id])

    if(userAuthRows.length > 0 && isValidPassword(password, userAuthRows?.[0]?.password)) {
        const {rows: userDataRows} =
            await db.query(`
                SELECT
                    e.*,
                    (
                        SELECT jsonb_build_object('id', r.id, 'name', r.name)
                        FROM employee_roles er
                                 LEFT JOIN roles r ON r.id = er.role
                        WHERE er.employee_id = e.id
                        LIMIT 1
                    ) AS role,
                    (SELECT sum(t.points) FROM tasks t WHERE assigned_employee_id = e.id OR reporter_employee_id = e.id) AS rating,
                    (
                        SELECT to_jsonb(p.*) FROM positions p WHERE p.id = e.position
                    ) AS position,
                    (
                        SELECT flow_id FROM applications a WHERE a.id = e.application_id LIMIT 1
                    ) AS flow
                FROM employees e
                WHERE e.id = $1;
            `, [id])

        const token = generateJWT({
            id: userDataRows[0].id,
            full_name: userDataRows[0].full_name,
        });
        return res.json(JSON.stringify({
            success: true,
            message: 'Login successful',
            token: {accessToken: token},
            user: userDataRows[0]
        }));
    }
    else {
        return res.status(500).json({
            success: false,
            message: 'Password or id is incorrect ',
            data: null
        });
    }

})



/**
 * @api {post} /logout
 * @apiName Auth Logout
 * @apiGroup auth
 * @apiPermission headers: {authorization: token id}
 *
 * @apiDescription Logout edir
 *
 * @apiSampleRequest off
 *
 * @apiError (500 Internal Server Error) InternalServerError The server encountered an internal error
 *
 */
router.post('/logout', (req, res) => {
    // const header = req.headers.authorization;
    // let token, id
    // if (header) {
    //     token  = header.split(' ')[0]
    //     id     = header.split(' ')[1]
    // }
    // querySync(`UPDATE Users SET token='' WHERE token=?, id=?`, [token, id]).then(data => {
    //     if (data.changedRows) {
    //         res.json({success: true, message: 'Çıxış uğurlu oldu.'})
    //     }
    //     else {
    //         res.json({success: false, message: 'Xəta baş verdi.'})
    //     }
    // })
            res.json({success: true, message: 'Logout successful'})
})



export default router
