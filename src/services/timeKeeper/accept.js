import moment from "moment/moment.js";
import db from "../../helper/db.js";
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";

export async function accept() {

    const {rows: checkInControlRow} = await db.query(`
        SELECT * FROM employee_activities ea WHERE employee_id = $1 and status = $2 and completed_status = $3 and type = $4
    `, [employee_id, 2, 0, 1])

    let diff = {
        hours: 0,
        minutes: 0
    }

    if (checkInControlRow?.[0]?.review_time && type === 2) {

        const start = moment(checkInControlRow?.[0].review_time, 'YYYY-MM-DD HH:mm');
        const end = moment(confirm_time, 'YYYY-MM-DD HH:mm');

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

    const {rows} = await db.query(`
        UPDATE employee_activities 
        SET reviewer_employee_id = $1, reviewer_timezone = $2, review_time = $3, completed_status = $4, status = $9
        WHERE id = $5 and employee_id = $6 and status = $7 and type = $8
        RETURNING *;
    `, [req.currentUserId, timezone, confirm_time, type === 1 ? 0 : 1, activity_id, employee_id, 1,  type, 2])


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
}