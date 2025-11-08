import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../../config/prisma";
import {Mechanic } from "@prisma/client";
import mechanicAuthMiddleware from "../../middleware/mechanic.middleware";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

interface AuthenticatedRequest extends Request {
    user?: Mechanic
}

dotenv.config();
const router = express.Router();
const sriLankanNICRegex = /^(?:\d{9}[VX]|\d{12})$/;


router.post('/register', async (req: Request, res: Response) => {

    if (!req.headers['content-type']?.includes('multipart/form-data')) {
        res.status(400).json({ message: 'Invalid content type. Use multipart/form-data.' });
        return;
    }
    
    try {
        
        const mechanicRegisterSchema = z.object({
            name: z.string().min(1, "Name is required"),
            email: z.string().email("Invalid email address"),
            password: z.string().min(6, "Password must be at least 6 characters long"),
            address: z.string().min(1, "Address is required"),
            nic: z.string()
                .min(10, "NIC must be at least 10 characters long")
                .max(12, "NIC must be at most 12 characters long")
                .regex(sriLankanNICRegex, "Invalid Sri Lankan NIC format"),
            cid: z.string().min(1, "CID is required"),
            phone: z.string().min(10, "Phone number must be at least 10 digits"),
            specialization: z.string().min(1, "Specialization is required"),
        });

        const parsedData = mechanicRegisterSchema.safeParse(req.body);

        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.format(),
            });
            return
        }

        const file = req.files?.nicImage;
            if (!file || Array.isArray(file)) {
            res.status(400).json({ message: 'NIC front image is required.' });
            return;
        }

        // save uploaded NIC image to uploads/nics
        let imagePath = '';
        try {
          const uploadsDir = path.join(__dirname, "../../uploads/nics");
          await fs.promises.mkdir(uploadsDir, { recursive: true });

          const uploadedFile = file as any; // express-fileupload UploadedFile
          const originalName = uploadedFile.name || `nic_${Date.now()}.jpg`;
          const safeName = `${Date.now()}_${originalName.replace(/\s+/g, "_")}`;
          const destPath = path.join(uploadsDir, safeName);

          if (typeof uploadedFile.mv === "function") {
            await new Promise<void>((resolve, reject) => {
              uploadedFile.mv(destPath, (err: any) => (err ? reject(err) : resolve()));
            });
          } else {
            await fs.promises.writeFile(destPath, uploadedFile.data);
          }

          imagePath = `../../uploads/nics/${safeName}`;
        } catch (err) {
          console.error("Failed to save NIC image:", err);
          res.status(500).json({ error: "Failed to save NIC image" });
          return;
        }

        const { name, email, password, address, nic, cid, phone, specialization  } = parsedData.data;

        let existingUser = await prisma.mechanic.findUnique({
            where: { email },
        });

        if (existingUser) {
            res.status(400).json({ error: "Email is already registered" });
            return;
        }

        existingUser = await prisma.mechanic.findUnique({
            where: { nic },
        });

        if (existingUser) {
            res.status(400).json({ error: "NIC is already used" });
            return;
        }

        existingUser = await prisma.mechanic.findUnique({
            where: { phone },
        });

        if (existingUser) {
            res.status(400).json({ error: "Phone is already used" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.mechanic.create({
            data: {
                name,
                email,
                password: hashedPassword,
                address,
                nic,
                cid : randomUUID(),
                phone,
                dateRegistered: new Date(),
                specialization,
                verificationStatus: false,
                nicImagePath: imagePath
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
                nicImagePath: imagePath
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
router.post('/login', async (req: Request, res: Response) => {
    try {

        // Validate request body
        const mechanicLoginSchema = z.object({
            email: z.string().email("Invalid email address"),
            password: z.string().min(6, "Password must be at least 6 characters long"),
            deviceInfo: z.string().max(200 , "Invalid device info")
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

        // Check verification Status
        if (!user.verificationStatus) {
            res.status(403).json({ error: "Account not approved yet" });
            return;
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


router.get('/current-user' , mechanicAuthMiddleware() , async (req: AuthenticatedRequest, res: Response) => {
    
    let _user = {...req.user}
    delete _user.password

    res.status(200).json({
        user: _user
    })

    return
});


router.get('/logout', async (req: Request, res: Response) => {

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