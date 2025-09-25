import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import moment from 'moment'

import { getIO, userSocketMap } from "./../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";


const router = express.Router()

router.get('/list', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee,
               (
                   SELECT json_build_object(
                                  'id', e.id,
                                  'full_name', e.full_name
                          )
                   FROM employees e
                   WHERE e.id = ea.reviewer_employee_id
                          LIMIT 1
            ) AS reviewer
        FROM employee_activities ea
            LEFT JOIN employees e ON e.id = ea.employee_id
            LEFT JOIN employee_roles er ON e.id = er.employee_id
            LEFT JOIN roles r ON r.id = er.role
        WHERE EXISTS (
            SELECT 1
            FROM project_members pm1
            JOIN project_members pm2 ON pm1.project_id = pm2.project_id
            WHERE pm1.employee_id = ea.employee_id
          AND pm2.employee_id = $1
            )
        AND ea.type IN (3, 4)
        ORDER BY ea.id DESC;
    `, [req.currentUserId])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows
    })
})

router.post('/accept', checkAuth, userPermission, async (req, res) => {
    const {activity_id, employee_id, type, confirm_time, timezone, confirm_type} = req.body

    if (!activity_id || !employee_id || !type) {
        return res.status(400).json({
            success: false,
            message: 'Activity ID, Employee ID and type are required'
        })
    }

    const {rows: checkInControlRow} = await db.query(`
        SELECT * FROM employee_activities ea WHERE employee_id = $1 and status = $2 and completed_status = $3 and type = $4
    `, [employee_id, 2, 0, 3])


    let diff = {
        hours: 0,
        minutes: 0
    }

    if (checkInControlRow?.[0]?.review_time && type === 4) {
        const start = moment(checkInControlRow?.[0].review_time, 'YYYY-MM-DD HH:mm');
        const end = moment(confirm_time, 'YYYY-MM-DD HH:mm');

        const duration = moment.duration(end.diff(start));
        const newDuration = moment.duration(duration.asMilliseconds() * 1.5);

        diff = {
            hours: Math.floor(newDuration.asHours()),
            minutes: newDuration.minutes()
        }
    }

    const {rows: checkInRow} = await db.query(`
        UPDATE employee_activities ea
        SET completed_status = $1, work_time = $6
        WHERE employee_id = $2 and status = $3 and completed_status = $4 and type = $5
            RETURNING *;
    `, [1, employee_id, 2, 0, 3, `${diff?.hours}:${diff?.minutes}`])

    const {rows} = await db.query(`
        UPDATE employee_activities
        SET reviewer_employee_id = $1, reviewer_timezone = $2, review_time = $3, completed_status = $4, status = $9, confirm_type = $10
        WHERE id = $5 and employee_id = $6 and status = $7 and type = $8
            RETURNING *;
    `, [
        req.currentUserId,
        timezone,
        confirm_time,
        type === 3 ? 0 : 1,
        activity_id,
        employee_id,
        1,
        type,
        2,
        confirm_type
    ])


    if (rows.length === 0 && (type === 4 ? checkInRow.length === 0 : false)) {
        return res.status(404).json({
            success: false,
            message: 'Activity not found or already accepted'
        })
    }

    const {rows: returnedRow} = await db.query(
        `SELECT ea.*,
                (
                    SELECT json_build_object(
                                   'id', e.id,
                                   'full_name', e.full_name
                           )
                    FROM employees e
                    WHERE e.id = ea.reviewer_employee_id
                    LIMIT 1
             ) AS reviewer
         FROM employee_activities ea
         WHERE ea.id = $1`, [rows?.[0]?.id]
    )


    const io = getIO();
    const socketId = userSocketMap.get(employee_id);

    console.log('socket_id', socketId, returnedRow?.[0])

    if (socketId) {
        io.to(socketId).emit("update_activity", {
            success: true,
            from: req.currentUserId,
            message: 'Activity status changed successfully',
            data: returnedRow?.[0]
        });
    }

    sendPushNotification(employee_id, 'test', 'salam')

    return res.status(200).json({
        success: true,
        message: 'Activity accepted successfully',
        data: returnedRow?.[0]
    })
})

router.post('/reject', checkAuth, userPermission, async (req, res) => {
    const {activity_id, employee_id, type, confirm_time, timezone, reject_reason} = req.body

    if (!activity_id || !employee_id || !type || !reject_reason) {
        return res.status(400).json({
            success: false,
            message: 'Activity ID, Employee ID, type and reject_reason are required'
        })
    }

    const {rows} = await db.query(`
                UPDATE employee_activities
                SET reviewer_employee_id = $1, reviewer_timezone = $2, review_time = $3, status = $4, completed_status = $5, reject_reason = $6
                WHERE id = $7 and employee_id = $8 and status = $9
                    RETURNING *;
        `,
        [req.currentUserId, timezone, confirm_time, 3, 1, reject_reason, activity_id, employee_id, 1])

    if (rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Activity not found or already rejected'
        })
    }

    const {rows: returnedRow} = await db.query(
        `SELECT ea.*,
                (
                    SELECT json_build_object(
                                   'id', e.id,
                                   'full_name', e.full_name
                           )
                    FROM employees e
                    WHERE e.id = ea.reviewer_employee_id
                    LIMIT 1
             ) AS reviewer
         FROM employee_activities ea
         WHERE ea.id = $1`, [rows?.[0]?.id]
    )

    const io = getIO();
    const socketId = userSocketMap.get(employee_id);

    if (socketId) {
        io.to(socketId).emit("update_activity", {
            success: true,
            from: req.currentUserId,
            message: 'Activity status changed successfully',
            data: returnedRow?.[0]
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Activity rejected successfully',
        data: returnedRow?.[0]
    })
})

/*router.get('/checkin', checkAuth, userPermission, async (req, res) => {
    const {start_date, end_date, project, full_name} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (start_date) {
        filters.push(`review_time >= $${idx}`);
        values.push(start_date)
        idx++
    }
    if (end_date) {
        filters.push(`review_time <= $${idx}`);
        values.push(end_date)
        idx++
    }
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
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role
        WHERE EXISTS (
            SELECT 1
            FROM project_members pm1
                     JOIN project_members pm2 ON pm1.project_id = pm2.project_id
            WHERE pm1.employee_id = ea.employee_id
              AND pm2.employee_id = $1
        )
        AND ea.type = 1 AND ea.status > 0 AND ${filters.join(' AND ')}
        ORDER BY ea.id DESC;
    `, [req.currentUserId, ...values])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows || []
    })
})*/

