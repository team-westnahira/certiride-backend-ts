import express, { Request, Response } from "express";
import prisma from "../config/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { generateOtp } from "../utils/otpGenerator";

dotenv.config();
const router = express.Router();

router.post('/vehicle-owner/register', async (req: Request, res: Response) => {
    try {
        const vehicleOwnerRegisterSchema = z.object({
            firstName: z.string().min(1, "First name is required"),
            lastName: z.string().min(1, "Last name is required"),
            address: z.string().min(1, "Address is required"),
            phone: z.string().min(10, "Phone number must be at least 10 digits"),
            nic: z.string().min(1, "NIC is required"),
            email: z.string().email("Invalid email address"),
            password: z.string().min(6, "Password must be at least 6 characters long"),
        });

        // Validate the request body against the Zod schema
        const parsedData = vehicleOwnerRegisterSchema.safeParse(req.body);

        if (!parsedData.success) {
            // If validation fails, return errors
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors, // Zod validation errors
            });
            return
        }

        const { firstName, lastName, address, phone, nic, email, password } = parsedData.data;

        // Check if email already exists
        let existingUser = await prisma.vehicleOwner.findUnique({
            where: { email },
        });

        if (existingUser) {
            res.status(400).json({ error: "Email is already registered" });
            return;
        }

        // Check for NIC
        existingUser = await prisma.vehicleOwner.findUnique({
            where: { nic },
        });

        if (existingUser) {
            res.status(400).json({ error: "NIC is already used" });
            return;
        }

        // Check for phone
        existingUser = await prisma.vehicleOwner.findUnique({
            where: { phone },
        });

        if (existingUser) {
            res.status(400).json({ error: "Phone is already used" });
            return;
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = await prisma.vehicleOwner.create({
            data: {
                firstName,
                lastName,
                address,
                phone,
                nic,
                email,
                password: hashedPassword,
                verificationStatus: false,
                otp: generateOtp(),
                dateRegistered: new Date()
            },
        });

        res.status(201).json({
            message: "New user registered successfully!",
            user: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
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

// Login Route
router.post('/vehicle-owner/login', async (req: Request, res: Response) => {
    try {

        // Validate request body
        const vehicleOwnerLoginSchema = z.object({
            email: z.string().email("Invalid email address"),
            password: z.string().min(6, "Password must be at least 6 characters long"),
            deviceInfo: z.string().max(100 , "Invalid device info")
        });

        const parsedData = vehicleOwnerLoginSchema.safeParse(req.body);
        
        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors,
            });
            return
        }

        const { email, password , deviceInfo } = parsedData.data;

        // Check if user exists
        const user = await prisma.vehicleOwner.findUnique({ where: { email } });

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
            { id: user.id, email: user.email , role: 'vehicleOwner' },
            secretKey,
            { expiresIn: "1h" }
        );

        // store it in the database
        await prisma.authToken.create({
            data: {
                tokenType: "login-vehicleOwner",
                userId: user.id,
                userRole: "vehicleOwner",
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
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            },
        });

        return

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error!" });
    }
});


router.get('/vehicle-owner/current-user', async (req: Request, res: Response) => {
    
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
            if (!decoded || decoded.role !== 'vehicleOwner') {
                res.status(401).json({ error: "Unauthorized: Invalid token" });
                return
            }
        }catch(err){
            res.status(401).json({ error: "Unauthorized: Invalid token" });
            return
        }

        // Fetch user details
        const user = await prisma.vehicleOwner.findUnique({
            where: { id: +decoded.id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                address: true,
                phone: true,
                nic: true,
                email: true,
                verificationStatus: true,
                dateRegistered: true
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


router.get('/vehicle-owner/logout', async (req: Request, res: Response) => {

    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Unauthorized: No token provided" });
            return;
        }

        const token = authHeader.split(" ")[1];

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


export default router;
