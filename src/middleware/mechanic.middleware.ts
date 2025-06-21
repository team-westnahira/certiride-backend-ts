import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import prisma from "../config/prisma";
import { Mechanic } from "@prisma/client";
dotenv.config();
 
interface MechanicRequest extends Request {
    user?: Mechanic
}
 


const mechanicAuthMiddleware = () => {

    return async (req: MechanicRequest, res: Response, next: NextFunction) => {
        const authHeader = req.header("Authorization");
     
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ message: "Access denied. No token provided." });
            return
        }
     
        const token = authHeader.split(" ")[1];
     
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string; role?: string };
            const user = await prisma.mechanic.findUnique({ where: { email: decoded.email } });
            const authToken = await prisma.authToken.findUnique({ where: { tokenValue: token } })

            if(!user){
                res.status(404).json({ message: "User account not found." });
                return
            }

            if(!authToken){
                res.status(401).json({ error: "Unauthorized: Token revoked" });
                return
            }
    
            if(!user.verificationStatus){
                res.status(403).json({ message: "User account is not activated!" });
                return
            }
            
            if (decoded.role !== "mechanic") {
                res.status(403).json({ message: "Forbidden. Mechanic only." });
                return 
            }

            req.user = user; 
     
     
            next();
        } catch (err) {
            res.status(400).json({ message: "Invalid token." });
            return 
        }
    };

}


 
export default mechanicAuthMiddleware;