/*router.get('/checkout', checkAuth, userPermission, async (req, res) => {
    const {start_date, end_date, full_name, project} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (start_date) {
        filters.push(`review_time >= $${idx}`);
        values.push(start_date)
        idx++
    }
    if (end_date) {
        filters.push(`review_time <= $${idx}`);
        values.push(end_date)
        idx++
    }
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
        SELECT ea.*, json_build_object(
                'id', e.id,
                'full_name', e.full_name,
                'email', e.email,
                'role', json_build_object(
                        'id', er.id,
                        'name', r.name
                        )
                     ) as employee FROM employee_activities ea
                                            LEFT JOIN employees e ON e.id = ea.employee_id
                                            LEFT JOIN employee_roles er ON e.id = er.employee_id
                                            LEFT JOIN roles r ON r.id = er.role

        WHERE EXISTS (
            SELECT 1
            FROM project_members pm1
                     JOIN project_members pm2 ON pm1.project_id = pm2.project_id
            WHERE pm1.employee_id = ea.employee_id
              AND pm2.employee_id = $1
        )
        AND ea.type = 2 AND ea.status > 0 AND ${filters.join(' AND ')}
        ORDER BY ea.id DESC;
    `, [req.currentUserId, ...values])

    res.status(200).json({
        success: true,
        message: 'Activity fetched successfully',
        data: rows || []
    })
})*/

