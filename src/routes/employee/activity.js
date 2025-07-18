import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import moment from "moment";

const router = express.Router()

router.post('/checkin', checkAuth, async (req, res) => {
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
                            work_time
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
                `,
                [null, req.currentUserId, timezone, time, type, longitude, latitude, null, null, null, status, 0, null, null])

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
})

router.post('/checkout', checkAuth, async (req, res) => {
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

router.get('/', checkAuth, async (req, res) => {
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







router.post('/test', async (req, res) => {
    const {time} = req.body;

    const {rows} = await db.query(`INSERT INTO date_test
                                       (time, time_tz, raw_time, raw_time_tz)
                                   VALUES ($1, $2, $3, $4) RETURNING * `,
        [
            moment(`${time}-07:00`), moment(`${time}-07:00`),
            time, time
        ])

    return res.status(200).json({
        data: rows,
        raw: time,
        moment: moment(time).format()
    })
})
export default router