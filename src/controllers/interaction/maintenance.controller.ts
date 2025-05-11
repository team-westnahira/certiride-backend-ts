import express, { Response, Router } from "express";
import mechanicAuthMiddleware from "../../middleware/mechanic.middleware";
import { AuthenticatedMechanicRequest, DiagnosticReportData, MaintananceChecklistData } from "../../types";
import { z } from "zod";
import prisma from "../../config/prisma";
import axiosInstance from "../../config/axios";
import { VehicleBlockChainModel } from "../../models/vehicle.model";
import { commonHashChecker, commonInteractionChecker, getInteraction } from "../../services/interaction.service";
import path from "path";
import fs from 'fs'
import fileUpload from "express-fileupload";
import analyzeDocument from "../../services/ocr.service";
import { extractDiagnosticReportData, extractMaintenanceChecklistData } from "../../services/ai.service";
import { MaintenanceChecklist, VehicleInteractionBlockChainModel } from "../../models/interaction.model";
import { getDocumentHash } from '../../services/hash.service';
import { VehicleOwner } from "@prisma/client";
import { randomUUID } from "crypto";

const router = Router();


router.post('/add-maintenance-checklist' , mechanicAuthMiddleware() , async (req:AuthenticatedMechanicRequest , res:Response) => {

    if (!req.headers["content-type"]?.includes("multipart/form-data")) {
        res.status(400).json({ message: "Invalid content type. Use multipart/form-data." });
        return
    }

    const scheme = z.object({
        vehicle_id: z.string().min(1, "Vehicle ID is required"),
        interaction_id: z.string().min(1, "Interaction ID is required"),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: "Invalid date format",
        }),
        mileage: z.string().min(1, "Mileage is required"),
    });

    const parsedData = scheme.safeParse(req.body);

    if (!parsedData.success) {
        res.status(400).json({
            error: "Validation failed",
            issues: parsedData.error.errors,
        });
        return
    }

    const { vehicle_id, interaction_id, date, mileage } = parsedData.data;

    let data: {
        interaction: VehicleInteractionBlockChainModel;
        vehicleChainData: VehicleBlockChainModel;
        vehicleOwner: VehicleOwner
    };

    try{
        data = await commonInteractionChecker(req , interaction_id , vehicle_id)
    }catch(err){
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(400).json({ message: errorMessage });
        return
    }

    try{

        const file = req.files?.checklistFile as fileUpload.UploadedFile;
        
        if (!file) {
            res.status(400).json({ message: "Checklist File is required" });
            return
        }

        const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
        if (!allowedMimeTypes.includes(file.mimetype || "")) {
            res.status(400).json({ message: "Invalid file type. Only JPEG, PNG, and GIF are allowed." });
            return 
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            res.status(400).json({ message: "File size exceeds 5MB limit." });
            return
        }
    
        const uploadDir = path.join(__dirname, "../../../uploads/vehicles/checklist-reports");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
        file.mv(filePath, async (err:any) => {
                
            if (err) {
                res.status(500).json({ message: "Error saving file", error: err });
                return
            }

            const result = await analyzeDocument(filePath);

            const hash = getDocumentHash(result.content)
            try{
                await commonHashChecker(result , filePath)
            }catch(err){
                const errorMessage = err instanceof Error ? err.message : String(err);
                res.status(400).json({ 
                    message: errorMessage, 
                });
                return
            }

            const extractedData = await extractMaintenanceChecklistData(result.content)

            if(extractedData === null){
                await prisma.fileHash.delete({
                    where: { hash: hash },
                });
                res.status(400).json({ message: "Error extracting checklist data from the document." });
                return;
            }

            const checkList:MaintananceChecklistData = JSON.parse(extractedData)
            
            if(checkList.authenticity_score < 0.7){
                await prisma.fileHash.delete({
                    where: { hash: hash },
                });
                res.status(400).json({ message: "The extracted checklist data is not authentic." });
                return;
            }

            const report:MaintenanceChecklist = {
                checklist_id: randomUUID(),
                vehicle_id: data.interaction.vehicle_id,
                mechanic_id: data.interaction.mechanic_id,
                date_of_inspection: checkList.inspection_date,
                vehicle_power_type: checkList.vehicle_power_type,
                odometer_reading: +checkList.meter_reading,
                next_service_mileage: 0,
                items: checkList.items,
                service_type: "",
                remarks: "",
                attachments: []
            }

            try{

                await axiosInstance.post('/invoke' , {
                    'fn': 'InsertMaintenanceCheckListReport',
                    'args': [
                        data.interaction.interaction_id,
                        data.vehicleChainData.vin,
                        JSON.stringify(report)
                    ],
                    username: data.vehicleOwner.nic,
                })

                res.status(200).json({ 
                    message: "checklist report added successfully",
                    report
                });
                return

            }catch(err){
                await prisma.fileHash.delete({
                    where: { hash: hash },
                });
                fs.unlinkSync(filePath);
                console.log(err)
                res.status(500).json({ message: "Internal server error. Could not add checklist report." });
                return
            }

        })

    }catch(err){
        console.log(err)
        res.status(500).json({ message: "Internal server error. Could not add checklist report." });
        return
    }

})


export default router 