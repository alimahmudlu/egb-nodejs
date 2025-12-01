import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";
import moment from "moment";

const router = express.Router()

/*
* OLD
* */
/*
router.post('/checkin', checkAuth, userPermission, async (req, res) => {
    const {time, latitude, longitude} = req.body;

    // type: 1- checkin, 2 - checkout
    // status: 0 - requested, 1 - accept, 2 - reject
    const status = 0;
    const type = 1;

    const {rows: checkedInRows} = await db.query(`SELECT * FROM employee_activities WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`, [req.currentUserId])
    if (checkedInRows.length === 0 || (checkedInRows.length > 0 && checkedInRows[0].type !== type)) {
        const {rows} = await db.query(`INSERT INTO employee_activities
            (employee_id, confirm_employee_id, time, latitude, longitude, work_time, type, status, confirm_time, reject_reason)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * `,
            [req.currentUserId, null, time, latitude, longitude, null, type, status, null, null])

        res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: rows[0]
        })
    }
    else {
        res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})

router.post('/checkout', checkAuth, async (req, res) => {
    const {time, latitude, longitude} = req.body;

    // type: 1- checkin, 2 - checkout
    // status: 0 - requested, 1 - accept, 2 - reject
    const status = 0;
    const type = 2;

    const {rows: checkedOutRows} = await db.query(`SELECT * FROM employee_activities WHERE employee_id = $1 ORDER BY id DESC LIMIT 1`, [req.currentUserId])
    if (checkedOutRows.length === 0 || (checkedOutRows.length > 0 && checkedOutRows[0].type !== type)) {
        const {rows} = await db.query(`INSERT INTO employee_activities
            (employee_id, confirm_employee_id, time, latitude, longitude, work_time, type, status, confirm_time, completed_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING * `,
            [req.currentUserId, null, time, latitude, longitude, null, type, status, null, 0])

        res.status(201).json({
            success: true,
            message: 'Activity created successfully',
            data: rows[0]
        })
    }
    else {
        res.status(400).json({
            success: false,
            message: 'activity already exists for this status',
            data: null
        })
    }
})
*/


router.post('/checkin', checkAuth, userPermission, async (req, res) => {
    const {time, timezone, latitude, longitude} = req.body;
    const status = 1;
    const type = 1;
    const turn = moment(time, "HH:mm").isBetween(moment("05:00", "HH:mm"), moment("17:00", "HH:mm")) ? 1 : 2;

    const {rows: checkedInRows} =
        await db.query(`
            SELECT * FROM employee_activities
            WHERE employee_id = $1 AND status != 3 AND type = 1 AND completed_status = 0
            ORDER BY id DESC
                LIMIT 1
        `, [req.currentUserId])

    const {rows: empData} = await db.query(`SELECT full_name FROM employees WHERE id = $1`, [req.currentUserId]);

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
                         is_manual, turn
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *
                `,
                [null, req.currentUserId, timezone, time, type, longitude, latitude, null, null, null, status, 0, null, null, false, turn])

        if (rows.length > 0) {
            const {rows: thisInsertedRow} = await db.query(`
            SELECT ea.*, (
                SELECT json_build_object(
                               'id', p.id,
                               'name', p.name
                       )
                FROM project_members pm
                         LEFT JOIN projects p ON p.id = pm.project_id
                WHERE e.id = pm.employee_id AND pm.status = 1
                LIMIT 1
                ) AS project, json_build_object(
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
                      AND pm2.role_id = 3

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
                    sendPushNotification(el?.employee_id, 'New Check-in request', `${empData?.[0]?.full_name} sent a request for check-in at now`, {
                        url: '/chief/',
                        utm_source: 'push_notification'
                    })
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
})

/*
* CHECKOUT: with Timekeeper control
* */
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

    const {rows: empData} = await db.query(`SELECT full_name FROM employees WHERE id = $1`, [req.currentUserId]);

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
                SELECT ea.*, (
                    SELECT json_build_object(
                                   'id', p.id,
                                   'name', p.name
                           )
                    FROM project_members pm
                             LEFT JOIN projects p ON p.id = pm.project_id
                    WHERE e.id = pm.employee_id AND pm.status = 1
                    LIMIT 1
                    ) AS project, json_build_object(
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

            const {rows: timeKeepersList} = await db.query(`SELECT * FROM employee_roles er WHERE er.role = 2
                                                                                              AND EXISTS (
                    SELECT *
                    FROM project_members pm1
                             JOIN project_members pm2
                                  ON pm1.project_id = pm2.project_id
                    WHERE pm1.employee_id = er.employee_id
                      AND pm1.role_id = 2
                      AND pm2.employee_id = $1
                      AND pm2.role_id = 3

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
                    sendPushNotification(el?.employee_id, 'New Check-out request', `${empData?.[0]?.full_name} sent a request for check-out at now`, {
                        url: '/chief/',
                        utm_source: 'push_notification'
                    })
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

/*
* CHECKOUT: without Timekeeper control
* */
/*
router.post('/checkout', checkAuth, userPermission, async (req, res) => {
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

            const {rows: timeKeepersList} = await db.query(`SELECT * FROM employee_roles WHERE role = 2`);

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
})
*/


router.get('/', checkAuth, userPermission, async (req, res) => {
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
})


export default router