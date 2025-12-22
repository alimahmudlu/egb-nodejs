import express from 'express'
import db from '../helper/db.js'
import checkAuth from "../middleware/checkAuth.js";
import moment from "moment";

const router = express.Router()

router.get('/', checkAuth, async (req, res) => {
    const {rows: userDataRows} =
        await db.query(`
                SELECT
                    e.*,
                    (
                        SELECT jsonb_build_object('id', r.id, 'name', r.name)
                        FROM employee_roles er
                                 LEFT JOIN roles r ON r.id = er.role
                        WHERE er.employee_id = e.id
                        LIMIT 1
                    ) AS role,
                    (SELECT sum(t.points) FROM tasks t WHERE (assigned_employee_id = e.id OR reporter_employee_id = e.id) AND EXISTS (
                SELECT 1
                FROM task_activities ta
                WHERE ta.task_id = t.id
                  AND ta.status_id = 5
            )) AS rating,
                    (
                        SELECT to_jsonb(p.*) FROM positions p WHERE p.id = e.position
                    ) AS position,
                    (
                        SELECT flow_id FROM applications a WHERE a.id = e.application_id LIMIT 1
                    ) AS flow
                FROM employees e
                WHERE e.id = $1;
            `, [req.currentUserId])

    return res.json({
        success: true,
        message: 'Current user data fetched successfully',
        data: userDataRows[0]
    })

})

router.get('/rating', checkAuth, async (req, res) => {
    const {rows: userDataRows} =
        await db.query(`
                SELECT
                    (SELECT sum(t.points) FROM tasks t WHERE (assigned_employee_id = e.id OR reporter_employee_id = e.id) AND EXISTS (
                SELECT 1
                FROM task_activities ta
                WHERE ta.task_id = t.id
                  AND ta.status_id = 5
            )) AS rating
                FROM employees e
                WHERE e.id = $1;
            `, [req.currentUserId])

    return res.json({
        success: true,
        message: 'Current user data fetched successfully',
        data: userDataRows[0]
    })

})

router.get('/activities/list', checkAuth, async (req, res) => {
    const {start_date, end_date} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (start_date) {
        filters.push(`ea.review_time >= $${idx}`);
        values.push(moment(start_date).format())
        idx++
    }
    if (end_date) {
        filters.push(`ea.review_time <= $${idx}`);
        values.push(moment(end_date).format())
        idx++
    }

    const {rows: userDataRows} =
        await db.query(`
            SELECT ea.*, json_build_object(
                    'id', e.id,
                    'full_name', e.full_name,
                    'email', e.email,
                    'manual', e.dont_have_phone,
                    'role', json_build_object(
                            'id', er.id,
                            'name', r.name
                            )
                         ) as employee FROM employee_activities ea
                                                LEFT JOIN employees e ON e.id = ea.employee_id
                                                LEFT JOIN employee_roles er ON e.id = er.employee_id
                                                LEFT JOIN roles r ON r.id = er.role

            WHERE e.id = $1
                ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}
            ORDER BY ea.id DESC
                
            `, [req.currentUserId, ...values])

    return res.json({
        success: true,
        message: 'Current user data fetched successfully',
        data: userDataRows
    })

})

