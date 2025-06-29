import upload from 'multer';
import express from "express";
import {put} from "@vercel/blob";
import dotenv from "dotenv";
const router = express.Router();

router.post('/file', upload.single('file'), async (req, res) => {
    try {
        const { originalname, mimetype, buffer } = req.file;
        console.log(originalname, mimetype, buffer, 'AAAAAABBBBBCCCCC file upload')

        const blob = await put(originalname, buffer, {
            access: 'public',
            contentType: mimetype,
            token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
        });
        console.log(blob.url, 'AAAAAABBBBBCCCCCDDDDDDDDDDDDDDD file upload blob')

        res.json({ url: blob.url });
    } catch (error) {
        console.error(error);
        console.error('Yükləmə zamanı xəta baş verdi');
        res.status(500).json({ error: 'Yükləmə zamanı xəta baş verdi' });
    }
});

export default router;