import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { Admin } from "@prisma/client";
import prisma from "../config/prisma";
dotenv.config();

interface AdminRequest extends Request {
    user?: Admin
}

const adminAuthMiddleware = (requiredRole?: string) => {

    return async (req: AdminRequest, res: Response, next: NextFunction) => {
        const authHeader = req.header("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Access denied. No token provided." });
            return 
        }

        const token = authHeader.split(" ")[1]; // Extract the token

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string; role?: string };
            const user = await prisma.admin.findUnique({ where: { email: decoded.email } });

            if(!user){
                res.status(404).json({ message: "Admin account not found." });
                return
            }

            if(!user.isActive){
                res.status(403).json({ message: "Admin account is not activated!" });
                return
            }

            req.user = user;

            if (req.user.role === "Moderator" && requiredRole !== req.user.role ) {
                res.status(403).json({ message: "Forbidden. Admins only." });
                return 
            }

            next();
        } catch (err) {
            res.status(400).json({ message: "Invalid token." });
            return 
        }
    };

};

export default adminAuthMiddleware;
