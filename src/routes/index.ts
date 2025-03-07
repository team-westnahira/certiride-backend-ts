import express from "express";
import vehicleOwnerRoutes from "../controllers/vehicleowner.controller";
import auditLogRoutes from "../controllers/auditlog.controller"

const router = express.Router();

router.use("/vehicle-owner", vehicleOwnerRoutes);
router.use("/audit-log" , auditLogRoutes)

export default router;