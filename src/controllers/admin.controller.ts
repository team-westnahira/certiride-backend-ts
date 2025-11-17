import express, { Response } from "express";
import prisma from "../config/prisma";
import adminAuthMiddleware from "../middleware/admin.middleware";
import { AuthenticatedAdminRequest, AuthenticatedVehicleOwnerRequest } from "../types";
import moment from "moment";
import { Vehicle } from "@prisma/client";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
import { z } from "zod";
import bcrypt from "bcryptjs";


const router = express.Router();


router.get('/stat' , adminAuthMiddleware('Moderator') , async (req:AuthenticatedAdminRequest , res:Response) => {

    const totalMechanics = await prisma.mechanic.count();
    const totalVehicles = await prisma.vehicle.count();
    const logs = await prisma.auditLog.findMany({
        orderBy: {
            date: "desc",
        },
        take: 10,
    });

    const userIds = logs.map(log => log.userId);

    const users = await prisma.vehicleOwner.findMany({
        where: { id: { in: userIds } },
        select: { id: true, lastName: true , firstName: true },
    });

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const recentActivities = logs.map(log => ({
        id: log.eventId,
        action: log.eventType,
        message: typeof log.content === 'string' ? ((JSON.parse(log.content) as { message: string }).message) : 'No message',
        timeAgo: moment(log.date).fromNow(),
        user: userMap[log.userId] || { id: log.userId, firstName: 'Unknown' ,lastName: "Unknown",},
    }))


    const unverifiedMechanics = await prisma.mechanic.count({
        where : {
            verificationStatus: false
        }
    })

    res.status(200).json({
        stat: {
            totalMechanics: { count: totalMechanics },
            pendingApprovals: { count: unverifiedMechanics },
            activeDisputes: { count: 8 },
            registeredVehicles: { count: totalVehicles }
        },
        
        recentActivity: recentActivities,

        quickActions: {
            pendingApprovals: { count: unverifiedMechanics, action: "Review" },
            activeDisputes: { count: 8, urgency: "Urgent" },
            systemStatus: {
                status: "Healthy",
                description: "All services operational"
            }
        }

    })
    return

})



