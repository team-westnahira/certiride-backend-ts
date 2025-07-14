import { Router , Response } from "express";
import mechanicAuthMiddleware from "../../middleware/mechanic.middleware";
import { AuthenticatedMechanicRequest, InvoiceData } from "../../types";
import { z } from "zod";
import prisma from "../../config/prisma";
import axiosInstance from "../../config/axios";
import { commonFileUploadChecker, commonHashChecker, commonInteractionChecker } from "../../services/interaction.service";
import { VehicleBlockChainModel } from "../../models/vehicle.model";
import { ServiceInvoiceBlockChainModel, VehicleInteractionBlockChainModel } from "../../models/interaction.model";
import fileUpload from "express-fileupload";
import analyzeDocument from "../../services/ocr.service";
import { extractInvoiceData } from "../../services/ai.service";
import { getDocumentHash } from "../../services/hash.service";
import fs from "fs";
import { VehicleOwner } from "@prisma/client";
import dotenv from 'dotenv';
import { AttachmentBlockChainModel } from "../../models/attachment.model";
import { randomUUID } from "crypto";
dotenv.config();
const appendix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';

const router = Router();

router.post('/add-invoice' , mechanicAuthMiddleware() , async (req:AuthenticatedMechanicRequest , res:Response) => {
    
    if (!req.headers["content-type"]?.includes("multipart/form-data")) {
        res.status(400).json({ message: "Invalid content type. Use multipart/form-data." });
        return 
    }

    const newInvoiceSchema = z.object({
        vehicle_id: z.string().min(1, "Vehicle ID is required"),
        interaction_id: z.string().min(1, "Interaction ID is required"),
        invoice_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
            message: "Invalid date format",
        }),
        total_cost: z.string().min(1, "Total cost is required").refine((val) => !isNaN(Number(val)), {
            message: "Total cost must be a number",
        }),
    });

    const parsedData = newInvoiceSchema.safeParse(req.body);

    if (!parsedData.success) {
        res.status(400).json({
            error: "Validation failed",
            issues: parsedData.error.errors,
        });
        return
    }

    const { interaction_id, invoice_date, total_cost , vehicle_id } = parsedData.data;
    let filePath = '';
    const file = req.files?.registrationCertificate as fileUpload.UploadedFile;

    let data: {
        interaction: VehicleInteractionBlockChainModel;
        vehicleChainData: VehicleBlockChainModel;
        vehicleOwner: VehicleOwner
    };

    try{
        data = await commonInteractionChecker(req , interaction_id , vehicle_id)
        filePath = await commonFileUploadChecker(file)
    }catch(err){
        console.log('passed')
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(400).json({ message: errorMessage });
        return
    }
    file.mv(filePath, async (err:any) => {
        if (err) {
            res.status(500).json({ message: "Error saving file", error: err });
            return
        }

        const result = await analyzeDocument(filePath)
        const hash = getDocumentHash(result.content)
        
        try{
            await commonHashChecker(result , filePath)
        }catch(err){
            const errorMessage = err instanceof Error ? err.message : String(err);
            res.status(400).json({ 
                message: errorMessage, 
            });
            return
        }

        const extractedData = await extractInvoiceData(result.content)
        if(extractedData === null){
            res.status(400).json({ message: "Error extracting invoice data from the document." });
            return;
        }

        const invoice:InvoiceData = JSON.parse(extractedData)
                    
        if(invoice.authenticity_score < 0.7){
            await prisma.fileHash.delete({
                where: { hash: hash },
            });
            res.status(400).json({ message: "The extracted invoice data is not authentic." });
            return;
        }

        if(invoice.chassis_no !== data.interaction.vehicle_id){
            await prisma.fileHash.delete({
                where: { hash: hash },
            });
            res.status(400).json({ message: "The extracted invoice data does not match the vehicle." });
            return;
        }

        if(invoice.total !== +total_cost){
            await prisma.fileHash.delete({
                where: { hash: hash },
            });
            res.status(400).json({ message: "The extracted invoice data does not match the total." });
            return;
        }

        if(invoice.invoice_date !== invoice_date){
            await prisma.fileHash.delete({
                where: { hash: hash },
            });
            res.status(400).json({ message: "The extracted invoice data does not match the date." });
            return;
        }

        const invoiceData:ServiceInvoiceBlockChainModel = {
            invoice_id: interaction_id,
            invoice_number: invoice.invoice_number,
            invoice_date: new Date(invoice_date).toISOString(),
            vehicle_id: data.interaction.vehicle_id,
            mechanic_id: data.interaction.mechanic_id,
            items: invoice.items,
            sub_total: +invoice.sub_total,
            discount: +invoice.discount,
            tax: +invoice.tax,
            total: +invoice.total,
            payment_status: invoice.payment_status,
            remarks: invoice.remarks,
            attachments: [] as AttachmentBlockChainModel[]
        }

        invoiceData.attachments.push({
            attachment_id: randomUUID(),
            attachment_name: `Invoice for ${data.interaction.vehicle_id} `,
            file_name: file.name,
            file_cid: filePath,
            uploaded_date: new Date().toISOString(),
        })

        try{
            await axiosInstance.post('/invoke' , {
                'fn': 'InsertInvoice',
                'args': [
                    data.interaction.interaction_id,
                    data.interaction.vehicle_id,
                    JSON.stringify(invoiceData)
                ],
                username: data.vehicleOwner.nic + appendix,
            })

            res.status(200).json({ 
                message: "Invoice added successfully",
                invoiceData
            });
            return

        }catch(err){
            fs.unlinkSync(filePath);
            console.log(err)
            res.status(500).json({ message: "Internal server error. Could not add diagnostic report." });
            return
        }

    })
    
})


export default router;