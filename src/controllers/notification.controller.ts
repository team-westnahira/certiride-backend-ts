import express, { Response, Router } from "express";
import prisma from "../config/prisma";
import { AuthenticatedVehicleOwnerRequest } from "../types";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";

const router: Router = express.Router();

router.get('/get-all' , vehicleOwnerAuthMiddleware() , async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
  const { userRole , all } = req.query as { userRole: string , all?: string };

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user?.id,
        userRole,
        read: all !== 'true' ? false : undefined,
      },
      orderBy: {
        date: "desc",
      },
    });

    res.json({ success: true, data: notifications });
    return
  } catch (error) {
    console.error("Error fetching notifications", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }

});

router.get('/mark-as-read' , vehicleOwnerAuthMiddleware() , async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
  const { userRole } = req.query as { userRole: string };

  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user?.id,
        userRole,
        read: false,
      },
      data: {
        read: true,
      },
    });

    res.json({ success: true, message: "All notifications marked as read" });
    return;
  } catch (error) {
    console.error("Error updating all notifications", error);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }
});


export default router