import express from "express";
import vehicleOwnerRoutes from "../controllers/vehicleowner.controller";

const router = express.Router();

router.use("/vehicle-owner", vehicleOwnerRoutes);

export default router;