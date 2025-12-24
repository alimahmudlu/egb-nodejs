import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";
import moment from "moment";

const router = express.Router()

router.get('/projects', checkAuth, userPermission, async (req, res) => {
    const query = `
        SELECT
            p.name AS project_name,
            p.id AS project_id,
            '${moment().format('YYYY-MM-DD')}' as date,
            COUNT(CASE WHEN ea.turn = 1 THEN 1 END) AS turn1Employees,
            COUNT(CASE WHEN ea.turn = 2 THEN 1 END) AS turn2Employees
--             (SELECT to_jsonb(br.*) FROM bus_reports br WHERE br.project_id = p.id AND Date(br.date) = $1 ORDER BY br.id DESC LIMIT 1) AS report_status
        FROM projects AS p
            LEFT JOIN project_members AS pm ON p.id = pm.project_id
            AND pm.status = 1 
            LEFT JOIN employees AS e ON e.id = pm.employee_id
            LEFT JOIN employee_activities AS ea ON ea.employee_id = e.id
            AND ea.status = 2
            AND ea.completed_status = 0
            AND ea.type = 1
            AND DATE(ea.review_time) = $1

        GROUP BY
            p.id, p.name
        ORDER BY
            p.id;
    `

    const {rows: employees} = await db.query(query, [moment().format('YYYY-MM-DD')]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: employees
    })
})

router.post('/report/add', checkAuth, userPermission, async (req, res) => {
    const {turn1employees, turn2employees, date, projectId, countOfBus, countOfSeatInEveryBus, toProjectId, fromProjectId, campId, tripTypeId} = req.body;

    const {rows} = await db.query(`
    INSERT INTO bus_reports (project_id, turn1_employee_count, turn2_employee_count, bus_count, seat_count, date, employee_id, to_project_id, camp_id, trip_type, bus_type_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
`, [projectId, turn1employees, turn2employees, countOfBus, countOfSeatInEveryBus, date, req.currentUserId, toProjectId, campId, tripTypeId, tripTypeId]);

    return res.status(200).json({
        success: true,
        message: 'Bus report added successfully',
        data: rows?.[0]
    })
})

router.post('/report/edit/:id', checkAuth, userPermission, async (req, res) => {
    const {turn1employees, turn2employees, date, projectId, countOfBus, countOfSeatInEveryBus, toProjectId, fromProjectId, campId, tripTypeId} = req.body;

    if (req.params.id) {
        const {rows} = await db.query(`
            UPDATE bus_reports 
            SET  bus_count = $3, seat_count = $4, camp_id = $5, trip_type = $6, bus_type_id = $7, to_project_id = $8
            WHERE project_id = $9 AND date = $10
        `, [ countOfBus, countOfSeatInEveryBus, campId, tripTypeId, tripTypeId, toProjectId, projectId, date])

        return res.status(200).json({
            success: true,
            message: 'Bus report added successfully',
            data: rows?.[0]
        })
    }
    else {
        const {rows} = await db.query(`
        INSERT INTO bus_reports (project_id, turn1_employee_count, turn2_employee_count, bus_count, seat_count, date, employee_id, to_project_id, camp_id, trip_type, bus_type_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    `, [projectId, turn1employees, turn2employees, countOfBus, countOfSeatInEveryBus, date, req.currentUserId, toProjectId, campId, tripTypeId, tripTypeId]);

        return res.status(200).json({
            success: true,
            message: 'Bus report added successfully',
            data: rows?.[0]
        })
    }
})

router.get('/projects/history', checkAuth, userPermission, async (req, res) => {
    const {start_date, end_date, date, project} = req.query;
    const filters = [];
    const values = [];
    let idx = 1;

    if (start_date) {
        filters.push(`br.date >= $${idx}`);
        values.push(moment(start_date).format())
        idx++
    }
    if (end_date) {
        filters.push(`br.date <= $${idx}`);
        values.push(moment(end_date).format())
        idx++
    }
    if (date) {
        filters.push(`br.date = $${idx}`);
        values.push(moment(date).format())
        idx++
    }
    if (project) {
        filters.push(`br.project_id = $${idx}`);
        values.push(project)
        idx++
    }

    const query = `
        SELECT
            br.*,
            p.name AS project_name,
            p.id AS project_id
        FROM bus_reports br
                 LEFT JOIN projects AS p ON br.project_id = p.id
            ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY
            br.date DESC, br.id DESC;
    `
    const {rows: employees} = (project && date) ? await db.query(query, [...values]) : [];

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: employees
    })
})


export default router