import express from "express";
import prisma from "../config/prisma";
import QRCode from "qrcode";
import jwt, { SignOptions, Secret } from "jsonwebtoken";
import { Request, Response } from "express";
import { AuthenticatedVehicleOwnerRequest } from "../types";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";

const router = express.Router();


router.post("/share-history/generate-qr", vehicleOwnerAuthMiddleware() , async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
  try {
    const vin = req.query.vin as string;

    if (!vin) {
      res.status(400).json({ success: false, message: "Invalid vin parameter" });
      return;
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { vin: vin , ownerId: req.user?.id },
      select: { vehicleId: true, vin: true, ownerId: true },
    });

    if (!vehicle) {
      res.status(404).json({ success: false, message: "Vehicle not found" });
      return;
    }

    if (ownerIdFromBody !== undefined && vehicle.ownerId !== ownerIdFromBody) {
      res.status(403).json({ success: false, message: "Owner does not own this vehicle" });
      return;
    }

    const secret = process.env.QR_JWT_SECRET;
    const expiresIn = (req.body.expiresIn as string) || "5h"; // default 5 hours

    const payload = {
      vehicleId: vehicle.vehicleId,
      vin: vehicle.vin,
      ownerId: vehicle.ownerId
    };

    const token = jwt.sign(payload, secret as Secret, { expiresIn } as SignOptions);

    // Generate QR code as token (no need of url)
    const qrData = await QRCode.toString(token, { type: "svg" });

    res.status(200).json({
      success: true,
      token,
      qrData,
    });
    return;
  } catch (error) {
    console.error("Error generating vehicle QR:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});

export default router;