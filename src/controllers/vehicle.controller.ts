import express, { Request, Response, Router } from "express";
import prisma from "../config/prisma";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
import { z } from "zod";
import { VehicleOwner } from "@prisma/client";
import fileUpload from "express-fileupload";
import path from "path";
import fs from "fs";
import { extractVehicleCertificateDocumentData } from "../services/ai.service";
import analyzeDocument from "../services/ocr.service";
import { VehicleRegistrationData } from "../types";
import axiosInstance from "../config/axios";
const router: Router = express.Router();

interface AuthenticatedRequest extends Request {
    user?: VehicleOwner;
}

router.post("/add-new-vehicle" , vehicleOwnerAuthMiddleware(), async (req: AuthenticatedRequest, res: Response) => {

    try {

        if (!req.headers["content-type"]?.includes("multipart/form-data")) {
            res.status(400).json({ message: "Invalid content type. Use multipart/form-data." });
            return 
        }

        const vehicleOwnerRegisterSchema = z.object({
            vin: z.string().min(1, "VIN is required"),
            manufacture: z.string().min(1, "Manufacture is required"),
            model: z.string().min(1, "Model is required"),
            year: z.string().min(1, "Valid Year is required"),
            color: z.string().min(1, "Color is required"),
            engineCapacity: z.string().min(1, "Engine capacity is required"),
            province: z.string().min(1, "Province is required"),
            fuelType: z.string().min(1, "Fuel type is required"),
            initialMilage: z.string().min(1, "Initial Milage is required")
        });

        const parsedData = vehicleOwnerRegisterSchema.safeParse(req.body);

        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors,
            });
            return
        }

        const { vin, manufacture, model, year, color, engineCapacity, province, fuelType , initialMilage } = parsedData.data;

        if (!req.user) {
            res.status(401).json({ message: "Unauthorized. User not authenticated." });
            return 
        }

        const existingVehicle = await prisma.vehicle.findUnique({ where: { vin } });

        if (existingVehicle) {
            res.status(409).json({ message: "Vehicle is already registered." });   
        }

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

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            res.status(400).json({ message: "File size exceeds 5MB limit." });
            return
        }
    
        const uploadDir = path.join(__dirname, "../../uploads/vehicles/certificates");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
        file.mv(filePath, async (err) => {
            
            if (err) {
                res.status(500).json({ message: "Error saving file", error: err });
                return
            }

            const result = await analyzeDocument(filePath)
            const extractedData = await extractVehicleCertificateDocumentData(result.content)

            if(extractedData === null){
                res.status(400).json({ message: "Error extracting vehicle data from the document." });
                return;
            }

            const vehicleCertificate: VehicleRegistrationData = JSON.parse(extractedData);
            
            if(vehicleCertificate.authenticity_score < 0.8){
                res.status(400).json({ message: "The extracted vehicle data is not authentic." });
                return;
            }

            if (vehicleCertificate.chassis_number !== vin){
                res.status(400).json({ message: "The extracted vehicle data does not match the provided VIN." });
                return;
            }

            const newVehicle = await prisma.vehicle.create({
                data: {
                    vin,
                    manufacture,
                    ownerId: req.user?.id || 0,
                    model,
                    year: +year,
                    initialMilage: +initialMilage
                },
            });

            try{
                await axiosInstance.post('/invoke' , {
                    fn: 'createVehicle',
                    args: [vehicleCertificate.chassis_number , req.user?.id , newVehicle.manufacture , newVehicle.model, newVehicle.year, color, engineCapacity, province, fuelType]
                })

            }catch(err){
                res.status(500).json({ message: "Error invoking chaincode. Could not create vehicle asset.", error: err });
                return;
            }

            res.status(201).json({
                message: "Vehicle registered successfully.",
                vehicle: newVehicle
            });
    
            return

        });

    } catch (error: any) {

        res.status(500).json({
            message: "Internal server error. Could not register vehicle.",
            error: error.message,
        });
        
        return

    }
    
});


export default router;
