import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import prisma from "../config/prisma";
import { VehicleOwner } from "@prisma/client";

dotenv.config();

interface AuthRequest extends Request {
    user?: VehicleOwner
}



const vehicleOwnerAuthMiddleware = () => {

    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        
        const authHeader = req.header("Authorization");
    
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Access denied, token missing" });
            return
        }
    
        const token = authHeader.split(" ")[1];
    
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string , role: string };
            const user = await prisma.vehicleOwner.findUnique({ where: { email: decoded.email } });
    
            if(!user){
                res.status(404).json({ message: "User account not found." });
                return
            }
    
            if(!user.verificationStatus){
                res.status(401).json({ message: "User account is not activated!" });
                return
            }
    
            if (decoded.role !== "vehicleOwner") {
                res.status(401).json({ message: "Forbidden. Vehicle-Owner only." });
                return 
            }
    
            req.user = user;
            next();
        } catch (err) {
            res.status(401).json({ error: "Unauthorized: Invalid token" });
            return
        }
    
    };

}

export default vehicleOwnerAuthMiddleware;