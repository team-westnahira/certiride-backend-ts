import express, { Response } from "express";
import prisma from "../config/prisma";
import adminAuthMiddleware from "../middleware/admin.middleware";
import { AuthenticatedAdminRequest } from "../types";
import moment from "moment";

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
        message: log.content ? (JSON.parse(log.content) as {message : string}).message : 'No message',
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




export default router;