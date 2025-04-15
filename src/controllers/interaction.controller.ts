import express, { Request, Response, Router } from "express";
import prisma from "../config/prisma";
import { Mechanic } from "@prisma/client";
import { z } from "zod";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
import axiosInstance from "../config/axios";
import { VehicleBlockChainModel } from "../models/vehicle.model";
import { randomUUID } from "crypto";

const router = Router();

interface AuthenticatedRequest extends Request {
    user?: Mechanic
}

router.post('/add-new-interaction' , vehicleOwnerAuthMiddleware() , async (req:AuthenticatedRequest , res:Response) => {

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
        mechanic_id: req.user?.mechanicId,
        interaction_date,
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
        data: parsedData.data,
        uuid
    });
    return

})







export default router