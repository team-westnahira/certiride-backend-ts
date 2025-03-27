import express from "express";
import vehicleOwnerRoutes from "../controllers/vehicleowner.controller";
import mechanicRoutes from "../controllers/mechanic.controller";
import auditLogRoutes from "../controllers/auditlog.controller";
import adminAuth from "../controllers/auth/admin-auth.controller";
import mechanicAuth from "../controllers/auth/mechanic-auth.controller";
import vehicleOwnerAuth from "../controllers/auth/vehicle-owner-auth.controller";
import vehicleInfo from "../controllers/vehicledetails.controller";
const router = express.Router();

router.use("/vehicle-owner", vehicleOwnerRoutes);
router.use("/mechanic", mechanicRoutes);
router.use("/audit-log", auditLogRoutes);

router.use("/auth/admin", adminAuth);
router.use("/auth/mechanic", mechanicAuth);
router.use("/auth/vehicle-owner", vehicleOwnerAuth);
router.use("/vehicle-info" , vehicleInfo)

export default router;