/*router.post('/checkin', checkAuth, userPermission, async (req, res) => {
    const {time, timezone, latitude, longitude} = req.body;
    const status = 1;
    const type = 1;

    const {rows: checkedInRows} =
        await db.query(`
            SELECT * FROM employee_activities
            WHERE employee_id = $1 AND status != 3 AND type = 1 AND completed_status = 0
            ORDER BY id DESC
                LIMIT 1
        `, [req.currentUserId])

    if (checkedInRows.length === 0) {
        const {rows} =
            await db.query(`
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
                [null, req.currentUserId, timezone, time, type, longitude, latitude, req.currentUserId, timezone, time, 2, 0, null, null, false])

        if (rows.length > 0) {
            const {rows: thisInsertedRow} = await db.query(`
            SELECT ea.*, json_build_object(
                    'id', e.id,
                    'full_name', e.full_name,
                    'email', e.email,
                    'role', json_build_object(
                            'id', er.id,
                            'name', r.name
                            )
                         ) as employee FROM employee_activities ea
                                                LEFT JOIN employees e ON e.id = ea.employee_id
                                                LEFT JOIN employee_roles er ON e.id = er.employee_id
                                                LEFT JOIN roles r ON r.id = er.role

                                       WHERE ea.id = $1
            ORDER BY ea.id DESC;
        `, [rows?.[0]?.id])


            // BUTUN TIMEKEEPERLER
            // const {rows: timeKeepersList} = await db.query(`SELECT * FROM employee_roles WHERE role = 2`);

            // QOSULU OLDUGU PROJECTLERIN TIMEKEEPERLERI
            const {rows: timeKeepersList} = await db.query(`SELECT * FROM employee_roles er WHERE er.role = 2
                                                                                              AND EXISTS (
                    SELECT *
                    FROM project_members pm1
                             JOIN project_members pm2
                                  ON pm1.project_id = pm2.project_id
                    WHERE pm1.employee_id = er.employee_id
                      AND pm1.role_id = 2
                      AND pm2.employee_id = $1
                      AND pm2.role_id = 2

                );`, [req.currentUserId]);


            if (timeKeepersList.length > 0) {
                timeKeepersList.map(el => {
                    const io = getIO();
                    const socketId = userSocketMap.get(el?.employee_id);

                    if (socketId) {
                        io.to(socketId).emit("new_activity", {
                            success: true,
                            from: req.currentUserId,
                            message: 'Activity status changed successfully',
                            data: thisInsertedRow[0]
                        });
                    }
                    sendPushNotification(el?.employee_id, 'test', 'salam')
                })
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: rows[0]
        })
    }
    else {
        return res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})*/

