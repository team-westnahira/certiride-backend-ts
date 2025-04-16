import express, { Request, Response, Router } from "express";
import prisma from "../../config/prisma";
import { Mechanic } from "@prisma/client";
import { z } from "zod";
import axiosInstance from "../../config/axios";
import { VehicleBlockChainModel } from "../../models/vehicle.model";
import { randomUUID } from "crypto";
import mechanicAuthMiddleware from "../../middleware/mechanic.middleware";
import vehicleOwnerAuthMiddleware from "../../middleware/vehicleOwner.middleware";
import { AuthenticatedMechanicRequest, AuthenticatedVehicleOwnerRequest } from "../../types";

const router = Router();

router.post('/add-new-interaction' , mechanicAuthMiddleware() , async (req:AuthenticatedMechanicRequest , res:Response) => {

    const newInteractionSchema = z.object({
        vehicle_id: z.number().min(1, "Vehicle ID is required"),
        interaction_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: "Invalid date format",
        }),
        interaction_type: z.enum(["service", "trubleshoot", "accident", "diagnostic"]),
        mileage: z.number().min(5000, "Mileage is required"),
    });

    const parsedData = newInteractionSchema.safeParse(req.body);

    if (!parsedData.success) {
        res.status(400).json({
            error: "Validation failed",
            issues: parsedData.error.errors,
        });
        return
    }

    const { vehicle_id, interaction_date, interaction_type, mileage } = parsedData.data;

    const vehicle = await prisma.vehicle.findUnique({
        where: { vehicleId: vehicle_id },
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

    // mileage check to esnure that the mileage is not less than the previous one
    const vehicleChainData = await axiosInstance.get(`/query/GetVehicle/${vehicle.vin}/${vehicleOwner.nic}`)
    const vehicleData = vehicleChainData.data.data as VehicleBlockChainModel;

    const latestVehicleInteractionData = vehicleData.interaction[vehicleData.interaction.length - 1];

    if (latestVehicleInteractionData && latestVehicleInteractionData.mileage > mileage) {
        res.status(400).json({ message: "Mileage cannot be less than the previous one" });
        return
    }

    if ( new Date(interaction_date) > new Date()) {
        res.status(400).json({ message: "Interaction date cannot be in the future" });
        return
    }

    if(latestVehicleInteractionData && latestVehicleInteractionData.status !== "closed"){
        res.status(400).json({ message: "Previous interaction is not closed" });
        return
    }

    const uuid = randomUUID()

    const interactionData = {
        interaction_id: uuid,
        vehicle_id: vehicle.vin,
        mechanic_id: req.user?.mechanicId+'',
        interaction_date: new Date(interaction_date),
        interaction_type,
        mileage,
        status: "open",
        service_record: null,
        accident_repair_record: null,
        troubleshoot_repair_record: null,
        maintenance_checklist: null,
        diagnostic_report: null,
        invoice: null,
        additional_info: {},
        created_at: new Date(),
    };

    await axiosInstance.post('/invoke' , {
        'fn': 'RecordInteraction',
        'args': [
            vehicle.vin,
            JSON.stringify(interactionData)
        ],
        username: vehicleOwner.nic,
    })

    res.status(200).json({
        message: "Interaction data is valid",
        interactionId: uuid,
        userId: vehicleOwner.id,
        vehicleId: vehicle.vin,
    });

    return

})

router.get('/close-interaction' , mechanicAuthMiddleware() , async (req:AuthenticatedMechanicRequest , res:Response) => {

    const vehicleId = req.query.vehicle_id as string
    const interactionId = req.query.interaction_id as string

    if (!vehicleId || !interactionId) {
        res.status(400).json({ message: "Vehicle ID and Interaction ID are required" });
        return
    }

    if(!req.user){
        res.status(401).json({ message: "Unauthorized. User not authenticated." });
        return 
    }

    const vehicle = await prisma.vehicle.findUnique({
        where: { vin: vehicleId },
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
    const interaction = vehicleChainData.interaction.find(interaction => interaction.interaction_id === interactionId)

    if (!interaction) {
        res.status(404).json({ message: "Interaction not found" });
        return
    }

    if (interaction.status !== "open") {
        res.status(400).json({ message: "Interaction is already closed" });
        return
    }

    if (+interaction.mechanic_id !== req.user.mechanicId) {
        res.status(400).json({ message: "You cannot close this interaction" });
        return
    }

    await axiosInstance.post('/invoke' , {
        'fn': 'CloseInteraction',
        'args': [
            vehicle.vin,
            interaction.interaction_id
        ],
        username: vehicleOwner.nic,
    })

    res.status(200).json({
        message: "Interaction closed successfully",
        interactionId: interactionId,
        userId: vehicleOwner.id,
        vehicleId: vehicle.vin,
    });
    return

})

router.get('/get-interaction' , vehicleOwnerAuthMiddleware() , async (req:AuthenticatedVehicleOwnerRequest , res:Response) => {

    const vehicleId = req.query.vehicle_id as string
    const interactionId = req.query.interaction_id as string

    if (!vehicleId || !interactionId) {
        res.status(400).json({ message: "Vehicle ID and Interaction ID are required" });
        return
    }

    if(!req.user){
        res.status(401).json({ message: "Unauthorized. User not authenticated." });
        return 
    }

    const vehicle = await prisma.vehicle.findUnique({
        where: { vin: vehicleId , ownerId: req.user.id },
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
    const interaction = vehicleChainData.interaction.find(interaction => interaction.interaction_id === interactionId)

    if (!interaction) {
        res.status(404).json({ message: "Interaction not found" });
        return
    }

    if (+vehicle.ownerId !== req.user.id) {
        res.status(400).json({ message: "You cannot view this interaction" });
        return
    }

    res.status(200).json({
        interaction,
        userId: vehicleOwner.id,
        vehicleId: vehicle.vin,
    });
    return


})


export default router 