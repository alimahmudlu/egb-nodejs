import sendPushNotification from "../helper/sendPushNotification.js";
import {getIO, userSocketMap} from "../socketManager.js";
import db from "../helper/db.js";
import moment from "moment-timezone";

export default async function timeKeeperActivityAccept(req, res) {
    const {activity_id, employee_id, type, confirm_time, timezone, confirm_type, overTime = false} = req

    if (!activity_id || !employee_id || !type) {
        return res.status(400).json({
            success: false,
            message: 'Activity ID, Employee ID and type are required'
        })
    }

    const {rows: checkInControlRow} = await db.query(`
        SELECT * FROM employee_activities ea WHERE employee_id = $1 and status = $2 and completed_status = $3 and type = $4
    `, [employee_id, 2, 0, 1])


    let diff = {
        hours: 0,
        minutes: 0
    }

    if (checkInControlRow?.[0]?.review_time && type === 2) {
        const start = moment(checkInControlRow?.[0].review_time, 'YYYY-MM-DD HH:mm');
        const end = moment(confirm_time, 'YYYY-MM-DD HH:mm').endOf('minute');;

        const duration = moment.duration(end.diff(start));

        diff = {
            hours: Math.floor(duration.asHours()),
            minutes: duration.minutes()
        }

        const startHourMinute = start.format("HH:mm");
        const endHourMinute = end.format("HH:mm");

        if (
            moment(startHourMinute, "HH:mm").isBetween(moment("07:29", "HH:mm"), moment("08:31", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("18:59", "HH:mm"), moment("20:01", "HH:mm")) &&
            duration.asHours() < 24 &&
            confirm_type === 1 &&
            moment().tz("Europe/Moscow").weekday() !== 2
        ) {
            diff = {
                hours: 10,
                minutes: 0
            };
        }
        if (
            moment(startHourMinute, "HH:mm").isBetween(moment("07:29", "HH:mm"), moment("08:31", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("18:59", "HH:mm"), moment("20:01", "HH:mm")) &&
            duration.asHours() < 24 &&
            confirm_type === 1 &&
            moment().tz("Europe/Moscow").weekday() === 2
        ) {
            diff = {
                hours: 8,
                minutes: 0
            };
        }
        if (
            moment(startHourMinute, "HH:mm").isBetween(moment("07:29", "HH:mm"), moment("08:31", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("18:59", "HH:mm"), moment("20:01", "HH:mm")) &&
            duration.asHours() < 24 &&
            confirm_type === 4 &&
            moment().tz("Europe/Moscow").weekday() === 2
        ) {
            diff = {
                hours: 10,
                minutes: 0
            };
        }
        /*else if (
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
        }*/
        else if (
            moment(startHourMinute, "HH:mm").isBetween(moment("19:29", "HH:mm"), moment("20:01", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("06:59", "HH:mm"), moment("07:31", "HH:mm")) &&
            duration.asHours() < 24 &&
            confirm_type === 1 &&
            moment().tz("Europe/Moscow").weekday() !== 2
        ) {
            diff = {
                hours: 10,
                minutes: 0
            };
        }
        else if (
            moment(startHourMinute, "HH:mm").isBetween(moment("19:29", "HH:mm"), moment("20:01", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("06:59", "HH:mm"), moment("07:31", "HH:mm")) &&
            duration.asHours() < 24 &&
            confirm_type === 1 &&
            moment().tz("Europe/Moscow").weekday() === 2
        ) {
            diff = {
                hours: 8,
                minutes: 0
            };
        }
        else if (
            moment(startHourMinute, "HH:mm").isBetween(moment("19:29", "HH:mm"), moment("20:01", "HH:mm")) &&
            moment(endHourMinute, "HH:mm").isBetween(moment("06:59", "HH:mm"), moment("07:31", "HH:mm")) &&
            duration.asHours() < 24 &&
            confirm_type === 4 &&
            moment().tz("Europe/Moscow").weekday() === 2
        ) {
            diff = {
                hours: 10,
                minutes: 0
            };
        }
        else if (
            confirm_type === 3
        ) {
            diff = {
                hours: 0,
                minutes: 0
            }
        }
    }

    // if (checkInControlRow?.[0]?.review_time && type === 2) {
    //
    //     const start = moment(checkInControlRow?.[0].review_time, 'YYYY-MM-DD HH:mm');
    //     const end = moment(confirm_time, 'YYYY-MM-DD HH:mm');
    //
    //     const duration = moment.duration(end.diff(start));
    //
    //     diff = {
    //         hours: Math.floor(duration.asHours()),
    //         minutes: duration.minutes()
    //     }
    // }

    const {rows: checkInRow} = await db.query(`
        UPDATE employee_activities ea
        SET completed_status = $1, work_time = $6, overtime_status = $7
        WHERE employee_id = $2 and status = $3 and completed_status = $4 and type = $5
            RETURNING *;
    `, [overTime ? 0 : 1, employee_id, 2, 0, 1, `${diff?.hours}:${diff?.minutes}`, overTime ? 1 : 0])

    const {rows} = await db.query(`
        UPDATE employee_activities
        SET reviewer_employee_id = $1, reviewer_timezone = $2, review_time = $3, completed_status = $4, status = $9, confirm_type = $10, overtime_status = $11
        WHERE id = $5 and employee_id = $6 and status = $7 and type = $8
            RETURNING *;
    `, [req.currentUserId, timezone, confirm_time, type === 1 ? 0 : (overTime ? 0 : 1), activity_id, employee_id, 1, type, 2, confirm_type, overTime ? 1 : 0])


    if (rows.length === 0 && (type === 2 ? checkInRow.length === 0 : false)) {
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

    if (socketId) {
        io.to(socketId).emit("update_activity", {
            success: true,
            from: req.currentUserId,
            message: 'Activity status changed successfully',
            data: returnedRow?.[0]
        });
    }

    sendPushNotification(employee_id, 'test', 'salam')

    return returnedRow
}