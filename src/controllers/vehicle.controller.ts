import express, { Request, Response, Router } from 'express';
import prisma from '../config/prisma';
import vehicleOwnerAuthMiddleware from '../middleware/vehicleOwner.middleware';
import { z } from 'zod';
import { VehicleOwner } from '@prisma/client';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import {
  extractVehicleCertificateDetailedData,
  extractVehicleCertificateDocumentData,
} from '../services/ai.service';
import analyzeDocument, { analyzeDocumentInMemory } from '../services/ocr.service';
import { AuthenticatedVehicleOwnerRequest, VehicleRegistrationData } from '../types';
import axiosInstance from '../config/axios';
import { VehicleBlockChainModel } from '../models/vehicle.model';
import { calculateCompositeRating } from '../services/certificate.service';
import { getDocumentHash } from '../services/hash.service';
import dotenv from 'dotenv';
dotenv.config();

const router: Router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: VehicleOwner;
}

router.post(
  '/add-new-vehicle',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.headers['content-type']?.includes('multipart/form-data')) {
        res.status(400).json({ message: 'Invalid content type. Use multipart/form-data.' });
        return;
      }

      const vehicleRegisterSchema = z.object({
        vin: z.string().min(1, 'VIN is required'),
        manufacture: z.string().min(1, 'Manufacture is required'),
        model: z.string().min(1, 'Model is required'),
        year: z.string().min(1, 'Valid Year is required'),
        color: z.string().min(1, 'Color is required'),
        engineCapacity: z.string().min(1, 'Engine capacity is required'),
        province: z.string().min(1, 'Province is required'),
        fuelType: z.string().min(1, 'Fuel type is required'),
        initialMilage: z.string().min(1, 'Initial Milage is required'),
      });

      const parsedData = vehicleRegisterSchema.safeParse(req.body);

      if (!parsedData.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: parsedData.error.errors,
        });
        return;
      }

      const {
        vin,
        manufacture,
        model,
        year,
        color,
        engineCapacity,
        province,
        fuelType,
        initialMilage,
      } = parsedData.data;

      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized. User not authenticated.' });
        return;
      }

      const existingVehicle = await prisma.vehicle.findUnique({ where: { vin } });

      if (existingVehicle) {
        res.status(409).json({ message: 'Vehicle is already registered.' });
        return;
      }

      const file = req.files?.registrationCertificate as fileUpload.UploadedFile;

      if (!file) {
        res.status(400).json({ message: 'Vehicle Certification File is required' });
        return;
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedMimeTypes.includes(file.mimetype || '')) {
        res
          .status(400)
          .json({ message: 'Invalid file type. Only JPEG, PNG, and GIF are allowed.' });
        return;
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        res.status(400).json({ message: 'File size exceeds 5MB limit.' });
        return;
      }

      const uploadDir = path.join(__dirname, '../../uploads/vehicles/certificates');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
      file.mv(filePath, async (err) => {
        if (err) {
          res.status(500).json({ message: 'Error saving file', error: err });
          return;
        }

        const result = await analyzeDocument(filePath);

        const fileHash = getDocumentHash(result.content);
        const existingFileHash = await prisma.fileHash.findUnique({
          where: { hash: fileHash },
        });

        if (existingFileHash) {
          fs.unlinkSync(filePath);
          res.status(400).json({ message: 'File hash already exists' });
          return;
        }

        await prisma.fileHash.create({
          data: {
            hash: fileHash,
            fileName: filePath,
            uploadedAt: new Date(),
          },
        });

        const extractedData = await extractVehicleCertificateDocumentData(result.content);

        if (extractedData === null) {
          await prisma.fileHash.delete({
            where: { hash: fileHash },
          });
          res.status(400).json({ message: 'Error extracting vehicle data from the document.' });
          return;
        }

        const vehicleCertificate: VehicleRegistrationData = JSON.parse(extractedData);

        if (vehicleCertificate.authenticity_score < 0.8) {
          await prisma.fileHash.delete({
            where: { hash: fileHash },
          });
          res.status(400).json({ message: 'The extracted vehicle data is not authentic.' });
          return;
        }

        if (vehicleCertificate.chassis_number !== vin) {
          await prisma.fileHash.delete({
            where: { hash: fileHash },
          });
          res
            .status(400)
            .json({ message: 'The extracted vehicle data does not match the provided VIN.' });
          return;
        }

        const newVehicle = await prisma.vehicle.create({
          data: {
            vin,
            manufacture,
            ownerId: req.user?.id || 0,
            model,
            year: +year,
            initialMilage: +initialMilage,
          },
        });

        try {
          const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
          await axiosInstance.post('/invoke', {
            fn: 'createVehicle',
            args: [
              vehicleCertificate.chassis_number,
              req.user?.id + '',
              newVehicle.manufacture,
              newVehicle.model,
              newVehicle.year + '',
              color,
              engineCapacity,
              province,
              fuelType,
            ],
            username: req.user?.nic + appedix,
          });
        } catch (err) {
          console.log(err)
          await prisma.fileHash.delete({
            where: { hash: fileHash },
          });
          await prisma.vehicle.delete({
            where: { vin: vin },
          });
          res.status(500).json({
            message: 'Error invoking chaincode. Could not create vehicle asset.',
            error: err,
          });
          return;
        }

        res.status(201).json({
          message: 'Vehicle registered successfully.',
          vehicle: newVehicle,
        });

        return;
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Internal server error. Could not register vehicle.',
        error: error.message,
      });

      return;
    }
  }
);

