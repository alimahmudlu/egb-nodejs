import multer from 'multer';
import express from "express";
import {put} from "@vercel/blob";
import dotenv from "dotenv";
import db from "../helper/db.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,     // 50MB fayl ölçüsü limiti
        fieldSize: 10 * 1024 * 1024     // 10MB text sahələr (string) limiti
    }
});
const router = express.Router();


router.post('/file', upload.single('file'), async (req, res) => {
    try {
        console.log(req.file, 'req.file');
        const { originalname, mimetype, buffer } = req.file;

        const blob = await put(originalname, buffer, {
            access: 'public',
            contentType: mimetype,
            token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
            addRandomSuffix: true
        });

        const {rows} = await db.query(
            'INSERT INTO uploads (filename, filepath, mimetype, filesize) VALUES ($1, $2, $3, $4) RETURNING *',
            [originalname, blob.url, mimetype, 100]
        );

        console.log(rows)

        res.json({
            success: true,
            message: 'File upload successfull',
            data: rows?.[0]
        });
    } catch (error) {
        console.error(error);
        console.error('Yükləmə zamanı xəta baş verdi');
        res.status(500).json({ error: 'Yükləmə zamanı xəta baş verdi' });
    }
});

export default router;