import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";
import moment from "moment";

const router = express.Router()

// router.post('/report/daily', checkAuth, userPermission, async (req, res) => {
//     const {date} = req.params;
//
//     const {rows} = await db.query(`
//         INSERT INTO food_reports (turn1order, turn2order, date, employee_id)
//         VALUES ($1, $2, $3, $4)
//         RETURNING *
//     `, [turn1order, turn2order, date, req.currentUserId]);
//
//     return res.status(200).json({
//         success: true,
//         message: 'Food report added successfully',
//         data: rows?.[0]
//     })
// })
/*
router.post('/report/add', checkAuth, userPermission, async (req, res) => {
    const {turn1order, turn1employees, turn2order, turn2employees, date} = req.body;

    const {rows} = await db.query(`
        INSERT INTO food_reports (turn1order, turn1employees, turn2order, turn2employees, date, employee_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [turn1order, turn1employees, turn2order, turn2employees, date, req.currentUserId]);

    return res.status(200).json({
        success: true,
        message: 'Food report added successfully',
        data: rows?.[0]
    })
})*/

router.post('/report/add', checkAuth, userPermission, async (req, res) => {
    const {turn1 = {}, turn1employees = 0, turn2 = {}, turn2employees = 0, date, project_id} = req.body;
    const {breakfast, lunch, dinner} = turn1;
    const {lunch: nightLunch} = turn2;

    const {rows: breakfastRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, order, employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 1, 1, breakfast?.order || 0, turn1employees, breakfast?.note || '']);

    const {rows: lunchRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, order, employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 2, 1, lunch?.order || 0, turn1employees, lunch?.note || '']);

    const {rows: dinnerRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, order, employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 3, 1, dinner?.order || 0, turn1employees, dinner?.note || '']);

    const {rows: nightLunchRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, order, employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 4, 2, nightLunch?.order || 0, turn1employees, nightLunch?.note || '']);

    return res.status(200).json({
        success: true,
        message: 'Food report added successfully',
        // data: rows?.[0]
    })
})

router.post('/report/edit/:id', checkAuth, userPermission, async (req, res) => {
    const {turn1real, turn1missing, turn1rest, turn2real, turn2missing, turn2rest} = req.body;

    const {rows} = await db.query(`
        UPDATE food_reports SET turn1real = $1, turn1rest = $2, turn1missing = $3, turn2real = $4, turn2rest = $5, turn2missing = $6, updated_at = $7, status = $8 WHERE id = $9 RETURNING *
    `, [turn1real, turn1rest, turn1missing, turn2real, turn2rest, turn2missing, new Date(), 1, req.params.id]);

    return res.status(200).json({
        success: true,
        message: 'Food report added successfully',
        data: rows?.[0]
    })
})

router.get('/report/list', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`
        SELECT *
        FROM food_reports
        WHERE employee_id = $1
    `, [req.currentUserId]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: rows
    })
})

router.get('/report/today', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`
        SELECT fr.*
        FROM food_reports_p fr
        WHERE date = $1
    `, [moment().add(1, 'days').format('YYYY-MM-DD')]);

    const {rows: employees} = await db.query(`
            SELECT COUNT(ea.id) as total_employees,
                   COUNT(ea.id) FILTER (WHERE ea.turn = 1) AS turn1employees, 
                   COUNT(ea.id) FILTER (WHERE ea.turn = 2) AS turn2employees
            FROM employee_activities ea 
            WHERE ea.type = 1 AND ea.status = 2 AND ea.completed_status = 1 AND DATE(ea.review_time) = $1
    `, [moment().add(-1, 'days').format('YYYY-MM-DD')]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: {
            today: rows?.[0],
            todayEmployees: employees?.[0]
        }
    })
})

router.get('/projects', checkAuth, userPermission, async (req, res) => {
    const query = `
        SELECT
            p.name AS project_name,
            p.id AS project_id,
            '${moment().add(-1, 'days').format('YYYY-MM-DD')}' as date,
            COUNT(CASE WHEN ea.turn = 1 THEN 1 END) AS turn1Employees,
            COUNT(CASE WHEN ea.turn = 2 THEN 1 END) AS turn2Employees,
            (SELECT COALESCE(
                       jsonb_agg(
                               to_jsonb(fr.*)
                       ),
                       '[]'::jsonb
               ) FROM food_reports_p fr WHERE fr.project_id = p.id AND Date(fr.date) = $2 ORDER BY fr.id DESC) AS report_status
        FROM projects AS p
            LEFT JOIN project_members AS pm ON p.id = pm.project_id
            AND pm.status = 1 
            LEFT JOIN employees AS e ON e.id = pm.employee_id
            LEFT JOIN employee_activities AS ea ON ea.employee_id = e.id
            AND ea.status = 2
            AND ea.completed_status = 1
            AND ea.type = 1
            AND DATE(ea.review_time) = $1

        GROUP BY
            p.id, p.name
        ORDER BY
            p.id;
    `

    const {rows: employees} = await db.query(query, [moment().add(-1, 'days').format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: employees
    })
})

export default router