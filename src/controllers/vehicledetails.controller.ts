import express, { Request, Response, Router } from "express";
import prisma from "../config/prisma";

const router: Router = express.Router();

router.post("/add-new-vehicle", async (req: Request, res: Response) => {
    const { vehicleId, ownerId, vehicleDetails } = req.body;

    // Validate required fields
    if (!vehicleId || !ownerId || !vehicleDetails) {
        
        res.status(400).json({ message: "All fields are required." });
        return
    }

    try {
        // Check if the vehicle already exists
        const existingVehicle = await prisma.vehicle.findUnique({
            where: { vehicleId }, // Ensure vehicleId is unique in your Prisma schema
        });

        if (existingVehicle) {
            res.status(409).json({ message: "Vehicle is already registered." });
            return
        }

        // Register the new vehicle
        const newVehicle = await prisma.vehicle.create({
            data: {
                vehicleId,
                ownerId,
                ...vehicleDetails, // Spread operator for additional vehicle details
            },
        });

        res.status(201).json({
            message: "Vehicle registered successfully.",
            vehicle: newVehicle,
        });
        return

    } catch (error: any) {
        console.error("❌ Error registering vehicle:", error);
        res.status(500).json({
            message: "Internal server error. Could not register vehicle.",
            error: error.message,
        });
        return
    }
});

export default router;
