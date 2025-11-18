import express from "express";
import prisma from "../config/prisma";
import mechanicAuthMiddleware from "../middleware/mechanic.middleware";
import { AuthenticatedMechanicRequest } from "../types";

const router = express.Router();

router.get("/disputes", mechanicAuthMiddleware(), async (req: AuthenticatedMechanicRequest, res) => {
  try {
    const mechanicId = req.user?.mechanicId;

    if (!mechanicId) {
      res.status(403).json({ success: false, message: "Unauthorized: mechanic id missing" });
      return;
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        orderBy: { createdAt: "desc" },
        where: {
          mechanicId: mechanicId,
        }
      }),
      prisma.dispute.count({
        where: {
          mechanicId: mechanicId,
        },
      }),
    ]);

    const vehicleIds = Array.from(new Set(disputes.map(d => d.vehicleId).filter(Boolean)));
    const ownerIds = Array.from(new Set(disputes.map(d => d.ownerId).filter(Boolean)));

    const [vehicles, owners] = await Promise.all([
      vehicleIds.length
        ? prisma.vehicle.findMany({
            where: { vehicleId: { in: vehicleIds } },
            select: { vehicleId: true, vin: true, manufacture: true, model: true, year: true },
          })
        : Promise.resolve([]),
      ownerIds.length
        ? prisma.vehicleOwner.findMany({
            where: { id: { in: ownerIds } },
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          })
        : Promise.resolve([]),
    ]);

    const vehicleMap = Object.fromEntries(vehicles.map(v => [v.vehicleId, v]));
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o]));

    const results = disputes.map(d => ({
      ...d,
      vehicle: d.vehicleId ? vehicleMap[d.vehicleId] || null : null,
      owner: d.ownerId ? ownerMap[d.ownerId] || null : null,
    }));

    res.status(200).json({
      success: true,
      data: results,
    });
    return;
  } catch (error) {
    console.error("Error fetching mechanic disputes:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});

export default router;