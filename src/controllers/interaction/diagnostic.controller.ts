import express, { Response, Router } from "express";
import mechanicAuthMiddleware from "../../middleware/mechanic.middleware";
import { AuthenticatedMechanicRequest, DiagnosticReportData } from "../../types";
import { z } from "zod";
import prisma from "../../config/prisma";
import axiosInstance from "../../config/axios";
import { VehicleBlockChainModel } from "../../models/vehicle.model";
import { getInteraction } from "../../services/interaction.service";
import path from "path";
import fs from 'fs'
import fileUpload from "express-fileupload";
import analyzeDocument from "../../services/ocr.service";
import { extractDiagnosticReportData } from "../../services/ai.service";
import { DiagnosticReportBlockChainModel } from "../../models/interaction.model";
import { getDocumentHash } from '../../services/hash.service';

const router = Router();


router.post('/add-new-diagnostic-report' , mechanicAuthMiddleware() , async (req:AuthenticatedMechanicRequest , res:Response) => {

    if (!req.headers["content-type"]?.includes("multipart/form-data")) {
        res.status(400).json({ message: "Invalid content type. Use multipart/form-data." });
        return 
    }

    const newDiagnosticSchema = z.object({
        vehicle_id: z.string().min(1, "Vehicle ID is required"),
        interaction_id: z.string().min(1, "Interaction ID is required"),
        diagnostic_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: "Invalid date format",
        }),
        mileage: z.string().min(1, "Mileage is required"),
    });

    const parsedData = newDiagnosticSchema.safeParse(req.body);

    if (!parsedData.success) {
        res.status(400).json({
            error: "Validation failed",
            issues: parsedData.error.errors,
        });
        return
    }

    const { vehicle_id, interaction_id, diagnostic_date, mileage } = parsedData.data;

    if (!req.user) {
        res.status(401).json({ message: "Unauthorized. User not authenticated." });
        return
    }

    const vehicle = await prisma.vehicle.findUnique({
        where: { vin: vehicle_id },
    });

    if (!vehicle) {
        res.status(404).json({ message: "Vehicle not found" });
        return
    }

    const vehicleOwner = await prisma.vehicleOwner.findUnique({
        where: { id: vehicle.ownerId },
    });

    if (!vehicleOwner) {
        res.status(404).json({ message: "Vehicle owner not found" });
        return
    }

    const vehicleData = await axiosInstance.get(`/query/GetVehicle/${vehicle.vin}/${vehicleOwner.nic}`)
    const vehicleChainData = vehicleData.data.data as VehicleBlockChainModel;
    const interaction = await getInteraction(interaction_id, vehicleChainData)

    if (!interaction) {
        res.status(404).json({ message: "Interaction not found" });
        return
    }

    if(interaction.status !== 'open') {
        res.status(400).json({ message: "Interaction is not open" });
        return
    }

    if(new Date() < new Date(interaction.interaction_date)) {
        res.status(400).json({ message: "Diagnostic date cannot be in the future" });
        return
    }

    if(interaction.mechanic_id !== req.user.mechanicId+'') {
        res.status(403).json({ message: "You are not authorized to add diagnostic report to this interaction" });
        return
    }

    try{

        const file = req.files?.registrationCertificate as fileUpload.UploadedFile;
        
        if (!file) {
            res.status(400).json({ message: "Vehicle Certification File is required" });
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
    
        const uploadDir = path.join(__dirname, "../../uploads/vehicles/diagnostic-reports");
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
            const extractedData = await extractDiagnosticReportData(result.content)

            if(extractedData === null){
                res.status(400).json({ message: "Error extracting diagnostic data from the document." });
                return;
            }

            const diagnosticReport:DiagnosticReportData = JSON.parse(extractedData)
            
            if(diagnosticReport.authenticity_score < 0.7){
                res.status(400).json({ message: "The extracted diagnostic data is not authentic." });
                return;
            }

            const report:DiagnosticReportBlockChainModel = {
                report_id: interaction.interaction_id,
                vin: vehicle.vin,
                mechanic_id: interaction.mechanic_id,
                diagnostic_date: new Date(diagnostic_date).toISOString(),
                observations: "",
                system_checks: diagnosticReport.system_checks,
                attachments: []
            }

            try{

                await axiosInstance.post('/invoke' , {
                    'fn': 'InsertDiagnosticReport',
                    'args': [
                        interaction.interaction_id,
                        vehicle.vin,
                        JSON.stringify(report)
                    ],
                    username: vehicleOwner.nic,
                })

                res.status(200).json({ 
                    message: "Diagnostic report added successfully",
                    diagnosticReport
                });
                return

            }catch(err){
                fs.unlinkSync(filePath);
                console.log(err)
                res.status(500).json({ message: "Internal server error. Could not add diagnostic report." });
                return
            }

        })

    }catch(err){
        console.log(err)
        res.status(500).json({ message: "Internal server error. Could not add diagnostic report." });
        return
    }

})


export default router 