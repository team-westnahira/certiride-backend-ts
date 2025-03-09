import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

interface AuthRequest extends Request {
    user?: { id: string; email: string };
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Access denied, token missing" });
    }

    const token = authHeader.split(" ")[1]; // Extract token after 'Bearer '

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string };
        req.user = decoded; // Attach decoded user info to request
        next();
    } catch (err) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};

export default authMiddleware;