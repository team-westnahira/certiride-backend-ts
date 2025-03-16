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


interface AuthenticatedRequest extends Request {
    user?: Admin
}


router.post('/add-admin', async (req: Request, res: Response) => {
    
    try {

        const vehicleOwnerRegisterSchema = z.object({
            name: z.string().min(1, "First name is required"),
            email: z.string().email("Invalid email address"),
            password: z.string().min(8, "Password must be at least 6 characters long"),
            role: z.enum(["Admin", "Moderator"])
        });

        const parsedData = vehicleOwnerRegisterSchema.safeParse(req.body);

        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors,
            });
            return
        }

        const { name , email , password , role } = parsedData.data;

        let existingUser = await prisma.admin.findUnique({
            where: { email },
        });

        let existingMechanic = await prisma.mechanic.findUnique({
            where: {email}
        })

        let existingOwner = await prisma.vehicleOwner.findUnique({
            where: {email}
        })

        if (existingUser || existingMechanic || existingOwner) {
            res.status(400).json({ error: "Email is already registered one of {Admin , Mechanic , Vehicle owner } account type before" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.admin.create({
            data: {
                name: name,
                email,
                password: hashedPassword,
                role: role,
                isActive: false,
                otp: generateOtp()
            },
        });

        addAuditLog(1 , "ADD_ADMIN_USER" , JSON.stringify({
            "addedAdminUser": newUser,
            "IPAddress": req.ip
        }))

        res.status(201).json({
            message: "New admin user registered successfully!",
            user: {
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                isActive: newUser.isActive
            },
        });

        return;
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error!" });
        return;
    }

});

router.post('/login' , async(req:Request , res:Response) => {

    try{

        const adminLoginSchema = z.object({
            email: z.string().email("Invalid email address"),
            password: z.string().min(1, "Password is required"),
            deviceInfo: z.string().max(100 , "Invalid device info")
        });

        const parsedData = adminLoginSchema.safeParse(req.body);
        
        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors,
            });
            return
        }

        const { email, password , deviceInfo } = parsedData.data;

        const user = await prisma.admin.findUnique({ where: { email } });

        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ error: "Invalid credentials" });
            return
        }

        if(!user.isActive){
            res.status(401).json({ error: "Admin user is not activated!" });
            return
        }

        const secretKey = process.env.JWT_SECRET as string;

        if (!secretKey) throw new Error("JWT_SECRET is not defined in environment variables");

        const token = jwt.sign(
            { id: user.adminId, email: user.email , role: user.role },
            secretKey,
            { expiresIn: "30d" }
        );

        await prisma.authToken.create({
            data: {
                tokenType: "login-admin",
                userId: user.adminId,
                userRole: user.role,
                ipAddress: req.ip || '',
                deviceInfo: deviceInfo,
                expirationTime: new Date(),
                tokenValue: token
            },
        });

        addAuditLog(user.adminId , "ADMIN_LOGIN" , JSON.stringify({
            "addedAdminUser": user,
            "IPAddress": req.ip
        }))

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.adminId,
                name: user.name,
                email: user.email,
                role: user.role
            },
        });

        return

    }catch(err) {
        res.status(500).json({ error: "Internal server error!" });
        return;
    }

})


router.get('/current-admin', adminAuthMiddleware("Moderator") , (req: AuthenticatedRequest, res: Response) => {
    

    let _user = {...req.user}
    delete _user.otp
    delete _user.password

    res.status(200).json({
        user: _user
    })
    return 

})


router.post('/block-admin' , adminAuthMiddleware('Admin') , async (req:AuthenticatedRequest , res: Response) => {

    try{

        const adminLoginSchema = z.object({
            email: z.string().email("Invalid email address"),
            state: z.boolean()
        });

        const parsedData = adminLoginSchema.safeParse(req.body);
        
        if (!parsedData.success) {
            res.status(400).json({
                error: "Validation failed",
                issues: parsedData.error.errors,
            });
            return
        }

        
        const { email , state } = parsedData.data;

        const user = await prisma.admin.findUnique({ where: { email } });

        if(req.user?.adminId === user?.adminId){
            res.status(401).json({ error: "Cannot change the active state of yourself!" });
            return
        }

        if (!user) {
            res.status(401).json({ error: "User not found for this email" });
            return
        }

        if (user.role === 'Admin') {
            res.status(401).json({ error: "Admin account cannot be deactivated" });
            return
        }

        const updatedUser = await prisma.admin.update({
            where: { email: email },
            data: {
                isActive: state,
            },
        });

        res.json({
            message: "State changed successfully!",
            user: {
                id: updatedUser.adminId,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                isActive: updatedUser.isActive
            },
        });

        return

    }catch(err) {
        res.status(500).json({ error: "Internal server error!" });
        return;
    }

})

export default router