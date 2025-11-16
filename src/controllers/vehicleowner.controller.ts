import express from "express";
import prisma from "../config/prisma";
import QRCode from "qrcode";
import jwt, { SignOptions, Secret } from "jsonwebtoken";
import { Request, Response } from "express";
import { AuthenticatedMechanicRequest, AuthenticatedVehicleOwnerRequest } from "../types";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
import axiosInstance from "../config/axios";

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

    const secret = process.env.QR_JWT_SECRET;
    const expiresIn = (req.body.expiresIn as string) || "5h"; // default 5 hours

    const payload = {
      vehicleId: vehicle.vehicleId,
      vin: vehicle.vin,
      ownerId: vehicle.ownerId
    };

    const token = jwt.sign(payload, secret as Secret, { expiresIn } as SignOptions);

    // Generate QR code as token (no need of url)
    const qrData = await QRCode.toDataURL(token);

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




router.post("/share-history/validate", async (req: AuthenticatedMechanicRequest, res: Response) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      res.status(400).json({ success: false, message: "Missing token" });
      return;
    }

    const secret = process.env.QR_JWT_SECRET;
    if (!secret) {
      console.error("QR_JWT_SECRET is not set");
      res.status(500).json({ success: false, message: "Server misconfiguration" });
      return;
    }

    let payload: any;
    try {
      payload = jwt.verify(token, secret) as {
        vehicleId: number;
        vin: string;
        ownerId?: number | null;
        iat?: number;
        exp?: number;
      };
    } catch (err: any) {
      console.error("Token verification error:", err);
      const status = err.name === "TokenExpiredError" ? 401 : 400;
      res.status(status).json({ success: false, message: err.message || "Invalid token" });
      return;
    }

    if (!payload || !payload.vehicleId || !payload.vin) {
      res.status(400).json({ success: false, message: "Invalid token payload" });
      return;
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { vehicleId: payload.vehicleId },
      select: {
        vehicleId: true,
        vin: true,
        manufacture: true,
        model: true,
        year: true,
        initialMilage: true,
        ownerId: true,
      },
    });

    if (!vehicle) {
      res.status(404).json({ success: false, message: "Vehicle not found" });
      return;
    }

    if (vehicle.vin !== payload.vin || (payload.ownerId !== undefined && vehicle.ownerId !== payload.ownerId)) {
      res.status(403).json({ success: false, message: "Token does not match vehicle" });
      return;
    }

    const owner = await prisma.vehicleOwner.findUnique({
      where: { id: vehicle.ownerId! },
      select: { nic: true },
    });


    const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
    const data = await axiosInstance.get(
      `/query/GetVehicle/${vehicle.vin}/${owner?.nic + appedix}`
    );

    res.status(200).json({
      success: true,
      vehicle,
      history: data.data.data,
    });
    return;
  } catch (error) {
    console.error("Error validating QR token:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});

export default router;