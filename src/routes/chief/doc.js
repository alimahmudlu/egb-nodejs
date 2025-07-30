import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'

const router = express.Router()

router.get('/list', checkAuth, async (req, res) => {
    const {rows} = await db.query(`SELECT au.date_of_expiry, au.date_of_issue, u.filesize, u.mimetype, u.filepath, u.filename, u.id, au.type, au.employee_id
                                   FROM application_uploads au
                                            JOIN uploads u ON u.id = au.upload_id
                                   WHERE au.application_id IN (SELECT application_id FROM employees WHERE id = $1) and (au.date_of_expiry > now() OR au.date_of_expiry IS NULL) AND deleted_at IS NULL AND status = 1;
    `, [req.currentUserId])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

router.post('/add', checkAuth, async (req, res) => {
    const {document, date_of_issue, date_of_expiry, file, application_id} = req.body;

    const {rows: InsertedRow} = await db.query(
        `INSERT INTO application_uploads
             (application_id, upload_id, type, date_of_issue, date_of_expiry, employee_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [application_id, file, document?.id, date_of_issue || null, date_of_expiry || null, req.currentUserId]
    )

    const {rows} = await db.query(
        `UPDATE application_uploads
        SET status = 0
        WHERE application_id = $1 AND upload_id = $2`,
        [application_id, file]
    )

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: InsertedRow
    })
})

router.post('/remove', checkAuth, async (req, res) => {
    const {file, application_id} = req.body;

    const {rows: InsertedRow} = await db.query(
        `UPDATE application_uploads
        SET deleted_at = now(), status = 0
        WHERE application_id = $1 AND upload_id = $2 AND employee_id = $3`,
        [application_id, file, req.currentUserId]
    )

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: InsertedRow
    })
})


router.get('/history', checkAuth, async (req, res) => {
    const {rows} = await db.query(`SELECT au.date_of_expiry, au.date_of_issue, u.filesize, u.mimetype, u.filepath, u.filename, u.id, au.type
                                   FROM application_uploads au
                                            JOIN uploads u ON u.id = au.upload_id
                                   WHERE au.application_id IN (SELECT application_id FROM employees WHERE id = $1) and au.date_of_expiry < now();
    `, [req.currentUserId])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

export default router