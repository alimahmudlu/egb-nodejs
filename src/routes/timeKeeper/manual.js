import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import moment from "moment/moment.js";

const router = express.Router()

router.get('/list', checkAuth, async (req, res) => {
    const {start_date, end_date, full_name, project} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (project) {
        filters.push(`EXISTS (
            SELECT 1
            FROM project_members pm1
                     JOIN project_members pm2 ON pm1.project_id = pm2.project_id
            WHERE pm1.employee_id = ea.employee_id
            AND pm1.project_id = $${idx}
        )`);
        values.push(project)
        idx++
    }
    if (full_name) {
        filters.push(`(LOWER(e.full_name) LIKE LOWER($${idx}))`);
        values.push(`%${full_name}%`);
        idx++
    }

    const {rows} = await db.query(`
        SELECT e.*, json_build_object(
                'id', er.id,
                'name', r.name
                    ) as role,
               (SELECT row_to_json(ea.*) FROM employee_activities ea
                WHERE employee_id = e.id
                  AND completed_status = 0
                  AND type = 1
                ORDER BY ea.id
                         LIMIT 1
            ) as checkIn,
        (SELECT row_to_json(ea.*) FROM employee_activities ea
                    WHERE employee_id = e.id
                      AND completed_status = 0
                      AND type = 2
                    ORDER BY ea.id
                             LIMIT 1
                ) as checkout
        FROM employees e
            LEFT JOIN employee_roles er ON e.id = er.employee_id
            LEFT JOIN roles r ON r.id = er.role
        WHERE e.dont_have_phone = true OR e.is_draft = true
            ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}
        `)

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows
    })
})

router.post('/checkin', checkAuth, async (req, res) => {
    const { employee_id, employee_timezone, request_time, longitude, latitude, work_time } = req.body;

    const {rows: checkedInRows} =
        await db.query(`
            SELECT id FROM employee_activities
            WHERE employee_id = $1 AND status != 3 AND type = 1 AND completed_status = 0
            ORDER BY id DESC
                LIMIT 1
        `, [employee_id])

    if (checkedInRows.length === 0) {
        const {rows: insertedRow} = await db.query(`
        INSERT INTO employee_activities
        (
            activity_id,
            employee_id,
            employee_timezone,
            request_time,
            type,
            longitude,
            latitude,
            reviewer_employee_id,
            reviewer_timezone,
            review_time,
            status,
            completed_status,
            reject_reason,
            work_time,
         is_manual
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *
    `,
        [
            null,
            employee_id,
            employee_timezone,
            request_time,
            1,
            longitude,
            latitude,
            req.currentUserId,
            employee_timezone,
            request_time,
            2,
            0,
            null,
            null,
            true
        ]);

        const {rows: thisInsertedRow} = await db.query(`
            SELECT e.*, json_build_object(
                    'id', er.id,
                    'name', r.name
                        ) as role,
                   (SELECT row_to_json(ea.*) FROM employee_activities ea
                    WHERE employee_id = e.id
                      AND completed_status = 0
                      AND type = 1
                    ORDER BY ea.id
                             LIMIT 1
                ) as checkIn
            FROM employees e
                LEFT JOIN employee_roles er ON e.id = er.employee_id
                LEFT JOIN roles r ON r.id = er.role
            WHERE e.dont_have_phone = true AND e.id = $1
        `, [employee_id])


        return res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: thisInsertedRow?.[0]
        })
    }
    else {
        return res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})

router.post('/checkout', checkAuth, async (req, res) => {
    const { activity_id, employee_id, employee_timezone, request_time, longitude, latitude, work_time } = req.body;

    const {rows: checkInControlRow} = await db.query(`
        SELECT * FROM employee_activities ea WHERE employee_id = $1 and status = $2 and completed_status = $3 and type = $4
    `, [employee_id, 2, 0, 1])

    let diff = {
        hours: 0,
        minutes: 0
    }

    if (checkInControlRow?.[0].review_time) {

        const start = moment(checkInControlRow?.[0].review_time, 'YYYY-MM-DD HH:mm');
        const end = moment(request_time, 'YYYY-MM-DD HH:mm');

        const duration = moment.duration(end.diff(start));

        diff = {
            hours: Math.floor(duration.asHours()),
            minutes: duration.minutes()
        }
    }

    const {rows: checkInRow} = await db.query(`
        UPDATE employee_activities ea
        SET completed_status = $1, work_time = $6
        WHERE employee_id = $2 and status = $3 and completed_status = $4 and type = $5
            RETURNING *;
    `, [1, employee_id, 2, 0, 1, `${diff?.hours}:${diff?.minutes}`])

    const {rows: insertedRow} = await db.query(`
        INSERT INTO employee_activities
        (
            activity_id,
            employee_id,
            employee_timezone,
            request_time,
            type,
            longitude,
            latitude,
            reviewer_employee_id,
            reviewer_timezone,
            review_time,
            status,
            completed_status,
            reject_reason,
            work_time,
         is_manual
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *
    `,
        [
            activity_id ?? null,
            employee_id,
            employee_timezone,
            request_time,
            2,
            longitude,
            latitude,
            req.currentUserId,
            employee_timezone,
            request_time,
            2,
            1,
            null,
            `${diff?.hours}:${diff?.minutes}`,
            true
        ]);

    const {rows: thisInsertedRow} = await db.query(`
            SELECT e.*, json_build_object(
                    'id', er.id,
                    'name', r.name
                        ) as role,
                   (SELECT row_to_json(ea.*) FROM employee_activities ea
                    WHERE employee_id = e.id
                      AND completed_status = 1
                      AND type = 1
                    ORDER BY ea.id
                             LIMIT 1
                ) as checkin,
                   (SELECT row_to_json(ea.*) FROM employee_activities ea
                    WHERE employee_id = e.id
                      AND completed_status = 1
                      AND type = 2
                    ORDER BY ea.id
                             LIMIT 1
                ) as checkout
            FROM employees e
                LEFT JOIN employee_roles er ON e.id = er.employee_id
                LEFT JOIN roles r ON r.id = er.role
            WHERE e.id = $1
        `, [employee_id])


    return res.status(201).json({
        success: true,
        message: 'Activity created successfully',
        data: thisInsertedRow?.[0]
    })
})

export default router