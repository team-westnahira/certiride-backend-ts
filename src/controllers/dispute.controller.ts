// import express from "express";
// import { z } from "zod";
// import prisma from "../config/prisma";
// import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
// import { AuthenticatedVehicleOwnerRequest } from "../types";
// import axiosInstance from "../config/axios";

// const router = express.Router();

// router.post("/create", vehicleOwnerAuthMiddleware(), async (req: AuthenticatedVehicleOwnerRequest, res) => {
//   try {
//     const payloadSchema = z.object({
//       vehicleId: z.preprocess((v) => Number(v), z.number().int().positive()),
//       serviceRecordId: z.preprocess((v) => Number(v), z.number().int().positive()),
//       interactionId: z.string().min(1),
//       discription: z.string().min(5),
//       diffs: z.array(z.any()).optional(),
//     });

//     const parsed = payloadSchema.safeParse(req.body);
//     if (!parsed.success) {
//       res.status(400).json({ success: false, error: "Validation failed", issues: parsed.error.format() });
//       return;
//     }

//     const { vehicleId, serviceRecordId, interactionId, discription, diffs } = parsed.data;

//     if (!req.user?.id) {
//       res.status(403).json({ success: false, message: "Unauthorized" });
//       return;
//     }

//     const vehicle = await prisma.vehicle.findUnique({
//       where: { vehicleId },
//     });

//     if (!vehicle) {
//       res.status(404).json({ success: false, message: "Vehicle not found" });
//       return;
//     }

//     if (vehicle.ownerId !== req.user.id) {
//       res.status(403).json({ success: false, message: "You do not own this vehicle" });
//       return;
//     }

//     const owner = await prisma.vehicleOwner.findUnique({
//       where: { id: req.user.id },
//     });

//     const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
//     const blockchain_data = await axiosInstance.get(
//       `/query/GetVehicle/${vehicle?.vin}/${owner?.nic + appedix}`
//     );

//     const dispute = await prisma.dispute.create({
//       data: {
//         vehicleId,
//         ownerId: req.user.id,
//         // serviceRecordId,
//         discription,
//         status: true,
//         // diffs: diffs ?? null,
//         createdAt: new Date(),
//       },
//     });

//     res.status(201).json({ success: true });
//     return;
//   } catch (error) {
//     console.error("Error creating dispute:", error);
//     res.status(500).json({ success: false, message: "Internal server error" });
//     return;
//   }
// });

// export default router;