/*
* CHECKOUT: with Timekeeper control
* */
/*
router.post('/checkout', checkAuth, userPermission, async (req, res) => {
    const {time, timezone, latitude, longitude, activity_id} = req.body;
    const status = 1;
    const type = 2;

    const {rows: checkedOutRows} =
        await db.query(`
            SELECT * FROM employee_activities
            WHERE employee_id = $1 AND status != 3 AND type = 2 AND completed_status = 0
            ORDER BY id DESC
                LIMIT 1
        `, [req.currentUserId])

    if (checkedOutRows.length === 0) {
        const {rows} =
            await db.query(`
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
                            work_time
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
                `,
                [activity_id, req.currentUserId, timezone, time, type, longitude, latitude, null, null, null, status, 0, null, null])

        if (rows.length > 0) {
            const {rows: thisInsertedRow} = await db.query(`
                SELECT ea.*, json_build_object(
                        'id', e.id,
                        'full_name', e.full_name,
                        'email', e.email,
                        'role', json_build_object(
                                'id', er.id,
                                'name', r.name
                                )
                             ) as employee FROM employee_activities ea
                                                    LEFT JOIN employees e ON e.id = ea.employee_id
                                                    LEFT JOIN employee_roles er ON e.id = er.employee_id
                                                    LEFT JOIN roles r ON r.id = er.role

                WHERE ea.id = $1
                ORDER BY ea.id DESC;
            `, [rows?.[0]?.id])

            const {rows: timeKeepersList} = await db.query(`SELECT * FROM employee_roles WHERE role = 2`);

            if (timeKeepersList.length > 0) {
                timeKeepersList.map(el => {
                    const io = getIO();
                    const socketId = userSocketMap.get(el?.employee_id);

                    if (socketId) {
                        io.to(socketId).emit("new_activity", {
                            success: true,
                            from: req.currentUserId,
                            message: 'Activity status changed successfully',
                            data: thisInsertedRow[0]
                        });
                    }
                    sendPushNotification(el?.employee_id, 'test', 'salam')
                })
            }
        }

        return res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: rows[0]
        })
    }
    else {
        return res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }


    // const {rows: thisInsertedRow} = await db.query(`
    //         SELECT ea.*, json_build_object(
    //                 'id', e.id,
    //                 'full_name', e.full_name,
    //                 'email', e.email,
    //                 'role', json_build_object(
    //                         'id', er.id,
    //                         'name', r.name
    //                         )
    //                      ) as employee FROM employee_activities ea
    //                                             LEFT JOIN employees e ON e.id = ea.employee_id
    //                                             LEFT JOIN employee_roles er ON e.id = er.employee_id
    //                                             LEFT JOIN roles r ON r.id = er.role
    //
    //                                    WHERE ea.id = $1
    //         ORDER BY ea.id DESC;
    //     `, [56])
    //
    //
    // const {rows: timeKeepersList} = await db.query(`SELECT * FROM employee_roles WHERE role = 2`);
    //
    // console.log(timeKeepersList, 'timeKeepersList')
    //
    // if (timeKeepersList.length > 0) {
    //     timeKeepersList.map(el => {
    //         const io = getIO();
    //         const socketId = userSocketMap.get(el?.employee_id);
    //
    //         console.log('socketId', socketId)
    //
    //         if (socketId) {
    //             io.to(socketId).emit("new_activity", {
    //                 success: true,
    //                 from: req.currentUserId,
    //                 message: 'Activity status changed successfully',
    //                 data: thisInsertedRow[0]
    //             });
    //         }
    //         sendPushNotification(el?.employee_id, 'test', 'salam')
    //     })
    // }
    //
    // res.json({success: true, message: 'Activity created successfully', data: thisInsertedRow[0]});
})
*/

