import express from 'express'
import db from '../helper/db.js'
import checkAuth from '../middleware/checkAuth.js'

const router = express.Router()

router.get('/:id', checkAuth, async (req, res) => {
    const {id} = req.params;

    const {rows} = await db.query(`SELECT * FROM positions p WHERE p.id = $1`, [id])

    res.json({
        success: true,
        message: 'Position fetched successfully by ID',
        data: rows?.[0] || {}
    })
})
export default router