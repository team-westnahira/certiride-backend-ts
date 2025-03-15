import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

interface AdminRequest extends Request {
    user?: { id: string; email: string; role?: string }; // Add role if needed
}

const adminMiddleware = (req: AdminRequest, res: Response, next: NextFunction) => {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1]; // Extract the token

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; email: string; role?: string };
        req.user = decoded; // Store user info in request object

        // Optional: Check if user is an admin
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Forbidden. Admins only." });
        }

        next(); // Move to the next middleware/route
    } catch (err) {
        return res.status(400).json({ message: "Invalid token." });
    }
};

export default adminMiddleware;
