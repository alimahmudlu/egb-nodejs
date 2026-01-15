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

    console.log(project, Array.isArray(project))

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
        : ' AND 1=1';
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
--                    AND pm.employee_id = ${req.currentUserId}
                   GROUP BY p.id, p.name
                   ORDER BY p.id DESC;`
    const {rows} = await db.query(query, [])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows
    })
})

router.get('/list/item', checkAuth, userPermission, async (req, res) => {
    const {name, employee_id, position_id, role_id, staff_status, checkin_status, project, dontShowSubcontractors, showSubcontractors, status, turn, checkType, start_date, end_date, today, id} = req.query
    const filters = [];

    if (name) {
        filters.push(
            `(LOWER(e.full_name) LIKE LOWER(%${name}%) OR LOWER(e.full_name_russian) LIKE LOWER(%${name}%))`
        );
    }
    if (employee_id) {
        filters.push(`e.id = ${employee_id}`);
    }
    if (position_id) {
        filters.push(`e.position = ${position_id}`);
    }
    if (role_id) {
        filters.push(`pm.role_id = ${role_id}`);
    }
    if (staff_status) {
        filters.push(`ps.status = ${staff_status}`);
    }
    if (checkin_status === '1') {
        filters.push(`checkin_status.employee_id IS NOT NULL`);
    }
    if (checkin_status === '2') {
        filters.push(`checkin_status.employee_id IS NULL`);
    }
    if (project && project.length > 0) {
        filters.push(`p.id IN (${project.join(',')})`);
    }
    if (dontShowSubcontractors) {
        filters.push(`a.subcontract = false`);
    }
    if (showSubcontractors) {
        filters.push(`a.subcontract = true`);
    }

    const whereClause = filters.length ? ` AND ${filters.join(' AND ')}` : '';


    const query = `SELECT
                       e.id AS employee_id,
                       e.full_name,
                       e.full_name_russian,
                       ps.name AS employee_position_name,
                       ps.name_ru AS employee_position_name_russian,
                       r.name AS employee_role_name,
                       STRING_AGG(p.name, ', ') AS employee_projects,
                       ps.status AS employee_staff_status,
                       CASE
                           WHEN checkin_status.employee_id IS NOT NULL THEN TRUE
                           ELSE FALSE
                           END AS is_checked_in_on_date,
                       checkin_status.turn AS employee_turn
                   FROM employees e
                            JOIN project_members pm
                                 ON pm.employee_id = e.id AND pm.status = 1
                            JOIN projects p
                                 ON p.id = pm.project_id
                            JOIN applications a
                                 ON a.id = e.application_id
                            LEFT JOIN positions ps
                                      ON ps.id = e.position
                            LEFT JOIN roles r
                                      ON r.id = pm.role_id
                            LEFT JOIN (
                       SELECT
                           ea.employee_id,
                           MAX(ea.turn) AS turn
                       FROM employee_activities ea
                       WHERE
                           ((ea.type = 1 OR ea.type = 3) AND ea.status = 2)

                           ${status ? ` AND ea.is_manual = ${status === '1' ? true : false}` : ''}
                           ${checkType ? ` AND ea.type = ${checkType}` : ''}
                           ${turn ? ` AND ea.turn = ${turn}` : ''}
                           ${start_date && end_date ?
                                   `
                            AND DATE(ea.review_time) >= '${start_date}'
                            AND DATE(ea.review_time) <= '${end_date}'
                            ` : ` AND DATE(ea.review_time) = '${today}'`}


                       GROUP BY ea.employee_id
                   ) AS checkin_status
                                      ON checkin_status.employee_id = e.id
                   WHERE ${id ? `p.id IN (${id})` : '1=1'} ${whereClause} AND e.is_active = TRUE
                         ${end_date ?
                                 ` AND DATE(a.employees_non_official_start_date) <= '${end_date}'`
                                 :
                                 ` AND DATE(a.employees_non_official_start_date) <= '${today}'`}
                   GROUP BY
                       e.id,
                       e.full_name,
                       e.full_name_russian,
                       ps.name,
                       ps.name_ru,
                       r.name,
                       ps.status,
                       checkin_status.employee_id,
                       checkin_status.turn
                   ORDER BY e.id;`
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
    const filters3 = [];


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
        filters3.push(`DATE(a.employees_non_official_start_date) <= '${end_date}'`);
    }

    const whereClause = filters.length
        ? ` AND ${filters.join(' AND ')}`
        : ' AND 1=1';
    const whereClause2 = filters2.length
        ? ` AND ${filters2.join(' AND ')}`
        : ' AND 1=1';
    const whereClause3 = filters3.length
        ? ` AND ${filters3.join(' AND ')}`
        : ' AND 1=1';


    const query = `
        WITH UniqueMembers AS (
            SELECT DISTINCT
                pm.employee_id,
                ps.status AS position_status,
                e.is_draft, -- is_draft sütununu götürürük
                CASE WHEN ei.employee_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_ios_user, -- iOS yoxlaması
                CASE WHEN activity_checkin.employee_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_checked_in,
                CASE WHEN activity_manual_checkin.employee_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_manual_checked_in
            FROM project_members pm
                     INNER JOIN employees e ON e.id = pm.employee_id
                     JOIN applications a ON a.id = e.application_id
                     LEFT JOIN positions ps ON ps.id = e.position
                -- iOS istifadəçilərini yoxlamaq üçün join
                     LEFT JOIN employee_ios ei ON ei.employee_id = e.id

                -- 1. Həmin tarixdə fəaliyyəti olanlar
                     LEFT JOIN (
                SELECT DISTINCT ea.employee_id
                FROM employee_activities ea
                WHERE (ea.type = 1 OR ea.type = 3) AND ea.status = 2 ${whereClause2}
            ) AS activity_checkin ON activity_checkin.employee_id = e.id

                -- 2. Manual olanlar
                     LEFT JOIN (
                SELECT DISTINCT ea.employee_id
                FROM employee_activities ea
                WHERE (ea.type = 1 OR ea.type = 3) AND ea.status = 2 AND ea.is_manual = TRUE ${whereClause2}
            ) AS activity_manual_checkin ON activity_manual_checkin.employee_id = e.id

            WHERE pm.status = 1
            ${whereClause}
            AND (e.is_active = TRUE OR activity_checkin.employee_id IS NOT NULL)
            ${whereClause3}
            )
        SELECT
            COUNT(um.employee_id) AS member_count,
            COUNT(CASE WHEN um.position_status = 1 THEN 1 END) AS direct_member_count,
            COUNT(CASE WHEN um.position_status = 2 THEN 1 END) AS indirect_member_count,
            COUNT(CASE WHEN um.has_checked_in = TRUE THEN 1 END) AS total_checkin_count,

            COUNT(CASE WHEN um.has_manual_checked_in = TRUE THEN 1 END) AS total_manual_checkin_count,

            COUNT(CASE WHEN um.has_manual_checked_in = TRUE AND um.is_draft = TRUE THEN 1 END) AS manual_draft_count,

            COUNT(CASE WHEN um.has_manual_checked_in = TRUE AND um.is_ios_user = TRUE THEN 1 END) AS manual_ios_count,

            COUNT(CASE WHEN um.position_status = 1 AND um.has_checked_in = TRUE THEN 1 END) AS direct_checkin_count,
            COUNT(CASE WHEN um.position_status = 2 AND um.has_checked_in = TRUE THEN 1 END) AS indirect_checkin_count
        FROM
            UniqueMembers um;`

    const {rows} = await db.query(query, [])

    res.json({
        success: true,
        message: 'Projects fetched successfully',
        data: rows?.[0]
    })
})

export default router