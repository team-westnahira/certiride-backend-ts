import express, { Request, Response } from "express";
import prisma from "../config/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateOtp } from "../utils/otpGenerator";

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
                DateRegistered: new Date()
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

export default router;