router.get('/activities/work_hours', checkAuth, async (req, res) => {
    const {start_date, end_date} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (start_date) {
        filters.push(`entry.review_time >= $${idx}`);
        values.push(moment(start_date).format())
        idx++
    }
    if (end_date) {
        filters.push(`entry.review_time <= $${idx}`);
        values.push(moment(end_date).format())
        idx++
    }

    const {rows: userDataRows} =
        await db.query(`
            SELECT
                (SELECT full_name FROM employees e WHERE e.id = entry.reviewer_employee_id) AS check_in_timekeeper,
                (SELECT full_name FROM employees e WHERE e.id = exit.reviewer_employee_id)  AS check_out_timekeeper,
                entry.employee_id,
                entry.review_time       AS entry_time,
                entry.latitude          AS entry_latitude,
                entry.longitude         AS entry_longitude,
                entry.status            AS entry_status,
                exit.status             AS exit_status,
                entry.reject_reason     AS entry_reject_reason,
                exit.reject_reason      AS exit_reject_reason,
                exit.review_time        AS exit_time,
                exit.latitude           AS exit_latitude,
                exit.longitude          AS exit_longitude,
                COALESCE(
                        TO_CHAR(
                                make_interval(
                                        hours := split_part(entry.work_time, ':', 1)::int,
                                        mins  := lpad(split_part(entry.work_time, ':', 2), 2, '0')::int
                                ),
                                'HH24:MI'
                        ),
                        '00:00'
                )         AS work_duration,
                CASE
                    WHEN exit.status = 3 THEN 'Rejected Exit'
                    ELSE 'Completed'
                    END                     AS activity_status,
                CASE
                    WHEN exit.status = 3 THEN 'activityRejectedExit'
                    ELSE 'activityCompleted'
                    END                     AS activity_status_key
            FROM employee_activities entry
                     JOIN employee_activities exit
                          ON entry.employee_id = exit.employee_id
                              AND entry.type = 1
                              AND exit.type = 2
                              AND entry.status = 2 AND entry.completed_status = 1
                              AND exit.completed_status = 1
                              AND entry.review_time < exit.review_time
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM employee_activities mid
                                  WHERE mid.employee_id = entry.employee_id
                                    AND mid.type = 1
                                    AND mid.status = 2
                                    AND mid.completed_status = 1
                                    AND mid.review_time > entry.review_time
                                    AND mid.review_time < exit.review_time
                              )
            WHERE entry.employee_id = $1
                ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}

            UNION ALL

            SELECT
                (SELECT full_name FROM employees e WHERE e.id = entry.reviewer_employee_id) AS check_in_timekeeper,
                NULL                                    AS check_out_timekeeper,
                entry.employee_id,
                entry.review_time       AS entry_time,
                entry.latitude          AS entry_latitude,
                entry.longitude         AS entry_longitude,
                entry.status            AS entry_status,
                NULL                    AS exit_status,
                entry.reject_reason     AS entry_reject_reason,
                NULL                    AS exit_reject_reason,
                NULL                    AS exit_time,
                NULL                    AS exit_latitude,
                NULL                    AS exit_longitude,
                NULL                    AS work_duration,
                'No Exit'               AS activity_status,
                'activityNoExit'        AS activity_status_key
            FROM employee_activities entry
            WHERE entry.type = 1
              AND entry.status = 2
              AND entry.completed_status = 1
              AND entry.employee_id = $1
                ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}
              AND NOT EXISTS (
                SELECT 1
                FROM employee_activities exit
                WHERE exit.employee_id = entry.employee_id
                  AND exit.type = 2
                  AND exit.completed_status = 1
                  AND exit.review_time > entry.review_time
                )

            UNION ALL

            SELECT
                (SELECT full_name FROM employees e WHERE e.id = entry.reviewer_employee_id) AS check_in_timekeeper,
                NULL                                    AS check_out_timekeeper,
                entry.employee_id,
                entry.review_time       AS entry_time,
                entry.latitude          AS entry_latitude,
                entry.longitude         AS entry_longitude,
                entry.status            AS entry_status,
                NULL                    AS exit_status,
                entry.reject_reason     AS entry_reject_reason,
                NULL                    AS exit_reject_reason,
                NULL                    AS exit_time,
                NULL                    AS exit_latitude,
                NULL                    AS exit_longitude,
                NULL                    AS work_duration,
                'Rejected Entry'        AS activity_status,
                'activityRejectedEntry' AS activity_status_id
            FROM employee_activities entry
            WHERE entry.type = 1
              AND entry.status = 3
              AND entry.completed_status = 1
              AND entry.employee_id = $1
                ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}

            UNION ALL

            SELECT
                (SELECT full_name FROM employees e WHERE e.id = entry.reviewer_employee_id) AS check_in_timekeeper,
                (SELECT full_name FROM employees e WHERE e.id = exit.reviewer_employee_id)  AS check_out_timekeeper,
                entry.employee_id,
                entry.review_time       AS entry_time,
                entry.latitude          AS entry_latitude,
                entry.longitude         AS entry_longitude,
                entry.status            AS entry_status,
                exit.status             AS exit_status,
                entry.reject_reason     AS entry_reject_reason,
                exit.reject_reason      AS exit_reject_reason,
                exit.review_time        AS exit_time,
                exit.latitude           AS exit_latitude,
                exit.longitude          AS exit_longitude,
                COALESCE(
                        TO_CHAR(
                                make_interval(
                                        hours := split_part(entry.work_time, ':', 1)::int,
                                        mins  := lpad(split_part(entry.work_time, ':', 2), 2, '0')::int
                                ),
                                'HH24:MI'
                        ),
                        '00:00'
                )         AS work_duration,
                CASE
                    WHEN exit.status = 3 THEN 'Rejected Exit'
                    ELSE 'Completed'
                    END                     AS activity_status,
                CASE
                    WHEN exit.status = 3 THEN 'activityRejectedExit'
                    ELSE 'activityCompleted'
                    END                     AS activity_status_key
            FROM employee_activities entry
                     JOIN employee_activities exit
                          ON entry.employee_id = exit.employee_id
                              AND entry.type = 3
                              AND exit.type = 4
                              AND entry.status = 2 AND entry.completed_status = 1
                              AND exit.completed_status = 1
                              AND entry.review_time < exit.review_time
                              AND NOT EXISTS (
                                  SELECT 1
                                  FROM employee_activities mid
                                  WHERE mid.employee_id = entry.employee_id
                                    AND mid.type = 3
                                    AND mid.status = 2
                                    AND mid.completed_status = 1
                                    AND mid.review_time > entry.review_time
                                    AND mid.review_time < exit.review_time
                              )
            WHERE entry.employee_id = $1
                ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}

            UNION ALL

            SELECT
                (SELECT full_name FROM employees e WHERE e.id = entry.reviewer_employee_id) AS check_in_timekeeper,
                NULL                                    AS check_out_timekeeper,
                entry.employee_id,
                entry.review_time       AS entry_time,
                entry.latitude          AS entry_latitude,
                entry.longitude         AS entry_longitude,
                entry.status            AS entry_status,
                NULL                    AS exit_status,
                entry.reject_reason     AS entry_reject_reason,
                NULL                    AS exit_reject_reason,
                NULL                    AS exit_time,
                NULL                    AS exit_latitude,
                NULL                    AS exit_longitude,
                NULL                    AS work_duration,
                'No Exit'               AS activity_status,
                'activityNoExit'        AS activity_status_key
            FROM employee_activities entry
            WHERE entry.type = 3
              AND entry.status = 2
              AND entry.completed_status = 0
              AND entry.employee_id = $1
                ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}
              AND NOT EXISTS (
                SELECT 1
                FROM employee_activities exit
                WHERE exit.employee_id = entry.employee_id
                  AND exit.type = 4
                  AND exit.completed_status = 1
                  AND exit.review_time > entry.review_time
                )

            UNION ALL

            SELECT
                (SELECT full_name FROM employees e WHERE e.id = entry.reviewer_employee_id) AS check_in_timekeeper,
                NULL                                    AS check_out_timekeeper,
                entry.employee_id,
                entry.review_time       AS entry_time,
                entry.latitude          AS entry_latitude,
                entry.longitude         AS entry_longitude,
                entry.status            AS entry_status,
                NULL                    AS exit_status,
                entry.reject_reason     AS entry_reject_reason,
                NULL                    AS exit_reject_reason,
                NULL                    AS exit_time,
                NULL                    AS exit_latitude,
                NULL                    AS exit_longitude,
                NULL                    AS work_duration,
                'Rejected Entry'        AS activity_status,
                'activityRejectedEntry' AS activity_status_id
            FROM employee_activities entry
            WHERE entry.type = 3
              AND entry.status = 3
              AND entry.completed_status = 1
              AND entry.employee_id = $1
                ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}

            ORDER BY entry_time DESC;
        `, [req.currentUserId, ...values])


    // const {rows: userDataRows} =
    //     await db.query(`SELECT (SELECT full_name
    //                             FROM employees e
    //                             WHERE e.id = entry.reviewer_employee_id) AS check_in_timekeeper,
    //                            (SELECT full_name
    //                             FROM employees e
    //                             WHERE e.id = exit.reviewer_employee_id)  AS check_out_timekeeper,
    //                            entry.employee_id,
    //                            entry.review_time                         AS entry_time,
    //                            entry.latitude                            AS entry_latitude,
    //                            entry.longitude                           AS entry_longitude,
    //                            exit.review_time                          AS exit_time,
    //                            exit.latitude                             AS exit_latitude,
    //                            exit.longitude                            AS exit_longitude,
    //                            to_char(
    //                                    make_interval(secs := ROUND(EXTRACT(EPOCH FROM (exit.review_time - entry.review_time)))),
    //                                    'HH24:MI'
    //                            )                                         AS work_duration
    //                     FROM employee_activities entry
    //                              JOIN employee_activities exit
    //                                   ON entry.employee_id = exit.employee_id
    //                                       AND entry.type = 1
    //                                       AND exit.type = 2
    //                                       AND entry.status = 2 AND entry.completed_status = 1
    //                                       AND exit.status = 2 AND exit.completed_status = 1
    //                                       AND entry.review_time < exit.review_time
    //                                       AND NOT EXISTS (SELECT 1
    //                                                       FROM employee_activities mid
    //                                                       WHERE mid.employee_id = entry.employee_id
    //                                                         AND mid.type = 1
    //                                                         AND mid.status = 2
    //                                                         AND mid.completed_status = 1
    //                                                         AND mid.review_time > entry.review_time
    //                                                         AND mid.review_time < exit.review_time)
    //                     WHERE entry.employee_id = $1
    //                                  ${filters.length > 0 ? ` AND ${filters.join(' AND ')}` : ''}
    //                     ORDER BY entry.review_time DESC;`, [req.currentUserId, ...values])

    return res.json({
        success: true,
        message: 'Current user data fetched successfully',
        data: userDataRows
    })

})

export default router