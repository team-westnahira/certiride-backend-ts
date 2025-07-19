import express, { Response } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedVehicleOwnerRequest } from '../types';
import path from 'path';
import { z } from 'zod';
import vehicleOwnerAuthMiddleware from '../middleware/vehicleOwner.middleware';
import analyzeDocument from '../services/ocr.service';
import fs from 'fs';
import axiosInstance from '../config/axios';
import dotenv from 'dotenv';
import { AttachmentBlockChainModel } from '../models/attachment.model';
import { randomUUID } from 'crypto';
import fileUpload from 'express-fileupload';
import { commonFileUploadChecker, commonHashChecker } from '../services/interaction.service';
import { getDocumentHash } from '../services/hash.service';
import { OwnershipTransfer, VehicleBlockChainModel } from '../models/vehicle.model';
dotenv.config();

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/documents');
const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';

router.post('/transfer-ownership-init', vehicleOwnerAuthMiddleware() ,async (req:AuthenticatedVehicleOwnerRequest, res) => {

    if (!req.headers["content-type"]?.includes("multipart/form-data")) {
        res.status(400).json({ message: "Invalid content type. Use multipart/form-data." });
        return 
    }
    
    const transferOwnershipSchema = z.object({
        vin: z.string().min(1, 'VIN is required'),
        newOwnerEmail: z.string().email('Invalid email format'),
    });

    let filePath = '';
    const file = req.files?.proof as fileUpload.UploadedFile;

    try{
        filePath = await commonFileUploadChecker(file)
    }catch(err){
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(400).json({ message: errorMessage });
        return
    }

    file.mv(filePath, async (err:any) => {

        if (err) {
            res.status(500).json({ message: "Error saving file", error: err });
            return
        }

        let hash = '';

        try {
            const parsedData = transferOwnershipSchema.safeParse(req.body);
            
            if (!parsedData.success) {
                res.status(400).json({
                    error: "Validation failed",
                    issues: parsedData.error.errors,
                });
                return
            }
    
            const { vin, newOwnerEmail } = parsedData.data;
    
            const vehicle = await prisma.vehicle.findUnique({
                where: { vin , ownerId: req.user?.id },
            });
    
            if (!vehicle) { 
                res.status(404).json({ error: 'Vehicle not found' });
                return;
            }
    
            const newOwner = await prisma.vehicleOwner.findUnique({
                where: { email: newOwnerEmail },
            });
    
            if (!newOwner) {
                res.status(404).json({ error: 'New owner not found on certiride chain' });
                return;
            }


            const result = await analyzeDocument(filePath)
            hash = getDocumentHash(result.content)
            
            try{
                await commonHashChecker(result , filePath)
            }catch(err){
                const errorMessage = err instanceof Error ? err.message : String(err);
                res.status(400).json({ 
                    message: errorMessage, 
                });
                return
            }

            const blockchainResponse = await axiosInstance.get(
                `/query/GetVehicle/${vin}/${req.user?.nic + appedix}`
            );
            const fullData = blockchainResponse.data.data as VehicleBlockChainModel;

            for(let i = 0; i < fullData.owner_history.length; i++) {
                const transfer = fullData.owner_history[i];
                if (transfer.status === 'pending') {
                    await prisma.fileHash.delete({
                        where: { hash: hash },
                    });
                    res.status(400).json({ error: 'Already exists a pending ownership transfer for this vehicle' });
                    return;
                }
            }

            const attachment:AttachmentBlockChainModel[] = [{
                attachment_id: randomUUID(),
                attachment_name: 'ownership_transfer_request',
                file_name: path.join(uploadDir, `${Date.now()}-${file.name}`),
                file_cid: 'cid_placeholder',
                uploaded_date: new Date().toISOString(),
            }]
    
            // ivoke the transfer ownership blockchain function
            await axiosInstance.post('/invoke', {
                fn: 'InitiateTransferOwnership',
                args: [vehicle.vin, 'insert', req.user?.id , newOwner.id , new Date().toISOString() , JSON.stringify(attachment) , randomUUID()],
                username: req.user?.nic + appedix,
            });
    
            res.status(200).json({
                message: 'Ownership transfer initiated successfully',
                vehicle: {
                    vin: vehicle.vin,
                    currentOwner: req.user?.email,
                    newOwner: newOwnerEmail,
                },
            });
            return
        } catch (error) {
            await prisma.fileHash.delete({
                where: { hash: hash },
            });
            console.error('Error transferring ownership:', error);
            res.status(500).json({ error: 'Internal server error' });
            return 
        }

    });


});


router.post('/transfer-ownership-response', vehicleOwnerAuthMiddleware(), async (req:AuthenticatedVehicleOwnerRequest, res: Response) => {
    const transferOwnershipResponseSchema = z.object({
        transferId: z.string().min(1, 'Transfer ID is required'),
        status: z.enum(['approved', 'rejected']),
        remarks: z.string().optional(),
    });

    try {
        const parsedData = transferOwnershipResponseSchema.safeParse(req.body);
        
        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors,
            });
            return
        }

        const { transferId, status, remarks } = parsedData.data;

        let blockchainResponse:any;

        try{
            blockchainResponse = await axiosInstance.post(`/advanceQuery`, {
                fn: "GetOwnershipInvitesByUser",
                args: [req.user?.id],
                username: req.user?.nic + appedix,
            })
        }catch (error) {
            console.error('Error fetching ownership invites:', error);  
            res.status(400).json({ error: 'Something went wrong' });
            return
        }

        const fullData = blockchainResponse.data.data as OwnershipTransfer[];
        const transferInvite = fullData.find(transfer => transfer.transfer_id === transferId);

        if (fullData.length === 0) {
            res.status(404).json({ error: 'No transfer ownership invites' });
            return;
        }

        if(!transferInvite) {
            res.status(404).json({ error: 'Ownership transfer invite not found' });
            return;
        }

        if (transferInvite.to_owner_id !== req.user?.id+'') {
            res.status(403).json({ error: 'You are not authorized to respond to this ownership transfer' });
            return;
        }

        if (transferInvite.status !== 'pending') {
            res.status(400).json({ error: 'Ownership transfer is not in pending state' });
            return;
        }

        await axiosInstance.post('/invoke', {
            fn: 'AcceptRejectTransferOwnership',
            args: [transferInvite.vin , req.user?.id , transferId, status, new Date().toISOString()],
            username: req.user?.nic + appedix,
        });

        if (status === 'approved') {
            await prisma.vehicle.update({
                where: { vin: transferInvite.vin },
                data: {
                    ownerId: req.user?.id,
                },
            })
        }
        
        res.status(200).json({ message: 'Ownership transfer response recorded successfully' });
    } catch (error) {
        console.error('Error responding to ownership transfer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


export default router;