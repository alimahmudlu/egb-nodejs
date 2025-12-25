import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

router.get('/list', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`SELECT au.date_of_expiry, au.date_of_issue, u.filesize, u.mimetype, u.filepath, u.filename, au.id, au.type, au.employee_id
                                   FROM application_uploads au
                                            JOIN uploads u ON u.id = au.upload_id
                                            JOIN applications a ON a.id IN (SELECT application_id FROM employees WHERE id = $1)
                                   WHERE au.application_id IN (SELECT application_id FROM employees WHERE id = $1) and (au.date_of_expiry > now() OR au.date_of_expiry IS NULL) AND au.deleted_at IS NULL AND au.status = 1 AND NOT (
                                       a.country_id = 219 AND au.type = 'contract'
                                       );
    `, [req.currentUserId])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

router.post('/add', checkAuth, async (req, res) => {
    const {document, date_of_issue, date_of_expiry, file, application_id} = req.body;

    const {rows} = await db.query(
        `UPDATE application_uploads
         SET status = 0
         WHERE application_id = $1 AND type = $2`,
        [application_id, document?.id]
    )

    const {rows: InsertedRow} = await db.query(
        `INSERT INTO application_uploads
         (application_id, upload_id, type, date_of_issue, date_of_expiry, employee_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [application_id, file, document?.id, date_of_issue || null, date_of_expiry || null, req.currentUserId, 1]
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
         WHERE application_id = $1 AND id = $2 AND employee_id = $3`,
        [application_id, file, req.currentUserId]
    )

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: InsertedRow
    })
})



router.get('/history', checkAuth, userPermission, async (req, res) => {
    const {replaced} = req.query

    const query = `SELECT au.date_of_expiry, au.date_of_issue, u.filesize, u.mimetype, u.filepath, u.filename, u.id, au.type
                                   FROM application_uploads au
                                            JOIN uploads u ON u.id = au.upload_id
                                   WHERE au.application_id IN (SELECT application_id FROM employees WHERE id = $1) and au.date_of_expiry < now() 
                                        ${replaced ? (replaced === '1' ? ` AND EXISTS (
      SELECT 1 
      FROM application_uploads au2 
      WHERE au2.application_id = au.application_id 
        AND au2.type = au.type 
        AND au2.id > au.id
  );` : ` AND NOT EXISTS (
      SELECT 1 
      FROM application_uploads au2 
      WHERE au2.application_id = au.application_id 
        AND au2.type = au.type 
        AND au2.id > au.id
  );`) : ''};
    `

    const {rows} = await db.query(query, [req.currentUserId])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

export default router