/*
* CHECKOUT: without Timekeeper control
* */
/*router.post('/checkout', checkAuth, userPermission, async (req, res) => {
    const {time, timezone, latitude, longitude, activity_id} = req.body;
    const status = 1;
    const type = 2;

    const {rows: checkInControlRow} = await db.query(`
        SELECT * FROM employee_activities ea WHERE employee_id = $1 and status = $2 and completed_status = $3 and type = $4
    `, [req.currentUserId, 2, 0, 1])

    let diff = {
        hours: 0,
        minutes: 0
    }

    if (checkInControlRow?.[0]?.review_time && type === 2) {
        const start = moment(checkInControlRow?.[0].review_time, 'YYYY-MM-DD HH:mm');
        const end = moment(time, 'YYYY-MM-DD HH:mm');

        const duration = moment.duration(end.diff(start));

        diff = {
            hours: Math.floor(duration.asHours()),
            minutes: duration.minutes()
        }

        const startHourMinute = start.format("HH:mm");
        const endHourMinute = end.format("HH:mm");

        if (
            moment(startHourMinute, "HH:mm").isBetween(moment("07:29", "HH:mm"), moment("08:31", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("18:59", "HH:mm"), moment("19:31", "HH:mm")) &&
            duration.asHours() < 24
        ) {
            diff = {
                hours: 10,
                minutes: 0
            };
        }
        /!*else if (
            moment(startHourMinute, "HH:mm").isBetween(moment("07:29", "HH:mm"), moment("08:31", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("19:59", "HH:mm"), moment("20:31", "HH:mm")) &&
            duration.asHours() < 24
        ) {
            diff = {
                hours: 11,
                minutes: 30
            };
        }
        else if (
            moment(startHourMinute, "HH:mm").isBetween(moment("07:29", "HH:mm"), moment("08:31", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("20:59", "HH:mm"), moment("21:31", "HH:mm")) &&
            duration.asHours() < 24
        ) {
            diff = {
                hours: 13,
                minutes: 0
            };
        }*!/
        else if (
            moment(startHourMinute, "HH:mm").isBetween(moment("19:29", "HH:mm"), moment("20:01", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("06:59", "HH:mm"), moment("07:31", "HH:mm")) &&
            duration.asHours() < 24
        ) {
            diff = {
                hours: 10,
                minutes: 0
            };
        }
    }

    const {rows: checkInRow} = await db.query(`
        UPDATE employee_activities ea
        SET completed_status = $1, work_time = $6
        WHERE employee_id = $2 and status = $3 and completed_status = $4 and type = $5
            RETURNING *;
    `, [1, req.currentUserId, 2, 0, 1, `${diff?.hours}:${diff?.minutes}`])

    const {rows: checkedOutRows} =
        await db.query(`
            SELECT * FROM employee_activities
            WHERE employee_id = $1 AND status != 3 AND type = 2 AND completed_status = 0
            ORDER BY id DESC 
                LIMIT 1
        `, [req.currentUserId])

    if (checkedOutRows.length === 0) {
        const {rows} =
            await db.query(`
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
                [activity_id, req.currentUserId, timezone, time, type, longitude, latitude, req.currentUserId, timezone, time, 2, 1, null, null, false])

        if (rows.length > 0) {
            const {rows: thisInsertedRow} = await db.query(`
                SELECT ea.*, json_build_object(
                        'id', e.id,
                        'full_name', e.full_name,
                        'email', e.email,
                        'role', json_build_object(
                                'id', er.id,
                                'name', r.name
                                )
                             ) as employee,
                       (
                           SELECT json_build_object(
                                          'id', e.id,
                                          'full_name', e.full_name
                                  )
                           FROM employees e
                           WHERE e.id = ea.reviewer_employee_id
                                  LIMIT 1
                    ) AS reviewer
                FROM employee_activities ea
                                                    LEFT JOIN employees e ON e.id = ea.employee_id
                                                    LEFT JOIN employee_roles er ON e.id = er.employee_id
                                                    LEFT JOIN roles r ON r.id = er.role

                WHERE ea.id = $1
                ORDER BY ea.id DESC;
            `, [rows?.[0]?.id])

            const {rows: timeKeepersList} = await db.query(`SELECT * FROM employee_roles er WHERE er.role = 2
                                                                                              AND EXISTS (
                    SELECT *
                    FROM project_members pm1
                             JOIN project_members pm2
                                  ON pm1.project_id = pm2.project_id
                    WHERE pm1.employee_id = er.employee_id
                      AND pm1.role_id = 2
                      AND pm2.employee_id = $1
                      AND pm2.role_id = 2

                );`, [req.currentUserId]);

            if (timeKeepersList.length > 0) {
                timeKeepersList.map(el => {
                    const io = getIO();
                    const socketId = userSocketMap.get(el?.employee_id);

                    if (socketId) {
                        io.to(socketId).emit("update_activity", {
                            success: true,
                            from: req.currentUserId,
                            message: 'Activity status changed successfully',
                            data: thisInsertedRow[0]
                        });
                    }
                    sendPushNotification(el?.employee_id, 'test', 'salam')
                })
            }

            return res.status(201).json({
                success: true,
                message: 'Activity created successfully',
                data: thisInsertedRow[0]
            })
        }
    }
    else {
        return res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})*/

/*router.get('/', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`SELECT *, (
        SELECT json_build_object(
                       'id', e.id,
                       'full_name', e.full_name
               )
        FROM employees e
        WHERE e.id = ea.reviewer_employee_id
        LIMIT 1
                                       ) AS reviewer FROM employee_activities ea
                                   WHERE employee_id = $1 AND completed_status = 0
                                   ORDER BY id DESC LIMIT 2`, [req.currentUserId]);

    console.log(rows)

    return res.status(200).json({
        success: true,
        message: 'Activities fetched successfully',
        data: rows
    })
})*/

export default router