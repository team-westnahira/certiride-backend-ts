import express from "express";
import { z } from "zod";
import prisma from "../config/prisma";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
import { AuthenticatedAdminRequest, AuthenticatedMechanicRequest, AuthenticatedVehicleOwnerRequest } from "../types";
import axiosInstance from "../config/axios";
import { VehicleBlockChainModel } from "../models/vehicle.model";
import { VehicleInteractionBlockChainModel } from "../models/interaction.model";
import adminAuthMiddleware from "../middleware/admin.middleware";
import mechanicAuthMiddleware from "../middleware/mechanic.middleware";

const router = express.Router();

router.post("/create", vehicleOwnerAuthMiddleware(), async (req: AuthenticatedVehicleOwnerRequest, res) => {
  try {
    const payloadSchema = z.object({
      vehicleId: z.preprocess((v) => Number(v), z.number().int().positive()),
      serviceRecordId: z.string().min(1),
      interactionId: z.string().min(1),
      discription: z.string().min(5),
      diffs: z.array(z.any()).optional(),
    });

    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Validation failed", issues: parsed.error.format() });
      return;
    }

    const { vehicleId, serviceRecordId, interactionId, discription, diffs } = parsed.data;

    if (!req.user?.id) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { vehicleId },
    });

    if (!vehicle) {
      res.status(404).json({ success: false, message: "Vehicle not found" });
      return;
    }

    if (vehicle.ownerId !== req.user.id) {
      res.status(403).json({ success: false, message: "You do not own this vehicle" });
      return;
    }

    const owner = await prisma.vehicleOwner.findUnique({
      where: { id: req.user.id },
    });

    const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
    const blockchain_data = await axiosInstance.get(
      `/query/GetVehicle/${vehicle?.vin}/${owner?.nic + appedix}`
    );

    const fullDetails = blockchain_data.data.data as VehicleBlockChainModel;
    let interactionData: VehicleInteractionBlockChainModel | null = null;

    for (let i = 0; i < fullDetails.interaction.length; i++) {
      if (fullDetails.interaction[i].interaction_id === interactionId) {
        interactionData = fullDetails.interaction[i];
      }
    }

    if (!interactionData) {
      res.status(404).json({ success: false, message: "Interaction not found in blockchain data" });
      return;
    }

    const dispute = await prisma.dispute.create({
      data: {
        vehicleId,
        serviceDate: interactionData.interaction_date,
        serviceType: interactionData.interaction_type,
        ownerId: req.user.id,
        mechanicId: +interactionData.mechanic_id,
        status: false,
        reviewedBy: 0,
        discription,
        createdAt: new Date(),
      },
    });

    res.status(201).json({ success: true , dispute });
    return;
  } catch (error) {
    console.error("Error creating dispute:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});

router.post('/admin-review', adminAuthMiddleware('Moderator') , async (req:AuthenticatedAdminRequest, res) => {
  try {
    const payloadSchema = z.object({
      disputeId: z.preprocess((v) => Number(v), z.number().int().positive()),
      action: z.enum(['close', 'reopen']).optional(),
    });

    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Validation failed", issues: parsed.error.format() });
      return;
    }

    const { disputeId, action } = parsed.data;

    const adminId = (req.user as any)?.adminId ?? (req.user as any)?.id;
    if (!adminId) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    const dispute = await prisma.dispute.findUnique({ where: { disputeId } });
    if (!dispute) {
      res.status(404).json({ success: false, message: "Dispute not found" });
      return;
    }

    const updateData: any = {
      reviewedBy: adminId,
    };

    if (action === 'close') {
      updateData.status = true;
      updateData.resolvedAt = new Date();
    } else if (action === 'reopen') {
      updateData.status = false;
      updateData.resolvedAt = null;
    }

    const updated = await prisma.dispute.update({
      where: { disputeId },
      data: updateData,
    });

    res.status(200).json({ success: true, dispute: updated });
    return;
  } catch (error) {
    console.error("Error in admin review:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});


router.post("/mechanic-review", mechanicAuthMiddleware(), async (req: AuthenticatedMechanicRequest, res) => {
  try {
    const schema = z.object({
      disputeId: z.preprocess((v) => Number(v), z.number().int().positive()),
      action: z.enum(["acknowledge", "resolve", "reopen"]).optional(),
      remarks: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Validation failed", issues: parsed.error.format() });
      return;
    }

    const { disputeId, action, remarks } = parsed.data;
    const mechanicId = (req.user as any)?.mechanicId ?? (req.user as any)?.id;
    if (!mechanicId) {
      res.status(403).json({ success: false, message: "Unauthorized" });
      return;
    }

    const dispute = await prisma.dispute.findUnique({ where: { disputeId } });
    if (!dispute) {
      res.status(404).json({ success: false, message: "Dispute not found" });
      return;
    }

    if (dispute.mechanicId && dispute.mechanicId !== mechanicId) {
      res.status(403).json({ success: false, message: "You are not assigned to this dispute" });
      return;
    }

    const updateData: any = {
      reviewedBy: mechanicId,
    };

    if (remarks) updateData.mechanicRemarks = remarks;
    if (action === "resolve") {
      updateData.status = true;
      updateData.resolvedAt = new Date();
    } else if (action === "reopen") {
      updateData.status = false;
      updateData.resolvedAt = null;
    }

    const updated = await prisma.dispute.update({
      where: { disputeId },
      data: updateData,
    });

    try {
      await prisma.auditLog.create({
        data: {
          eventType: "dispute_mechanic_review",
          content: JSON.stringify({ disputeId, action: action ?? "acknowledge", remarks: remarks ?? null }),
          date: new Date(),
          userId: mechanicId,
        },
      });
    } catch (e) {
      console.error("Failed to create audit log for mechanic review:", e);
    }

    res.status(200).json({ success: true, dispute: updated });
    return;
  } catch (error) {
    console.error("Error in mechanic review:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});


router.get("/get-all", adminAuthMiddleware("Moderator"), async (req: AuthenticatedAdminRequest, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const status = (req.query.status as string) || undefined;
    const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;
    const ownerId = req.query.ownerId ? Number(req.query.ownerId) : undefined;
    const mechanicId = req.query.mechanicId ? Number(req.query.mechanicId) : undefined;
    const q = (req.query.q as string) || "";

    const whereBase: any = {};
    if (typeof status !== "undefined") {
      // adapt based on your schema: here assume boolean status (true = resolved)
      if (status === "open") whereBase.status = false;
      else if (status === "closed" || status === "resolved") whereBase.status = true;
      else if (status === "true" || status === "false") whereBase.status = status === "true";
    }
    if (!isNaN(Number(vehicleId))) whereBase.vehicleId = vehicleId;
    if (!isNaN(Number(ownerId))) whereBase.ownerId = ownerId;
    if (!isNaN(Number(mechanicId))) whereBase.mechanicId = mechanicId;

    const where = q
      ? {
          ...whereBase,
          OR: [
            { discription: { contains: q, mode: "insensitive" } },
            { disputeId: !isNaN(Number(q)) ? Number(q) : undefined },
          ].filter(Boolean),
        }
      : whereBase;

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.dispute.count({ where }),
    ]);

    const vehicleIds = Array.from(new Set(disputes.map(d => d.vehicleId).filter(Boolean)));
    const ownerIds = Array.from(new Set(disputes.map(d => d.ownerId).filter(Boolean)));
    const mechanicIds = Array.from(new Set(disputes.map(d => d.mechanicId).filter(Boolean)));
    const reviewerIds = Array.from(new Set(disputes.map(d => d.reviewedBy).filter(Boolean)));

    const [vehicles, owners, mechanics, reviewers] = await Promise.all([
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
      mechanicIds.length
        ? prisma.mechanic.findMany({
            where: { mechanicId: { in: mechanicIds } },
            select: { mechanicId: true, name: true, email: true, phone: true },
          })
        : Promise.resolve([]),
      reviewerIds.length
        ? prisma.admin.findMany({
            where: { adminId: { in: reviewerIds } },
            select: { adminId: true, name: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const vehicleMap = Object.fromEntries(vehicles.map(v => [v.vehicleId, v]));
    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o]));
    const mechanicMap = Object.fromEntries(mechanics.map(m => [m.mechanicId, m]));
    const reviewerMap = Object.fromEntries(reviewers.map(r => [r.adminId, r]));

    const results = disputes.map(d => ({
      ...d,
      vehicle: d.vehicleId ? vehicleMap[d.vehicleId] || null : null,
      owner: d.ownerId ? ownerMap[d.ownerId] || null : null,
      mechanic: d.mechanicId ? mechanicMap[d.mechanicId] || null : null,
      reviewedByAdmin: d.reviewedBy ? reviewerMap[d.reviewedBy] || null : null,
    }));

    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
    return;
  } catch (error) {
    console.error("Error fetching all disputes:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});





export default router;
