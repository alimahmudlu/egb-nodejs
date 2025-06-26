import express from "express";
import db from "../helper/db.js";

const router = express.Router()

router.post('/token/create', async (req, res) => {
    const {userId, token} = req.body;

    const {rows: createdRows} = await db.query(`INSERT INTO notification_tokens
                                                    (user_id, token, status)
                                                VALUES ($1, $2, 1)
                                                    ON CONFLICT (token) DO NOTHING
RETURNING *`,
        [userId, token]
    )

    console.log(createdRows, 'createdRows')

    res.status(201).json({
        success: true,
        message: 'Token created successfully',
        data: {salam: 'aaaa'}
    })
})

router.post('/token/delete', async (req, res) => {
    const {userId, token} = req.body;

    console.log(userId, token, 'userId, token')

    const {rows: createdRows} = await db.query(`INSERT INTO notification_tokens 
                        (user_id, token, status)  
                        VALUES ($1, $2, 1) RETURNING * `,
        [userId, token]
    )

    res.status(201).json({
        success: true,
        message: 'Token created successfully',
        data: createdRows[0]
    })
})

export default router