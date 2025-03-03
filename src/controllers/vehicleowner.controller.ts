import express from "express";
import prisma from "../config/prisma";

const router = express.Router();

router.get("/", async (req, res) => {
  const users = await prisma.vehicleOwner.findMany();
  res.json(users);
});

export default router;