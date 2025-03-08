import express from "express";
import prisma from "../config/prisma";
import { addAuditLog } from "../services/auditlog.service";

const router = express.Router();

router.get('/get-all', async (req, res) => {
        
    try {
        
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const skip = (page - 1) * limit;

        
        const data = await prisma.auditLog.findMany({
            skip,
            take: limit,
            orderBy: {
                eventId: 'desc',
            },
        });

        const totalCount = await prisma.auditLog.count();

        addAuditLog(1 , "userLogin" , JSON.stringify({
            "userId" : 1,
            "username" : "naveen"
        }))
        
        res.json({
            totalRecords: totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            data,
        });
    
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

});

export default router;