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
    INSERT INTO bus_reports (project_id, turn1_employee_count, turn2_employee_count, bus_count, seat_count, date, employee_id, trip_type, bus_type_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
`, [projectId, turn1employees, turn2employees, countOfBus, countOfSeatInEveryBus, date, req.currentUserId, tripTypeId, tripTypeId]);

    if (rows.length > 0) {
        const id = rows?.[0].id;

        if (campId && campId.length > 0) {
            const campValuesClause = campId?.map(
                (row, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
            ).join(', ');
            const campValues = campId?.map((row) => (
                [id, row]
            )).flat()
            console.log(`INSERT INTO bus_report_camps (bus_report_id, camp_id) VALUES ${campValuesClause}`, campValues)
            const {rows: insertBusCamps} = await db.query(`INSERT INTO bus_report_camps (bus_report_id, camp_id) VALUES ${campValuesClause}`, campValues);
        }

        if (toProjectId && toProjectId.length > 0) {
            const projectValuesClause = toProjectId?.map(
                (row, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
            ).join(', ');
            const projectValues = toProjectId?.map((row) => (
                [id, row]
            )).flat()
            console.log(`INSERT INTO bus_report_projects (bus_report_id, project_id) VALUES ${projectValuesClause}`, projectValues)
            const {rows: insertBusProject} = await db.query(`INSERT INTO bus_report_projects (bus_report_id, project_id) VALUES ${projectValuesClause}`, projectValues);
        }

    }

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
            SET  bus_count = $1, seat_count = $2, trip_type = $3, bus_type_id = $4
            WHERE id = $5
        `, [ countOfBus, countOfSeatInEveryBus, tripTypeId, tripTypeId, req.params.id])

        const id = req.params.id;
        const {rows: deletedBusCamps} = await db.query(`
        DELETE FROM bus_report_camps WHERE bus_report_id = $1 RETURNING *
    `, [id]);
        const {rows: deletedBusProjects} = await db.query(`
        DELETE FROM bus_report_projects WHERE bus_report_id = $1 RETURNING *
    `, [id]);

        if (campId && campId.length > 0) {
            const campValuesClause = campId?.map(
                (row, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
            ).join(', ');
            const campValues = campId?.map((row) => (
                [id, row]
            )).flat()

            const {rows: insertBusCamps} = await db.query(`INSERT INTO bus_report_camps (bus_report_id, camp_id) VALUES ${campValuesClause}`, campValues);
        }

        if (toProjectId && toProjectId.length > 0) {
            const projectValuesClause = toProjectId?.map(
                (row, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
            ).join(', ');
            const projectValues = toProjectId?.map((row) => (
                [id, row]
            )).flat()

            const {rows: insertBusProject} = await db.query(`INSERT INTO bus_report_projects (bus_report_id, project_id) VALUES ${projectValuesClause}`, projectValues);
        }

        return res.status(200).json({
            success: true,
            message: 'Bus report delete successfully',
            data: rows?.[0]
        })
    }
    else {
        const {rows} = await db.query(`
            INSERT INTO bus_reports (project_id, turn1_employee_count, turn2_employee_count, bus_count, seat_count, date, employee_id, trip_type, bus_type_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
        `, [projectId, turn1employees, turn2employees, countOfBus, countOfSeatInEveryBus, date, req.currentUserId, tripTypeId, tripTypeId]);

        if (rows.length > 0) {
            const id = rows?.[0].id;

            if (campId && campId.length > 0) {
                const campValuesClause = campId?.map(
                    (row, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
                ).join(', ');
                const campValues = campId?.map((row) => (
                    [id, row]
                )).flat()
                console.log(`INSERT INTO bus_report_camps (bus_report_id, camp_id) VALUES ${campValuesClause}`, campValues)
                const {rows: insertBusCamps} = await db.query(`INSERT INTO bus_report_camps (bus_report_id, camp_id) VALUES ${campValuesClause}`, campValues);
            }

            if (toProjectId && toProjectId.length > 0) {
                const projectValuesClause = toProjectId?.map(
                    (row, i) => `($${i * 2 + 1}, $${i * 2 + 2})`
                ).join(', ');
                const projectValues = toProjectId?.map((row) => (
                    [id, row]
                )).flat()
                console.log(`INSERT INTO bus_report_projects (bus_report_id, project_id) VALUES ${projectValuesClause}`, projectValues)
                const {rows: insertBusProject} = await db.query(`INSERT INTO bus_report_projects (bus_report_id, project_id) VALUES ${projectValuesClause}`, projectValues);
            }

        }
        return res.status(200).json({
            success: true,
            message: 'Bus report added successfully',
            data: rows?.[0]
        })
    }
})

router.delete('/report/delete/:id', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`
        DELETE FROM bus_reports WHERE id = $1 RETURNING *
    `, [req.params.id]);
    const {rows: deletedBusCamps} = await db.query(`
        DELETE FROM bus_report_camps WHERE bus_report_id = $1 RETURNING *
    `, [req.params.id]);
    const {rows: deletedBusProjects} = await db.query(`
        DELETE FROM bus_report_projects WHERE bus_report_id = $1 RETURNING *
    `, [req.params.id]);

    return res.status(200).json({
        success: true,
        message: 'Bus report deleted successfully',
        data: rows?.[0]
    })
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
            p.id AS project_id,
            (SELECT json_agg(json_build_object('id', brc.camp_id, 'name', brcC.name)) FROM bus_report_camps brc LEFT JOIN camps brcC ON brcC.id = brc.camp_id WHERE brc.bus_report_id = br.id ) AS camp_ids,
            (SELECT json_agg(json_build_object('id', brp.project_id, 'name', brpP.name)) FROM bus_report_projects brp LEFT JOIN projects brpP ON brpP.id = brp.project_id WHERE brp.bus_report_id = br.id ) AS to_project_ids
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