router.get("/get-vehicle-owners", adminAuthMiddleware("Moderator"), async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const total = await prisma.vehicleOwner.count();

      const vehicleOwners = await prisma.vehicleOwner.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          dateRegistered: true,
          verificationStatus: true,
          address: true,
          phone: true
        },
        orderBy: {
          dateRegistered: "desc",
        },
      });

      const out: Array<typeof vehicleOwners[0] & { vehicles: Vehicle[] }> = [];

      await Promise.all(
        vehicleOwners.map(async (owner) => {
          const vehicles = await prisma.vehicle.findMany({
              where: {
                  ownerId: owner.id
              }
          })

          const obj = { ...owner, vehicles };
          out.push(obj);
        })
      );

      res.status(200).json({
        success: true,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        data: out,
      });
    } catch (error) {
      console.error("Error fetching vehicle owners:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);


router.get("/search-vehicle-owners", adminAuthMiddleware("Moderator") , async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const searchTerm = (req.query.search as string) || "";

      const whereClause = searchTerm
        ? {
            OR: [
              { firstName: { contains: searchTerm } },
              { lastName: { contains: searchTerm } },
              { email: { contains: searchTerm } },
              { phone: { contains: searchTerm } },
            ],
          }
        : {};

      const total = await prisma.vehicleOwner.count({ where: whereClause });

      const vehicleOwners = await prisma.vehicleOwner.findMany({
        skip,
        take: limit,
        where: whereClause,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          dateRegistered: true,
          verificationStatus: true,
          address: true,
          phone: true,
        },
        orderBy: {
          dateRegistered: "desc",
        },
      });

      const out: Array<typeof vehicleOwners[0] & { vehicles: Vehicle[] }> = [];

      await Promise.all(
        vehicleOwners.map(async (owner) => {
          const vehicles = await prisma.vehicle.findMany({
            where: { ownerId: owner.id },
          });
          out.push({ ...owner, vehicles });
        })
      );

      res.status(200).json({
        success: true,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        data: out,
      });
    } catch (error) {
      console.error("Error searching vehicle owners:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);


router.post("/activate-mechanic" , adminAuthMiddleware("Moderator") , async (req: AuthenticatedAdminRequest, res: Response) => {
  
  const mechanicId = Number(req.query.id);
  const status = req.query.status;

  if (isNaN(mechanicId)) {
    res.status(400).json({ error: "Invalid mechanic ID" });
    return 
  }

  try {

    const mechanic = await prisma.mechanic.findUnique({
      where: {  mechanicId: mechanicId },
    });
    
    if (!mechanic){
      res.status(400).json({
        message: "Mechanic Not found",
        mechanic,
      })
      return  
    }

    const newMechanic = await prisma.mechanic.update({
      where: { mechanicId },
      data: { verificationStatus: status === '1' ? true : false },
    });

    console.log('new mechanic : ' , newMechanic)

    res.json({
      message: "Mechanic activated successfully",
      mechanic : newMechanic,
    });
    return

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: "Failed to activate mechanic" });
    return 
  }

});


router.get("/get-all-mechanics", adminAuthMiddleware("Moderator") , async (req: AuthenticatedAdminRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  try {
    // fetch mechanics with pagination
    const [mechanics, total] = await Promise.all([
      prisma.mechanic.findMany({
        skip,
        take: limit,
        orderBy: { dateRegistered: "desc" },
      }),
      prisma.mechanic.count(),
    ]);

    res.json({
      data: mechanics,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch mechanics" });
    return
  }
});


router.get("/search-mechanics", adminAuthMiddleware("Moderator") , async (req: AuthenticatedAdminRequest, res: Response) => {
  const q = (req.query.q as string) || "";
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  try {
    const where = q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { address: { contains: q } },
            { nic: { contains: q } },
            { cid: { contains: q } },
            { specialization: { contains: q } },
          ],
        }
      : {};

    const [mechanics, total] = await Promise.all([
      prisma.mechanic.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateRegistered: "desc" },
      }),
      prisma.mechanic.count({ where }),
    ]);

    res.json({
      data: mechanics,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to search mechanics" });
    return
  }
});


router.get("/get-all-admins" , adminAuthMiddleware('Moderator'), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    
    const [admins, _] = await Promise.all([
      prisma.admin.findMany({
        orderBy: { adminId: "asc" },
        select: {
          adminId: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      }),
      prisma.admin.count(),
    ]);

    res.json({
      data: admins
    });
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch admins" });
    return 
  }
});


router.get("/get-all-vehicles" , adminAuthMiddleware('Moderator'), async (req: AuthenticatedAdminRequest, res: Response) => {
  
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  
  try {
    
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        skip,
        take: limit,
        orderBy: { vehicleId: "asc" },
        select: {
          vin: true,
          manufacture: true,
          model: true,
          year: true,
          initialMilage: true,
          ownerId: true
        },
      }),
      prisma.vehicle.count(),
    ]);


    const ownerIds = vehicles.map(v => v.ownerId).filter(Boolean);
    const owners = await prisma.vehicleOwner.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, firstName: true, lastName: true, email: true , address: true },
    });

    const ownerMap = Object.fromEntries(owners.map(o => [o.id, o]));

    const vehiclesWithOwner = vehicles.map(vehicle => ({
      ...vehicle,
      owner: ownerMap[vehicle.ownerId] || null,
    }));

    res.json({
      data: vehiclesWithOwner,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
    return
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch admins" });
    return 
  }
});



