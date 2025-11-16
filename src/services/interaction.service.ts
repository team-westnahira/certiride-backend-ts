import path from "path";
import axiosInstance from "../config/axios";
import prisma from "../config/prisma";
import { VehicleBlockChainModel } from "../models/vehicle.model";
import { AuthenticatedMechanicRequest, AuthenticatedVehicleOwnerRequest } from "../types";
import fileUpload from "express-fileupload";
import fs from "fs";
import { getDocumentHash } from "./hash.service";
import dotenv from 'dotenv';
import { VehicleInteractionBlockChainModel } from "../models/interaction.model";
dotenv.config();
const appendix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';

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

    const vehicleData = await axiosInstance.get(`/query/GetVehicle/${vehicle.vin}/${vehicleOwner.nic + appendix}`)
    const vehicleChainData = vehicleData.data.data as VehicleBlockChainModel;
    const interaction = await getInteraction(interactionId, vehicleChainData)

    if (!interaction) {
        throw new Error("Interaction not found");
    }

    if(interaction.status !== 'open') {
        throw new Error("Interaction is not open");
    }

    // if(new Date() < new Date(interaction.interaction_date)) {
    //     throw new Error("inteaction date cannot be in the future");
    // }

    if(interaction.mechanic_id !== req.user.mechanicId+'') {
        throw new Error("You are not authorized to add diagnostic report to this interaction");
    }

    return {interaction , vehicleChainData , vehicleOwner}
}

export const commonInteractionCheckerForVehicleOwner = async(req:AuthenticatedVehicleOwnerRequest, interactionId: string , vehicle_id:string) => {
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

    const vehicleData = await axiosInstance.get(`/query/GetVehicle/${vehicle.vin}/${vehicleOwner.nic + appendix}`)
    console.log('vehicle : = ' , vehicleData)
    const vehicleChainData = vehicleData.data.data as VehicleBlockChainModel;
    const interaction = await getInteraction(interactionId, vehicleChainData)

    if (!interaction) {
        throw new Error("Interaction not found");
    }

    if(interaction.status !== 'open') {
        throw new Error("Interaction is not open");
    }

    // if(new Date() < new Date(interaction.interaction_date)) {
    //     throw new Error("Interaction date cannot be in the future");
    // }

    return {interaction , vehicleChainData , vehicleOwner}
}

export const commonFileUploadChecker = async (file: fileUpload.UploadedFile , uploadDir:string) => {
    if (!file) {
        console.log('file required')
        throw new Error("File is required");
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedMimeTypes.includes(file.mimetype || "")) {
        console.log('type error')
        throw new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed.");
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        console.log('size exceed')
        throw new Error("File size exceeds 5MB limit.");
    }

    // const uploadDir = path.join(__dirname, "../../uploads/vehicles/diagnostic-reports");
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


export const isServiceRecordOnTime = (interactionList: VehicleInteractionBlockChainModel[], newServiceDate: string, newServiceMileage: number): boolean => {
    
    if (interactionList.length === 0) {
        return true;
    }

    const sortedInteractions = [...interactionList].sort((a, b) => new Date(a.interaction_date).getTime() - new Date(b.interaction_date).getTime());
    const lastInteraction = sortedInteractions[sortedInteractions.length - 1];
    const lastServiceRecord = [...sortedInteractions].reverse().find(interaction => interaction.service_record != null);
    const lastServiceDate = lastServiceRecord ? lastServiceRecord.interaction_date : lastInteraction.interaction_date;
    const lastServiceMileage = lastInteraction.mileage;

    if (new Date(newServiceDate) < new Date(lastServiceDate)) {
        return false;
    }

    if (newServiceMileage < lastServiceMileage) {
        return false;
    }

    if (newServiceMileage - lastServiceMileage > 10000) {
        return false;
    }

    const lastServiceYear = new Date(lastServiceDate).getFullYear();
    const newServiceYear = new Date(newServiceDate).getFullYear();
    if (newServiceYear - lastServiceYear > 1) {
        return false;
    }

    return true;
}