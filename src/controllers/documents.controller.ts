import express, { Response } from 'express';
import prisma from '../config/prisma';
import { addAuditLog } from '../services/auditlog.service';
import { AuthenticatedVehicleOwnerRequest } from '../types';
import path from 'path';
import { UploadedFile } from 'express-fileupload';

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/documents');

router.post('/upload', (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
  try {
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      res.status(400).json({ message: 'Invalid content type. Use multipart/form-data.' });
      return;
    }

    if (!req.files || !req.files.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const uploaded = req.files.file as UploadedFile;

    const fileName = `${Date.now()}-${uploaded.name}`;
    const savePath = path.join(uploadDir, fileName);

    uploaded.mv(savePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'File upload failed' });
        return;
      }

      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
      res.json({ message: 'File uploaded', url: fileUrl });
      return;
    });
  } catch (err: any) {
    res.status(500).json({
      message: 'Internal server error. Could not uplaod the document.',
      error: err.message,
    });

    return;
  }
});

export default router;
