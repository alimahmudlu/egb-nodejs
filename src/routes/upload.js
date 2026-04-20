import multer from 'multer';
import express from "express";
import {put} from "@vercel/blob";
import dotenv from "dotenv";
import db from "../helper/db.js";
import path  from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024,     // 50MB fayl ölçüsü limiti
        fieldSize: 10 * 1024 * 1024     // 10MB text sahələr (string) limiti
    }
});
const s3Client = new S3Client({
    region: process.env.S3_REGION || "ru-central1",
    endpoint: process.env.S3_ENDPOINT || "https://storage.yandexcloud.net",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
});
const router = express.Router();


router.post('/file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Fayl seçilməyib' });
        }

        const { originalname, mimetype, buffer, size } = req.file;

        const ext = path.extname(originalname);
        const baseName = path.basename(originalname, ext).replace(/[^a-z0-9]/gi, '_');
        const randomSuffix = crypto.randomBytes(4).toString('hex');
        const uniqueName = `${baseName}-${randomSuffix}${ext}`;

        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: uniqueName,
            Body: buffer,
            ContentType: mimetype,
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        const fileUrl = `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${uniqueName}`;

        const { rows } = await db.query(
            'INSERT INTO uploads (filename, filepath, mimetype, filesize) VALUES ($1, $2, $3, $4) RETURNING *',
            [originalname, fileUrl, mimetype, size]
        );

        res.json({
            success: true,
            message: 'File upload successful',
            data: rows?.[0]
        });
    } catch (error) {
        console.error('Yandex S3 Error:', error);
        res.status(500).json({ error: 'Yükləmə zamanı xəta baş verdi' });
    }
});

export default router;