import express from "express";
import prisma from "../config/prisma";

const router = express.Router();

router.get("/", async (req, res) => {
  const users = await prisma.mechanic.findMany();
  
  const mockUser:{username: string , age : number}[] = [
    {username : 'naveen' , age : 20},
    {username : 'naveen dhananjaya' , age : 23},
    {username : 'haritha senadheera' , age : 24},
  ]
  
  res.json(mockUser);
});


export default router;