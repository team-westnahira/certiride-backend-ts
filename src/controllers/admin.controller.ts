import express, { Response } from "express";
import prisma from "../config/prisma";
import adminAuthMiddleware from "../middleware/admin.middleware";
import { AuthenticatedAdminRequest } from "../types";
import moment from "moment";
import { Vehicle } from "@prisma/client";

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






export default router;