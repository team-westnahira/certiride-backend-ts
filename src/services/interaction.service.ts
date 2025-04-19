import path from "path";
import axiosInstance from "../config/axios";
import prisma from "../config/prisma";
import { VehicleBlockChainModel } from "../models/vehicle.model";
import { AuthenticatedMechanicRequest } from "../types";
import fileUpload from "express-fileupload";
import fs from "fs";
import { getDocumentHash } from "./hash.service";

export const isInteractionExists = async (interactionId: string, vehicle: VehicleBlockChainModel) => {
    const interactionExists = vehicle.interaction.some(interaction => interaction.interaction_id === interactionId)

    if (!interactionExists) {
        return false
    }

    return true
}

export const getInteraction = async (interacionId: string , vehicle: VehicleBlockChainModel) => {
    const interaction = vehicle.interaction.find(interaction => interaction.interaction_id === interacionId)

    if (!interaction) {
        return null
    }

    return interaction
}

export const getLatestInteraction = async (vehicle: VehicleBlockChainModel) => {
    const latestInteraction = vehicle.interaction[vehicle.interaction.length - 1]

    if (!latestInteraction) {
        return null
    }

    return latestInteraction
}

export const commonInteractionChecker = async (req:AuthenticatedMechanicRequest, interactionId: string , vehicle_id:string) => {
    
    if (!req.user) {
        throw new Error("Unauthorized. User not authenticated.");
    }

    const vehicle = await prisma.vehicle.findUnique({
        where: { vin: vehicle_id },
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    const vehicleOwner = await prisma.vehicleOwner.findUnique({
        where: { id: vehicle.ownerId },
    });

    if (!vehicleOwner) {
        throw new Error("Vehicle owner not found");
    }

    const vehicleData = await axiosInstance.get(`/query/GetVehicle/${vehicle.vin}/${vehicleOwner.nic}`)
    const vehicleChainData = vehicleData.data.data as VehicleBlockChainModel;
    const interaction = await getInteraction(interactionId, vehicleChainData)

    if (!interaction) {
        throw new Error("Interaction not found");
    }

    if(interaction.status !== 'open') {
        throw new Error("Interaction is not open");
    }

    if(new Date() < new Date(interaction.interaction_date)) {
        throw new Error("Diagnostic date cannot be in the future");
    }

    if(interaction.mechanic_id !== req.user.mechanicId+'') {
        throw new Error("You are not authorized to add diagnostic report to this interaction");
    }

    return {interaction , vehicleChainData , vehicleOwner}
}

export const commonFileUploadChecker = async (file: fileUpload.UploadedFile) => {
    if (!file) {
        throw new Error("File is required");
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedMimeTypes.includes(file.mimetype || "")) {
        throw new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed.");
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error("File size exceeds 5MB limit.");
    }

    const uploadDir = path.join(__dirname, "../../uploads/vehicles/diagnostic-reports");
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, `${Date.now()}-${file.name}`);
    return filePath
}

export const commonHashChecker = async (result:any , filePath: string) => {

    const fileHash = getDocumentHash(result.content)
    
    const existingFileHash = await prisma.fileHash.findUnique({
        where: { hash: fileHash },
    });

    if (existingFileHash) {
        fs.unlinkSync(filePath);
        throw new Error("File hash already exists.");
    }

    await prisma.fileHash.create({
        data: {
            hash: fileHash,
            fileName: filePath,
            uploadedAt: new Date(),
        }
    })
    
}