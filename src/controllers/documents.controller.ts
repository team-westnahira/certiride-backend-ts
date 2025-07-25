import express, { Response } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedVehicleOwnerRequest } from '../types';
import path from 'path';
import { UploadedFile } from 'express-fileupload';
import { z } from 'zod';
import vehicleOwnerAuthMiddleware from '../middleware/vehicleOwner.middleware';
import { analyzeVehicleDocument } from '../services/ai.service';
import analyzeDocument from '../services/ocr.service';
import fs from 'fs';

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/documents');

router.post(
  '/upload',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
    try {
      if (!req.headers['content-type']?.includes('multipart/form-data')) {
        res.status(400).json({ message: 'Invalid content type. Use multipart/form-data.' });
        return;
      }

      if (!req.files || !req.files.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const schema = z.object({
        vehicleId: z.string().min(1, 'vehicle id is required'),
      });

      const parsedData = schema.safeParse(req.body);

      if (!parsedData.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: parsedData.error.errors,
        });
        return;
      }

      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const vehicle = await prisma.vehicle.findUnique({
        where: { vehicleId: +parsedData.data.vehicleId, ownerId: req.user.id },
      });

      if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found or does not belong to user.' });
        return;
      }

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uploaded = req.files.file as UploadedFile;
      const fileName = `${Date.now()}-${uploaded.name}`;
      const savePath = path.join(uploadDir, fileName);

      uploaded.mv(savePath, async (err) => {
        if (err) {
          console.log(err);
          res.status(500).json({ error: 'File upload failed' });
          return;
        }

        // handle document analysis in the background!
        const result = await analyzeDocument(savePath);
        const extractedData = await analyzeVehicleDocument(result.content);
        console.log('data ---> ', extractedData);
        const uploadedFile = await prisma.file.create({
          data: {
            originalName: uploaded.name,
            uniquePath: fileName,
            fileSize: uploaded.size,
            fileType: uploaded.mimetype,
            uploadedById: req.user?.id || 0,
            vehicleId: +parsedData.data.vehicleId,
            extractedData: JSON.stringify(extractedData),
            category: extractedData.document_type,
          },
        });

        res.json({ message: 'File uploaded successfully', uploadedFile });
        return;
      });
    } catch (err: any) {
      res.status(500).json({
        message: 'Internal server error. Could not uplaod the document.',
        error: err.message,
      });

      return;
    }
  }
);

router.get(
  '/my-files',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
    try {
      const files = await prisma.file.findMany({
        where: { uploadedById: req.user?.id || 0 },
        orderBy: { uploadedAt: 'desc' },
      });

      res.json(files);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Could not retrieve files' });
    }
  }
);

router.get(
  '/search',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
    const userId = (req.user as any).id;
    const query = req.query.query?.toString().trim();

    if (!query) {
      res.status(400).json({ error: 'Missing search query' });
      return;
    }

    try {
      const results = await prisma.file.findMany({
        where: {
          uploadedById: userId,
          originalName: {
            contains: query.toLowerCase(),
          },
        },
        orderBy: {
          uploadedAt: 'desc',
        },
      });

      res.json(results);
      return;
    } catch (error) {
      console.error('File search error:', error);
      res.status(500).json({ error: 'Error searching files' });
      return;
    }
  }
);

router.get(
  '/download/:id',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
    const userId = (req.user as any).id;
    const fileId = Number(req.params.id);

    try {
      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          uploadedById: userId,
        },
      });

      if (!file) {
        res.status(404).json({ error: 'File not found or access denied' });
        return;
      }

      const filePath = path.join(__dirname, '..', '..', 'uploads', 'documents', file.uniquePath);
      res.download(filePath, file.originalName);
      return;
    } catch (err) {
      console.error('Download error:', err);
      res.status(500).json({ error: 'Error downloading file' });
      return;
    }
  }
);

router.delete(
  '/delete/:id',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
    const userId = req.user?.id || 0;
    const fileId = Number(req.params.id);

    try {
      const file = await prisma.file.findFirst({
        where: { id: fileId, uploadedById: userId },
      });

      if (!file) {
        res.status(404).json({ error: 'File not found or access denied' });
        return;
      }

      const filePath = path.join(uploadDir, file.uniquePath);
      try {
        await fs.promises.unlink(filePath);
      } catch (fsErr: any) {
        if (fsErr.code !== 'ENOENT') {
          console.error('File unlink error:', fsErr);
          res.status(500).json({ error: 'Could not delete file from disk' });
          return;
        }
      }

      await prisma.file.delete({ where: { id: fileId } });

      res.json({ message: 'File deleted successfully', fileId });
    } catch (err) {
      console.error('Delete error:', err);
      res.status(500).json({ error: 'Error deleting file' });
    }
  }
);

export default router;