router.get(
  '/get-user-vehicles',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized. User not authenticated.' });
        return;
      }

      const vehicles = await prisma.vehicle.findMany({
        where: {
          ownerId: req.user.id,
        },
      });

      res.status(200).json({
        vehicles,
      });
    } catch (err) {
      res.status(500).json({
        message: 'Internal server error. Could not fetch user vehicles.',
      });
      return;
    }
  }
);

router.get(
  '/get-vehicle-full-data',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized. User not authenticated.' });
        return;
      }

      if (!req.query.vin) {
        res.status(400).json({ message: 'Pleas provide valid vin' });
        return;
      }

      const vehicle = await prisma.vehicle.findUnique({
        where: {
          vin: req.query.vin as string,
          ownerId: req.user.id,
        },
      });

      if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found!' });
        return;
      }

      const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
      const data = await axiosInstance.get(
        `/query/GetVehicle/${vehicle.vin}/${req.user.nic + appedix}`
      );

      res.status(200).json({
        vehicleOverviewData: vehicle,
        fullDetails: data.data.data,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({
        message: 'Internal server error. Could not fetch user vehicles.',
      });
      return;
    }
  }
);

router.get(
  '/get-vehicle-recent-data',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { vin } = req.query;

      if (!vin || typeof vin !== 'string') {
        res.status(400).json({ message: 'VIN is required.' });
        return;
      }

      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const vehicle = await prisma.vehicle.findUnique({
        where: { vin, ownerId: req.user.id },
      });

      if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found or does not belong to user.' });
        return;
      }

      const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
      const blockchainResponse = await axiosInstance.get(
        `/query/GetVehicle/${vin}/${req.user.nic + appedix}`
      );
      const fullDetails = blockchainResponse.data.data as VehicleBlockChainModel;

      fullDetails.interaction
        .sort(
          (a, b) => new Date(b.interaction_date).getTime() - new Date(a.interaction_date).getTime()
        )
        .slice(0, 5);

      res.status(200).json({
        message: 'Recent vehicle interaction data',
        fullDetails,
      });
      return;
    } catch (err: any) {
      console.error('Error :', err);
      res.status(500).json({ message: 'Internal server error', error: err.message });
      return;
    }
  }
);

