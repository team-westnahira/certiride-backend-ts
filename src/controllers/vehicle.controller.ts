import express, { Request, Response, Router } from "express";
import prisma from "../config/prisma";

const router: Router = express.Router();

router.post("/get-vehicle-details", async (req: Request, res: Response) => {
    const { vehicleId, ownerId } = req.body;

    // Validate required fields
    if (!vehicleId || !ownerId) {
        res.status(400).json({ message: "Vehicle ID and Owner ID are required." });
        return;
    }

    try {
        // Check if the vehicle exists
        const existingVehicle = await prisma.vehicle.findUnique({
            where: { vehicleId },
        });

        if (!existingVehicle) {
            res.status(404).json({ message: "Vehicle not found." });
            return;
        }

        // Check if the owner exists
        const existingOwner = await prisma.vehicleOwner.findUnique({
            where: { id: ownerId }, // Corrected the field to match the ownerId
        });

        if (!existingOwner) {
            res.status(404).json({ message: "Owner not found." });
            return;
        }

        // Return vehicle and owner details
        res.status(200).json({
            message: "Vehicle and owner found.",
            vehicle: existingVehicle,
            owner: existingOwner,
        });
        return

    } catch (error: any) {
        console.error("❌ Error retrieving vehicle details:", error);
        res.status(500).json({
            message: "Internal server error.",
            error: error.message,
        });
        return
    }
});

export default router;
