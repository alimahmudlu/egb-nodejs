import express from "express";
import checkAuth from "../../middleware/checkAuth.js";
import db from "../../helper/db.js";
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import moment from "moment";
import userPermission from "../../middleware/userPermission.js";

const router = express.Router()

router.get('/list', checkAuth, userPermission, async (req, res) => {
    const {status, score_min, score_max, deadline_min, deadline_max} = req.query;
    const filters = [];
    const values = [];
    let idx = 2;

    if (status) {
        filters.push(`status = $${idx}`);
        values.push(status)
        idx++
    }
    if (score_min) {
        filters.push(`points >= $${idx}`);
        values.push(score_min)
        idx++
    }
    if (score_max) {
        filters.push(`points <= $${idx}`);
        values.push(score_max)
        idx++
    }
    if (deadline_min) {
        filters.push(`deadline >= $${idx}`);
        values.push(moment(deadline_min).format())
        idx++
    }
    if (deadline_max) {
        filters.push(`deadline <= $${idx}`);
        values.push(moment(deadline_max).format())
        idx++
    }

    const {rows} = await db.query(`SELECT
                                        t.*,
                                        (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                         FROM task_statuses ts
                                         WHERE ts.id = COALESCE((
                                                                    SELECT ta.status_id
                                                                    FROM task_activities ta
                                                                    WHERE ta.task_id = t.id
                                                                    ORDER BY ta.created_at DESC
                                                                LIMIT 1
                                             ), 1)
                                            LIMIT 1
                                       ) as status,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE assigned_employee_id = e.id LIMIT 1) as assigned_employee,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE reporter_employee_id = e.id LIMIT 1) as reporter_employee
                                    FROM tasks t
                                    WHERE project_id IN (SELECT project_id FROM project_members WHERE employee_id = $1) AND deleted_at IS NULL ${filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''}`, [req.currentUserId, ...values]);



    res.status(200).json({
        success: true,
        message: 'Tasks fetched successfully',
        data: rows
    })
})

router.get('/list/active', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`SELECT
                                        t.*,
                                        (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                         FROM task_statuses ts
                                         WHERE ts.id = COALESCE((
                                                                    SELECT ta.status_id
                                                                    FROM task_activities ta
                                                                    WHERE ta.task_id = t.id
                                                                    ORDER BY ta.created_at DESC
                                                                LIMIT 1
                                             ), 1)
                                            LIMIT 1
                                       ) as status,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE assigned_employee_id = e.id LIMIT 1) as assigned_employee,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE reporter_employee_id = e.id LIMIT 1) as reporter_employee
                                    FROM tasks t
                                    WHERE project_id IN (SELECT project_id FROM project_members WHERE employee_id = $1) AND deleted_at IS NULL AND NOT EXISTS (
                                       SELECT 1
                                       FROM task_activities ta
                                       WHERE ta.task_id = t.id
                                      AND ta.status_id = 5
                                       )`, [req.currentUserId]);



    res.status(200).json({
        success: true,
        message: 'Tasks fetched successfully',
        data: rows
    })
})

router.get('/list/completed', checkAuth, userPermission, async (req, res) => {
    const {rows} = await db.query(`SELECT
                                        t.*,
                                        (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                         FROM task_statuses ts
                                         WHERE ts.id = COALESCE((
                                                                    SELECT ta.status_id
                                                                    FROM task_activities ta
                                                                    WHERE ta.task_id = t.id
                                                                    ORDER BY ta.created_at DESC
                                                                LIMIT 1
                                             ), 1)
                                            LIMIT 1
                                       ) as status,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE assigned_employee_id = e.id LIMIT 1) as assigned_employee,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE reporter_employee_id = e.id LIMIT 1) as reporter_employee
                                    FROM tasks t
                                    WHERE project_id IN (SELECT project_id FROM project_members WHERE employee_id = $1) AND deleted_at IS NULL AND EXISTS (
                                       SELECT 1
                                       FROM task_activities ta
                                       WHERE ta.task_id = t.id
                                      AND ta.status_id = 5
                                       )`, [req.currentUserId]);



    res.status(200).json({
        success: true,
        message: 'Tasks fetched successfully',
        data: rows
    })
})