router.get("/search-vehicles", adminAuthMiddleware("Moderator"), async (req: AuthenticatedAdminRequest, res: Response) => {
    const q = (req.query.q as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    try {
      const vehicleWhere = q
        ? {
            OR: [
              { vin: { contains: q } },
              { manufacture: { contains: q } },
              { model: { contains: q } },
              { year: { equals: isNaN(Number(q)) ? undefined : Number(q) } },
            ],
          }
        : {};

      const owners = q
        ? await prisma.vehicleOwner.findMany({
            where: {
              OR: [
                { firstName: { contains: q } },
                { lastName: { contains: q } },
                { email: { contains: q } },
                { address: { contains: q } },
              ],
            },
            select: { id: true },
          })
        : [];

      const ownerIds = owners.map((o) => o.id);

      const where =
        q && ownerIds.length > 0
          ? {
              OR: [
                vehicleWhere,
                { ownerId: { in: ownerIds } },
              ],
            }
          : vehicleWhere;

      const [vehicles, total] = await Promise.all([
        prisma.vehicle.findMany({
          where,
          skip,
          take: limit,
          orderBy: { vehicleId: "asc" },
          select: {
            vin: true,
            manufacture: true,
            model: true,
            year: true,
            initialMilage: true,
            ownerId: true,
          },
        }),
        prisma.vehicle.count({ where }),
      ]);

      const ownersForVehicles = await prisma.vehicleOwner.findMany({
        where: { id: { in: vehicles.map((v) => v.ownerId).filter(Boolean) } },
        select: { id: true, firstName: true, lastName: true, email: true, address: true },
      });

      const ownerMap = Object.fromEntries(
        ownersForVehicles.map((o) => [o.id, o])
      );

      const vehiclesWithOwner = vehicles.map((vehicle) => ({
        ...vehicle,
        owner: ownerMap[vehicle.ownerId] || null,
      }));

      res.json({
        data: vehiclesWithOwner,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to search vehicles" });
    }
  }
);



router.post("/edit-admin", adminAuthMiddleware("Admin"), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const adminId = Number(req.body.adminId ?? req.query.adminId);
    if (isNaN(adminId)) {
      res.status(400).json({ success: false, message: "adminId is required and must be a number" });
      return;
    }

    const { name, email, role, isActive } = req.body;
    const updateData: any = {};

    if (typeof name === "string" && name.trim().length) updateData.name = name.trim();
    if (typeof email === "string" && email.trim()) updateData.email = email.trim().toLowerCase();
    if (typeof role === "string" && role.trim()) updateData.role = role.trim();
    if (typeof isActive !== "undefined") updateData.isActive = Boolean(isActive);

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields provided to update" });
      return;
    }

    const found = await prisma.admin.findUnique({ where: { adminId } });
    if (!found) {
      res.status(404).json({ success: false, message: "Admin not found" });
      return;
    }

    const updated = await prisma.admin.update({
      where: { adminId },
      data: updateData,
    });

    res.status(200).json({ success: true, admin: updated });
    return;
  } catch (error) {
    console.error("Error updating admin:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});


router.post("/reset-password", adminAuthMiddleware("Moderator"), async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const resetSchema = z
      .object({
        adminId: z.preprocess((v) => Number(v), z.number().int().positive()).optional(),
        email: z.string().email().optional(),
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
      })
      .refine((data) => data.adminId !== undefined || data.email !== undefined, {
        message: "Either adminId or email is required",
        path: ["adminId", "email"],
      });

    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Validation failed", issues: parsed.error.format() });
      return;
    }

    const { adminId, email, newPassword } = parsed.data;

    let adminRecord = null;
    if (adminId !== undefined) {
      adminRecord = await prisma.admin.findUnique({ where: { adminId } });
    } else if (email) {
      adminRecord = await prisma.admin.findUnique({ where: { email } });
    }

    if (!adminRecord) {
      res.status(404).json({ success: false, message: "Admin not found" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    const updated = await prisma.admin.update({
      where: { adminId: adminRecord.adminId },
      data: { password: hashed },
      select: { adminId: true, name: true, email: true, role: true, isActive: true },
    });

    res.status(200).json({ success: true, message: "Password reset successfully", admin: updated });
    return;
  } catch (error) {
    console.error("Error resetting admin password:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});


export default router;