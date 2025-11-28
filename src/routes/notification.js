import express from "express";
import db from "../helper/db.js";

const router = express.Router()

router.post('/token/create', async (req, res) => {
    const {token} = req.body;
    const userId = req.currentUserId;

    const {rows: existingRows} = await db.query(`SELECT * FROM notification_tokens WHERE user_id = $1 AND token = $2`, [userId, token])

    if (existingRows.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Token already exists'
        })
    }
    const {rows: createdRows} = await db.query(`INSERT INTO notification_tokens
                                                    (user_id, token, status)
                                                VALUES ($1, $2, 1)
RETURNING *`,
        [userId, token]
    )

    res.status(201).json({
        success: true,
        message: 'Token created successfully',
        data: {salam: 'aaaa'}
    })
})

router.post('/token/delete', async (req, res) => {
    const {token} = req.body;
    const userId = req.currentUserId;


    const {rows: existingRows} = await db.query(`
        UPDATE notification_tokens 
        SET status = 0
        WHERE user_id = $1 AND token = $2`, [userId, token])

    console.log(userId, token, existingRows)

    if (existingRows.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Token does not exists'
        })
    }
    res.status(201).json({
        success: true,
        message: 'Token created successfully',
        data: existingRows?.[0]
    })
})

export default router