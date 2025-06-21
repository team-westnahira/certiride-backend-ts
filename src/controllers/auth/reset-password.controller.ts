import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { z } from "zod";
import prisma from "../../config/prisma";
import { generateSecureOtp } from "../../utils/otpGenerator";
import bcrypt from "bcryptjs";
import { sendEmail } from "../../services/email.service";
import { resetPasswordTemplate } from "../../templates/email/resetPassword";

dotenv.config();
const router = express.Router();

router.post('/vehicle-owner/gen-token' , async (req:Request , res:Response) => {
    
    try {

        const schema = z.object({
            email: z.string().email("Invalid email address")
        });

        const parsedData = schema.safeParse(req.body);

        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.format(),
            });
            return
        }

        const {email} = parsedData.data;

        let owner = await prisma.vehicleOwner.findUnique({
            where: { email },
        });

        if (!owner) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const otp = generateSecureOtp(8);

        await prisma.authToken.create({
            data: {
                tokenType: "reset-password",
                userId: owner.id,
                userRole: "vehicleOwner",
                ipAddress: req.ip || '',
                deviceInfo: "",
                expirationTime: new Date(Date.now() + 1 * 60 * 60 * 1000),
                tokenValue: otp
            },
        });

        await sendEmail({
            to: owner.email,
            subject: 'Certiride Reset Password OTP',
            html:resetPasswordTemplate(otp)
        });

        res.json({
            message: "Reset password OTP sent",
        });

    }catch(err){
        console.error(err);
        res.status(500).json({ error: "Internal server error!" });
        return;
    }

})

router.post('/vehicle-owner/reset-password' , async (req:Request , res:Response) => {
    
    try {

        const schema = z.object({
            email: z.string().email("Invalid email address"),
            token: z.string().min(1, "Reset password token is required"),
            newPassword: z.string().min(6, "Password must be at least 6 characters long"),
        });

        const parsedData = schema.safeParse(req.body);

        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.format(),
            });
            return
        }

        const {email , token , newPassword} = parsedData.data;

        let owner = await prisma.vehicleOwner.findUnique({
            where: { email },
        });

        if (!owner) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const resetToken = await prisma.authToken.findUnique({
            where: {
                tokenType: 'reset-password',
                userRole: 'vehicleOwner',
                tokenValue: token
            }
        })

        if (!resetToken) {
            res.status(404).json({ error: "Token not found" });
            return;
        }

        if(resetToken.tokenValue !== token){
            res.status(400).json({ error: "Token not valid" });
            return;
        }

        if (resetToken.expirationTime < new Date()) {
            res.status(400).json({ error: "Token is expired" });
            return;
        }

        const isMatch = await bcrypt.compare(newPassword, owner.password);
        if (isMatch) {
            res.status(400).json({ error: "Please insert a new password" });
            return
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.vehicleOwner.update({
            where: {
                id: owner.id,
            },
            data: {
                password: hashedPassword,
            },
        });


        await prisma.authToken.deleteMany({
            where: {
                userId: owner.id
            },
        });

        res.json({
            message: "Password resetted successfully!",
        });
        return

    }catch(err){
        console.error(err);
        res.status(500).json({ error: "Internal server error!" });
        return;
    }

})


export default router