router.get('/list/:user_id', checkAuth, userPermission, async (req, res) => {
    const {user_id} = req.params;
    const {type} = req.query;

    const whereClause = type === 'active' ? `
     AND COALESCE((
        SELECT ta.status_id
        FROM task_activities ta
        WHERE ta.task_id = t.id
        ORDER BY ta.created_at DESC
        LIMIT 1
    ), 1) < 5` : type === 'completed' ? `
                                        AND COALESCE((
        SELECT ta.status_id
        FROM task_activities ta
        WHERE ta.task_id = t.id
        ORDER BY ta.created_at DESC
        LIMIT 1
    ), 1) = 5` : '';

    const {rows} = await db.query(`SELECT
                                        t.*,
                                        (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                         FROM task_statuses ts
                                         WHERE ts.id = COALESCE((
                                                                    SELECT ta.status_id
                                                                    FROM task_activities ta
                                                                    WHERE ta.task_id = t.id
                                                                    ORDER BY ta.created_at DESC
                                                                LIMIT 1
                                             ), 1)
                                            LIMIT 1
                                       ) as status,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE assigned_employee_id = e.id LIMIT 1) as assigned_employee,
                                        (SELECT json_build_object('id', e.id, 'full_name', e.full_name) FROM employees e WHERE reporter_employee_id = e.id LIMIT 1) as reporter_employee
                                    FROM tasks t
                                    WHERE assigned_employee_id = $1 AND deleted_at IS NULL ${whereClause}`, [user_id]);

    res.status(200).json({
        success: true,
        message: 'Tasks fetched successfully',
        data: rows
    })
})

router.post('/create', checkAuth, userPermission, async (req, res) => {
    const {title, deadline, point, description, assigned_employee_id, project_id} = req.body;

    const {rows: createdRows} = await db.query(`INSERT INTO tasks 
                        (name, deadline, points, description, status, reporter_employee_id, assigned_employee_id, project_id, created_employee_id) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING * `,
                        [title, deadline, point, description, 1, req.currentUserId, assigned_employee_id, project_id, req.currentUserId]
    );

    if (createdRows.length === 0) {
        return res.status(500).json({
            success: false,
            message: 'Task creat error',
            data: createdRows[0]
        })
    }

    const {rows: insertedRow} = await db.query(`SELECT *,
                                          (SELECT json_build_object('id', ts.id, 'name', ts.name)
                                           FROM task_statuses ts WHERE status = ts.id LIMIT 1) as status,
       (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
        FROM employees e WHERE id = t.assigned_employee_id LIMIT 1) as assigned_employee,
       (SELECT json_build_object('id', e.id, 'full_name', e.full_name)
        FROM employees e WHERE id = t.reporter_employee_id LIMIT 1) as reporter_employee
                                   FROM tasks t WHERE t.id = $1`, [createdRows?.[0]?.id])


    const io = getIO();
    const socketId = userSocketMap.get(assigned_employee_id);

    if (socketId) {
        io.to(socketId).emit("add_task", {
            success: true,
            from: req.currentUserId,
            message: 'You have been added to a new task.',
            data: insertedRow[0]
        });
    }

    sendPushNotification(assigned_employee_id, 'Assign new task', 'You have been added to a new task.')

    await db.query(`
                INSERT INTO notifications
                (title, description, type, url, user_id, create_at, update_at, read, title_ru, description_ru, title_uz, description_uz)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *
            `,
            [
                'Task added',
                `'${insertedRow?.[0]?.name}' task added and assigned to you.`,
                'task_activities',
                `/employeePages/projects/${insertedRow?.[0]?.project_id}/${insertedRow?.[0]?.id}/`,
                insertedRow?.[0]?.assigned_employee_id,
                moment().format(),
                moment().format(),
                0,
                'Задача добавлена',
                `Задача '${insertedRow?.[0]?.name}' добавлена и назначена вам.`,
                `Vazifa qo'shildi`,
                `'${insertedRow?.[0]?.name}' vazifasi qo'shildi va sizga tayinlandi.`,
            ]
    )

    return res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: createdRows[0]
    })
})

router.delete('/:id', checkAuth, userPermission, async (req, res) => {
    const {id} = req.params;

    const {rows} = await db.query(`UPDATE tasks SET deleted_at = $1 WHERE id = $2 RETURNING *`, [new Date(), id])



    const io = getIO();
    const socketId = userSocketMap.get(rows?.[0]?.assigned_employee_id);

    if (socketId) {
        io.to(socketId).emit("remove_task", {
            success: true,
            from: req.currentUserId,
            message: 'You have been added to a new task.',
            data: rows?.[0]
        });
    }

    if (rows.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'Task not found',
            data: null
        });
    }
    res.status(200).json({
        success: true,
        message: 'Task deleted successfully',
        data: rows[0]
    })
})

export default router