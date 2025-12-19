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
    const {turn1 = {}, turn1employees = 0, turn2 = {}, turnextras = {}, turn2employees = 0, date, project_id} = req.body;
    const {breakfast, lunch, dinner} = turn1;
    const {lunch: nightLunch} = turn2;
    const {bread, kefir, sugar, tea} = turnextras;

    const {rows: controls} = await db.query(`SELECT * FROM food_reports_p WHERE project_id = $1 AND date = $2`, [project_id, date]);

    if (controls.length > 0 && controls.some(control => control.type === 1 && control.turn === 1)) {
        const {rows: breakfastRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 1 AND turn = 1
        RETURNING *
    `, [breakfast?.order || 0, turn1employees, breakfast?.note || '', project_id, date]);
    }
    else {
        const {rows: breakfastRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 1, 1, breakfast?.order || 0, turn1employees, breakfast?.note || '']);
    }

    if (controls.length > 0 && controls.some(control => control.type === 2 && control.turn === 1)) {
        const {rows: lunchRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 2 AND turn = 1
        RETURNING *
    `, [lunch?.order || 0, turn1employees, lunch?.note || '', project_id, date]);
    }
    else {
        const {rows: lunchRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 2, 1, lunch?.order || 0, turn1employees, lunch?.note || '']);
    }

    if (controls.length > 0 && controls.some(control => control.type === 3 && control.turn === 1)) {
        const {rows: dinnerRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 3 AND turn = 1
        RETURNING *
    `, [dinner?.order || 0, turn1employees, dinner?.note || '', project_id, date]);

    }
    else {
        const {rows: dinnerRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 3, 1, dinner?.order || 0, turn1employees, dinner?.note || '']);
    }

    if (controls.length > 0 && controls.some(control => control.type === 4 && control.turn === 2)) {
        const {rows: nightLunchRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 4 AND turn = 2
        RETURNING *
    `, [nightLunch?.order || 0, turn1employees, breakfast?.note || '', project_id, date]);

    }
    else {
        const {rows: nightLunchRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 4, 2, nightLunch?.order || 0, turn2employees, nightLunch?.note || '']);
    }

    if (controls.length > 0 && controls.some(control => control.type === 5 && control.turn === 1)) {
        const {rows: breadRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 5 AND turn = 1
        RETURNING *
    `, [bread?.order || 0, Number(turn1employees) + Number(turn2employees), bread?.note || '', project_id, date]);

    }
    else {
        const {rows: breadRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 5, 1, bread?.order || 0, Number(turn1employees) + Number(turn2employees), bread?.note || '']);
    }

    if (controls.length > 0 && controls.some(control => control.type === 6 && control.turn === 1)) {
        const {rows: kefirRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 6 AND turn = 1
        RETURNING *
    `, [kefir?.order || 0, Number(turn1employees) + Number(turn2employees), kefir?.note || '', project_id, date]);

    }
    else {
        const {rows: kefirRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 6, 1, kefir?.order || 0, Number(turn1employees) + Number(turn2employees), kefir?.note || '']);
    }

    if (controls.length > 0 && controls.some(control => control.type === 7 && control.turn === 1)) {
        const {rows: sugarRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 7 AND turn = 1
        RETURNING *
    `, [sugar?.order || 0, Number(turn1employees) + Number(turn2employees), sugar?.note || '', project_id, date]);

    }
    else {
        const {rows: sugarRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 7, 1, sugar?.order || 0, Number(turn1employees) + Number(turn2employees), sugar?.note || '']);
    }

    if (controls.length > 0 && controls.some(control => control.type === 8 && control.turn === 1)) {
        const {rows: teaRows} = await db.query(`
        UPDATE food_reports_p SET "order"=$1, employees=$2, note=$3
            WHERE project_id = $4 AND date = $5 AND type = 8 AND turn = 1
        RETURNING *
    `, [tea?.order || 0, Number(turn1employees) + Number(turn2employees), tea?.note || '', project_id, date]);

    }
    else {
        const {rows: teaRows} = await db.query(`
        INSERT INTO food_reports_p (date, project_id, type, turn, "order", employees, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
    `, [date, project_id, 8, 1, tea?.order || 0, Number(turn1employees) + Number(turn2employees), tea?.note || '']);
    }






    return res.status(200).json({
        success: true,
        message: 'Food report added successfully',
        // data: rows?.[0]
    })
})

router.post('/report/edit/:id', checkAuth, userPermission, async (req, res) => {
    const {real, missing, rest, project_id, date} = req.body;

    const {rows} = await db.query(`
        UPDATE food_reports_p SET real = $1, missing = $2, rest = $3, status = $4 WHERE id = $5 RETURNING *
    `, [real, missing, rest, 1, req.params.id]);

    return res.status(200).json({
        success: true,
        message: 'Food report added successfully',
        data: rows?.[0]
    })
})

router.get('/report/list', checkAuth, userPermission, async (req, res) => {
    const {start_date, end_date, date, full_name, project, page, limit} = req.query;
    const filters = [];
    const values = [];
    let idx = 1;

    if (start_date) {
        filters.push(`date >= $${idx}`);
        values.push(moment(start_date).format())
        idx++
    }
    if (end_date) {
        filters.push(`date <= $${idx}`);
        values.push(moment(end_date).format())
        idx++
    }
    if (date) {
        filters.push(`date = $${idx}`);
        values.push(moment(date).format())
        idx++
    }
    if (project) {
        filters.push(`project_id = $${idx}`);
        values.push(project)
        idx++
    }

    const query = `
        SELECT *
        FROM food_reports_p
                 ${filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY date DESC
    `
    const {rows} = (project && date) ? await db.query(query, [...values]) : [];



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
            /*(SELECT COALESCE(
                       jsonb_agg(
                               to_jsonb(fr.*)
                       ),
                       '[]'::jsonb
               ) FROM food_reports_p fr WHERE fr.project_id = p.id AND Date(fr.date) = $2) AS report_status,*/
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 1 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS breakfast,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 2 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS lunch,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 3 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS dinner,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 4 AND turn = 2 ORDER BY br_fr.id DESC LIMIT 1) AS nightLunch
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

    const {rows: employees} = await db.query(query, [moment().add(-1, 'days').format('YYYY-MM-DD'), moment().add(1, 'days').format('YYYY-MM-DD')]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: employees
    })
})

router.get('/projects/:id', checkAuth, userPermission, async (req, res) => {
    const query = `
        SELECT
            p.name AS project_name,
            p.id AS project_id,
            '${moment().add(-1, 'days').format('YYYY-MM-DD')}' as date,
            COUNT(CASE WHEN ea.turn = 1 THEN 1 END) AS turn1Employees,
            COUNT(CASE WHEN ea.turn = 2 THEN 1 END) AS turn2Employees,
            /*(SELECT COALESCE(
                       jsonb_agg(
                               to_jsonb(fr.*)
                       ),
                       '[]'::jsonb
               ) FROM food_reports_p fr WHERE fr.project_id = p.id AND Date(fr.date) = $2) AS report_status,*/
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 1 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS breakfast,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 2 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS lunch,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 3 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS dinner,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 4 AND turn = 2 ORDER BY br_fr.id DESC LIMIT 1) AS nightLunch,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 5 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS bread,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 6 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS kefir,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 7 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS sugar,
            (SELECT to_jsonb(br_fr.*) FROM food_reports_p br_fr WHERE br_fr.project_id = p.id AND Date(br_fr.date) = $2 AND type = 8 AND turn = 1 ORDER BY br_fr.id DESC LIMIT 1) AS tea
        FROM projects AS p
            LEFT JOIN project_members AS pm ON p.id = pm.project_id
            AND pm.status = 1 
            LEFT JOIN employees AS e ON e.id = pm.employee_id
            LEFT JOIN employee_activities AS ea ON ea.employee_id = e.id
            AND ea.status = 2
            AND ea.completed_status = 1
            AND ea.type = 1
            AND DATE(ea.review_time) = $1
        WHERE p.id = $3
        GROUP BY
            p.id, p.name
        ORDER BY
            p.id;
    `

    const {rows: employees} = await db.query(query, [moment().add(-1, 'days').format('YYYY-MM-DD'), moment().add(1, 'days').format('YYYY-MM-DD'), req.params.id]);

    return res.status(200).json({
        success: true,
        message: 'Food reports fetched successfully',
        data: employees?.[0] || {}
    })
})

export default router