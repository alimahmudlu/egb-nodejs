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
            COUNT(CASE WHEN ea.turn = 2 THEN 1 END) AS turn2Employees,
            (SELECT to_jsonb(br.*) FROM bus_reports br WHERE br.project_id = p.id AND Date(br.date) = $1 ORDER BY br.id DESC LIMIT 1) AS report_status
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
    const {turn1employees, turn2employees, date, projectId, countOfBus, countOfSeatInEveryBus, toProjectId, fromProjectId, tripTypeId} = req.body;

    console.log(turn1employees, turn2employees, date, projectId, countOfBus, countOfSeatInEveryBus, toProjectId, fromProjectId, tripTypeId)
    console.log(`
        INSERT INTO bus_reports (project_id, turn1_employee_count, turn2_employee_count, bus_count, seat_count, date, employee_id, to_project_id, from_project_id, trip_type, bus_type_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    `, [projectId, turn1employees, turn2employees, countOfBus, countOfSeatInEveryBus, date, req.currentUserId, toProjectId, fromProjectId, tripTypeId, tripTypeId])

    const {rows} = await db.query(`
        INSERT INTO bus_reports (project_id, turn1_employee_count, turn2_employee_count, bus_count, seat_count, date, employee_id, to_project_id, from_project_id, trip_type, bus_type_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    `, [projectId, turn1employees, turn2employees, countOfBus, countOfSeatInEveryBus, date, req.currentUserId, toProjectId, fromProjectId, tripTypeId, tripTypeId]);

    return res.status(200).json({
        success: true,
        message: 'Bus report added successfully',
        data: rows?.[0]
    })
})

router.get('/projects/history', checkAuth, userPermission, async (req, res) => {
    const query = `
        SELECT
            br.*,
            p.name AS project_name,
            p.id AS project_id
        FROM bus_reports br
                 LEFT JOIN projects AS p ON br.project_id = p.id
        ORDER BY
            br.date DESC, br.id DESC;
    `
    const {rows: employees} = await db.query(query, []);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: employees
    })
})


export default router