// import express from "express";
// import { z } from "zod";
// import prisma from "../config/prisma";
// import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
// import { AuthenticatedVehicleOwnerRequest } from "../types";

// const router = express.Router();

// // Create dispute about a service record.
// // POST /disputes/create
// // Body: { vehicleId: number, serviceRecordId: number, discription: string, diffs?: any[] }
// router.post("/create", vehicleOwnerAuthMiddleware(), async (req: AuthenticatedVehicleOwnerRequest, res) => {
//   try {
//     const payloadSchema = z.object({
//       vehicleId: z.preprocess((v) => Number(v), z.number().int().positive()),
//       serviceRecordId: z.preprocess((v) => Number(v), z.number().int().positive()),
//       discription: z.string().min(5),
//       diffs: z.array(z.any()).optional(),
//     });

//     const parsed = payloadSchema.safeParse(req.body);
//     if (!parsed.success) {
//       res.status(400).json({ success: false, error: "Validation failed", issues: parsed.error.format() });
//       return;
//     }

//     const { vehicleId, serviceRecordId, discription, diffs } = parsed.data;

//     if (!req.user?.id) {
//       res.status(403).json({ success: false, message: "Unauthorized" });
//       return;
//     }

//     // Verify vehicle exists and belongs to the authenticated owner
//     const vehicle = await prisma.vehicle.findUnique({
//       where: { vehicleId },
//       select: { vehicleId: true, ownerId: true },
//     });

//     if (!vehicle) {
//       res.status(404).json({ success: false, message: "Vehicle not found" });
//       return;
//     }

//     if (vehicle.ownerId !== req.user.id) {
//       res.status(403).json({ success: false, message: "You do not own this vehicle" });
//       return;
//     }

//     // Verify service record exists and is linked to the vehicle
//     const serviceRecord = await prisma.serviceRecord.findUnique({
//       where: { serviceRecordId },
//       select: { serviceRecordId: true, vehicleId: true },
//     });

//     if (!serviceRecord || serviceRecord.vehicleId !== vehicleId) {
//       res.status(404).json({ success: false, message: "Service record not found for this vehicle" });
//       return;
//     }

//     // Create dispute. Store diffs as JSON (stringify if your schema uses a string column).
//     // Adjust the 'diffs' assignment depending on your Prisma schema (Json vs String).
//     const dispute = await prisma.dispute.create({
//       data: {
//         vehicleId,
//         ownerId: req.user.id,
//         serviceRecordId,
//         discription,
//         status: "open",
//         // if your prisma field is Json, you can pass diffs directly; otherwise stringify:
//         diffs: diffs ?? null,
//         createdAt: new Date(),
//       },
//     });

//     res.status(201).json({ success: true, dispute });
//     return;
//   } catch (error) {
//     console.error("Error creating dispute:", error);
//     res.status(500).json({ success: false, message: "Internal server error" });
//     return;
//   }
// });

// export default router;