import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/prisma";
import { generateOtp } from "../../utils/otpGenerator";
import { addAuditLog } from "../../services/auditlog.service";
import { Admin } from "@prisma/client";
import adminAuthMiddleware from "../../middleware/admin.middleware";

dotenv.config();
const router = express.Router();



router.post('/mechanic/register', async (req: Request, res: Response) => {
    
    try {
        const mechanicRegisterSchema = z.object({
            name: z.string().min(1, "Name is required"),
            email: z.string().email("Invalid email address"),
            password: z.string().min(6, "Password must be at least 6 characters long"),
            address: z.string().min(1, "Address is required"),
            nic: z.string().min(1, "NIC is required"),
            cid: z.string().min(1, "CID is required"),
            phone: z.string().min(10, "Phone number must be at least 10 digits"),
            specialization: z.string().min(1, "Specialization is required"),
            
        });

        // Validate the request body against the Zod schema
        const parsedData = mechanicRegisterSchema.safeParse(req.body);

        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.format(),
            });
            return
        }

        const { name, email, password, address, nic, cid, phone, specialization  } = parsedData.data;

        // Check if email already exists
        let existingUser = await prisma.mechanic.findUnique({
            where: { email },
        });

        if (existingUser) {
            res.status(400).json({ error: "Email is already registered" });
            return;
        }

        // Check for NIC
        existingUser = await prisma.mechanic.findUnique({
            where: { nic },
        });

        if (existingUser) {
            res.status(400).json({ error: "NIC is already used" });
            return;
            // NIC validation to be added
        }

        // Check for phone
        existingUser = await prisma.mechanic.findUnique({
            where: { phone },
        });

        if (existingUser) {
            res.status(400).json({ error: "Phone is already used" });
            return;
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = await prisma.mechanic.create({
            data: {
                name,
                email,
                password: hashedPassword,
                address,
                nic,
                cid,
                phone,
                dateRegistered: new Date(),
                specialization,
                verificationStatus: true,
            },
        });

        res.status(201).json({
            message: "New user registered successfully!",
            user: {
                id: newUser.mechanicId,
                name: newUser.name,
                address: newUser.address,
                phone: newUser.phone,
                nic: newUser.nic,
                email: newUser.email,
            },
        });
        return;
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error!" });
        return;
    }

});

// Mechanic Login
router.post('/mechanic/login', async (req: Request, res: Response) => {
    try {

        // Validate request body
        const mechanicLoginSchema = z.object({
            email: z.string().email("Invalid email address"),
            password: z.string().min(6, "Password must be at least 6 characters long"),
            deviceInfo: z.string().max(100 , "Invalid device info")
        });

        const parsedData = mechanicLoginSchema.safeParse(req.body);
        
        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors,
            });
            return
        }

        const { email, password , deviceInfo } = parsedData.data;

        // Check if user exists
        const user = await prisma.mechanic.findUnique({ where: { email } });

        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ error: "Invalid credentials" });
            return
        }

        // Generate JWT token
        const secretKey = process.env.JWT_SECRET as string;

        if (!secretKey) throw new Error("JWT_SECRET is not defined in environment variables");

        const token = jwt.sign(
            { id: user.mechanicId, email: user.email , role: 'mechanic' },
            secretKey,
            { expiresIn: "1h" }
        );

        // store it in the database
        await prisma.authToken.create({
            data: {
                tokenType: "login-mechanic",
                userId: user.mechanicId,
                userRole: "mechanic",
                ipAddress: req.ip || '',
                deviceInfo: deviceInfo,
                expirationTime: new Date(),
                tokenValue: token
            },
        });

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.mechanicId,
                name: user.name,
                email: user.email,
            },
        });

        return

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error!" });
    }
});


router.get('/mechanic/current-user', async (req: Request, res: Response) => {
    
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Unauthorized: No token provided" });
            return
        }

        const token = authHeader.split(" ")[1];
        const secretKey = process.env.JWT_SECRET as string;
        if (!secretKey) throw new Error("JWT_SECRET is not defined in environment variables");

        // Verify token
        let decoded:{
            id: string;
            email: string;
            role: string;
        } = {
            id: "",
            email: "",
            role: ""
        }
        
        try{
            decoded = jwt.verify(token, secretKey) as { id: string, email: string, role: string };
            if (!decoded || decoded.role !== 'mechanic') {
                res.status(401).json({ error: "Unauthorized: Invalid token" });
                return
            }
        }catch(err){
            res.status(401).json({ error: "Unauthorized: Invalid token" });
            return
        }

        const savedToken = await prisma.authToken.findUnique({
            where: { tokenValue: token }
        });

        if(!savedToken) {
            res.status(401).json({ error: "Unauthorized: Invalid token" });
            return
        }

        // Fetch user details
        const user = await prisma.mechanic.findUnique({
            where: { mechanicId: +decoded.id },
            select: {
                mechanicId: true,
                name: true,
                email: true,
                address: true,
                nic: true,
                cid: true,
                phone: true,
                dateRegistered: true,
                specialization: true,
                verificationStatus: true,
                
            }
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return
        }

        if(user.verificationStatus === false){
            res.status(403).json({ error: "User is not verified!" });
            return
        }

        res.json({ user });
        return
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error!" });
        return
    }

});


router.get('/mechanic/logout', async (req: Request, res: Response) => {

    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Unauthorized: No token provided" });
            return;
        }

        const token = authHeader.split(" ")[1];

        const savedToken = await prisma.authToken.findUnique({
            where: { tokenValue: token }
        });

        if(!savedToken) {
            res.status(401).json({ error: "Unauthorized: Invalid token" });
            return
        }

        // Remove token from database
        await prisma.authToken.deleteMany({
            where: { tokenValue: token }
        });

        res.json({ message: "Logout successful" });
        return;

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error!" });
    }

});


export default router