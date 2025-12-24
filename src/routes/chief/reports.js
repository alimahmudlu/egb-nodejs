import express from 'express'
import db from '../../helper/db.js'
import checkAuth from '../../middleware/checkAuth.js'
import {getIO, userSocketMap} from "../../socketManager.js";
import sendPushNotification from "../../helper/sendPushNotification.js";
import userPermission from "../../middleware/userPermission.js";
import moment from "moment";

const router = express.Router()

router.get('/list', checkAuth, userPermission, async (req, res) => {
    const {project, start_date, end_date} = req.query
    const filters = [];
    const filters2 = [];

    if (project && Array.isArray(project) && (project || []).length > 0) {
        filters.push(`p.id IN (${project.join(',')})`);
    }
    if (project && !Array.isArray(project)) {
        filters.push(`p.id = ${project}`);
    }
    if (start_date) {
        filters2.push(`DATE(ea.review_time) >= '${start_date}'`);
    }
    if (end_date) {
        filters2.push(`DATE(ea.review_time) <= '${end_date}'`);
    }

    const whereClause = filters.length
        ? `WHERE ${filters.join(' AND ')}`
        : 'WHERE 1=1';
    const whereClause2 = filters2.length
        ? ` AND ${filters2.join(' AND ')}`
        : '1=1';
    const query = `SELECT
                       p.name,
                       p.id,
                       COUNT(pm.id) AS member_count,
                       COUNT(CASE WHEN ps.status = 1 THEN 1 END) AS direct_member_count,
                       COUNT(CASE WHEN ps.status = 2 THEN 1 END) AS indirect_member_count,
                       COUNT(CASE WHEN activity_checkin.employee_id IS NOT NULL THEN 1 END) AS total_checkin_count,
                       COUNT(CASE WHEN ps.status = 1 AND activity_checkin.employee_id IS NOT NULL THEN 1 END) AS direct_checkin_count,
                       COUNT(CASE WHEN ps.status = 2 AND activity_checkin.employee_id IS NOT NULL THEN 1 END) AS indirect_checkin_count

                   FROM projects p
                            LEFT JOIN project_members pm
                                      ON pm.project_id = p.id AND pm.status = 1
                            JOIN employees e
                                 ON e.id = pm.employee_id AND e.is_active = true
                            LEFT JOIN positions ps
                                      ON ps.id = e.position
                            LEFT JOIN (
                       SELECT DISTINCT
                           ea.employee_id
                       FROM employee_activities ea
                       WHERE ea.type = 1 AND ea.status = 2 ${whereClause2}
                   ) AS activity_checkin
                                      ON activity_checkin.employee_id = e.id

                       ${whereClause}
                   AND pm.employee_id = ${req.currentUserId}
                   GROUP BY p.id, p.name
                   ORDER BY p.id DESC;`
    const {rows} = await db.query(query, [])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

router.get('/statistics', checkAuth, userPermission, async (req, res) => {
    const {project, start_date, end_date} = req.query

    const filters = [];
    const filters2 = [];


    if (project && Array.isArray(project) && (project || []).length > 0) {
        filters.push(`pm.project_id IN (${project.join(',')})`);
    }
    if (project && !Array.isArray(project)) {
        filters.push(`pm.project_id = ${project}`);
    }
    if (start_date) {
        filters2.push(`DATE(ea.review_time) >= '${start_date}'`);
    }
    if (end_date) {
        filters2.push(`DATE(ea.review_time) <= '${end_date}'`);
    }

    const whereClause = filters.length
        ? `AND ${filters.join(' AND ')}`
        : '1=1';
    const whereClause2 = filters2.length
        ? ` AND ${filters2.join(' AND ')}`
        : '1=1';


    const query = `
        WITH UniqueMembers AS (
            SELECT DISTINCT
                pm.employee_id,
                ps.status AS position_status,
                CASE WHEN activity_checkin.employee_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_checked_in,
                CASE WHEN activity_manual_checkin.employee_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_manual_checked_in
            FROM project_members pm
                     INNER JOIN employees e ON e.id = pm.employee_id
                     LEFT JOIN positions ps ON ps.id = e.position

                     LEFT JOIN (
                SELECT DISTINCT ea.employee_id
                FROM employee_activities ea
                WHERE (ea.type = 1 OR ea.type = 3) AND ea.status = 2 ${whereClause2}
            ) AS activity_checkin ON activity_checkin.employee_id = e.id

                     LEFT JOIN (
                SELECT DISTINCT ea.employee_id
                FROM employee_activities ea
                WHERE (ea.type = 1 OR ea.type = 3) AND ea.status = 2 AND ea.is_manual = TRUE ${whereClause2}
            ) AS activity_manual_checkin ON activity_manual_checkin.employee_id = e.id

            WHERE pm.status = 1
            ${whereClause}
            AND (e.is_active = TRUE OR activity_checkin.employee_id IS NOT NULL)
            )
        SELECT
            COUNT(um.employee_id) AS member_count,
            COUNT(CASE WHEN um.position_status = 1 THEN 1 END) AS direct_member_count,
            COUNT(CASE WHEN um.position_status = 2 THEN 1 END) AS indirect_member_count,
            COUNT(CASE WHEN um.has_checked_in = TRUE THEN 1 END) AS total_checkin_count,
            COUNT(CASE WHEN um.has_manual_checked_in = TRUE THEN 1 END) AS total_manual_checkin_count,
            COUNT(CASE WHEN um.position_status = 1 AND um.has_checked_in = TRUE THEN 1 END) AS direct_checkin_count,
            COUNT(CASE WHEN um.position_status = 2 AND um.has_checked_in = TRUE THEN 1 END) AS indirect_checkin_count
        FROM
            UniqueMembers um;
    `;

    const {rows} = await db.query(query, [])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

export default router