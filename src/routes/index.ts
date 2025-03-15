import express from "express";
import vehicleOwnerRoutes from "../controllers/vehicleowner.controller";
import auditLogRoutes from "../controllers/auditlog.controller"
import authRoutes from "../controllers/auth.controller"
import adminAuth from "../controllers/auth/admin-auth.controller"

const router = express.Router();

router.use("/vehicle-owner", vehicleOwnerRoutes);
router.use("/audit-log" , auditLogRoutes)
router.use("/auth/admin" , adminAuth)
router.use("/auth" , authRoutes)
router.use("/auth" , authRoutes)  

export default router;