router.get(
  '/get-vehicle-score',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { vin } = req.query;

      if (!vin || typeof vin !== 'string') {
        res.status(400).json({ message: 'VIN is required.' });
        return;
      }

      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const vehicle = await prisma.vehicle.findUnique({
        where: { vin, ownerId: req.user.id },
      });

      if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found or does not belong to user.' });
        return;
      }

      const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
      const blockchainResponse = await axiosInstance.get(
        `/query/GetVehicle/${vin}/${req.user.nic + appedix}`
      );
      const fullDetails = blockchainResponse.data.data as VehicleBlockChainModel;
      const score = calculateCompositeRating(fullDetails);

      // generatePDF('./src/templates/pdf/overview-certificate.html')

      res.status(200).json({
        message: 'vehicle score fetched successfully',
        vehicle,
        score,
      });
      return;
    } catch (error: any) {
      console.error('Error generating certificate:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
);

router.post(
  '/edit-vehicle-details',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Unauthorized. User not authenticated.' });
        return;
      }

      if (!req.headers['content-type']?.includes('multipart/form-data')) {
        res.status(400).json({ message: 'Invalid content type. Use multipart/form-data.' });
        return;
      }

      const vehicleEditSchema = z.object({
        vin: z.string().min(1, 'VIN is required'),
        manufacture: z.string().min(1, 'Manufacture is required'),
        model: z.string().min(1, 'Model is required'),
        year: z.string().min(1, 'Valid Year is required'),
        color: z.string().min(1, 'Color is required'),
        engineCapacity: z.string().min(1, 'Engine capacity is required'),
        province: z.string().min(1, 'Province is required'),
        fuelType: z.string().min(1, 'Fuel type is required'),
      });

      const parsedData = vehicleEditSchema.safeParse(req.body);

      if (!parsedData.success) {
        res.status(400).json({
          error: 'Validation failed',
          issues: parsedData.error.errors,
        });
        return;
      }

      const { vin, manufacture, model, year, color, engineCapacity, province, fuelType } = parsedData.data;

      const vehicle = await prisma.vehicle.findUnique({
        where: { vin, ownerId: req.user.id },
      });

      if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found or does not belong to user.' });
        return;
      }

      const file = req.files?.registrationCertificate as fileUpload.UploadedFile;

      if (!file) {
        res.status(400).json({ message: 'Vehicle Certification File is required' });
        return;
      }
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedMimeTypes.includes(file.mimetype || '')) {
        res
          .status(400)
          .json({ message: 'Invalid file type. Only JPEG, PNG, and GIF are allowed.' });
        return;
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        res.status(400).json({ message: 'File size exceeds 5MB limit.' });
        return;
      }

      const extractedText = await analyzeDocumentInMemory(file.data);
      console.log('extractedText:', extractedText);
      const data = await extractVehicleCertificateDetailedData(extractedText.content);

      if (data.vin !== vin) {
        res.status(400).json({ message: 'The extracted vehicle data does not match the provided VIN.' });
        return;
      }

      await prisma.vehicle.update({
        where: { vin, ownerId: req.user.id },
        data: {
          manufacture: data.manufacture === '' ? vehicle.manufacture : data.manufacture,
          model: data.model === '' ? vehicle.model : data.model,
          year: +data.year === 0 ? vehicle.year : +data.year,
        },
      });

      await axiosInstance.post('/invoke', {
        fn: 'UpdateVehicleData',
        args: [
          vin,
          JSON.stringify({
            manufacture: data.manufacture === '' ? vehicle.manufacture : data.manufacture,
            model: data.model === '' ? vehicle.model : data.model,
            year: +data.year === 0 ? vehicle.year : +data.year,
            color: data.color,
            engineCapacity: data.engineCapacity,
            province: data.province,
            fuelType: data.fuelType,
            initialMilage: vehicle.initialMilage,
          })
        ],
        username: req.user.nic + (process.env.ENV === 'dev' ? '_test' : ''),
      });

      res.status(200).json({
        message: 'Vehicle details updated successfully.',
      });
      return

    } catch (err) {
      console.error('Error in edit-vehicle-details:', err);
      res.status(500).json({ message: 'Internal server error', error: err });
      return;
    }
  }
);

export default router;
