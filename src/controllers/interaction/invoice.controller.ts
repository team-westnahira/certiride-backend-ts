import { Router , Response } from "express";
import mechanicAuthMiddleware from "../../middleware/mechanic.middleware";
import { AuthenticatedMechanicRequest, AuthenticatedVehicleOwnerRequest, InvoiceData } from "../../types";
import { object, z } from "zod";
import prisma from "../../config/prisma";
import axiosInstance from "../../config/axios";
import { commonFileUploadChecker, commonHashChecker, commonInteractionChecker, commonInteractionCheckerForVehicleOwner, isServiceRecordOnTime } from "../../services/interaction.service";
import { VehicleBlockChainModel } from "../../models/vehicle.model";
import { AccidentRepairRecord, ServiceInvoiceBlockChainModel, ServiceRecordBlockChainModel, TroubleshootRepairRecord, VehicleInteractionBlockChainModel } from "../../models/interaction.model";
import fileUpload from "express-fileupload";
import analyzeDocument from "../../services/ocr.service";
import { detectInteractionType, extractInvoiceData, extractInvoiceFields } from "../../services/ai.service";
import { getDocumentHash } from "../../services/hash.service";
import fs from "fs";
import { VehicleOwner } from "@prisma/client";
import dotenv from 'dotenv';
import { AttachmentBlockChainModel } from "../../models/attachment.model";
import { randomUUID } from "crypto";
import path from "path";
import vehicleOwnerAuthMiddleware from "../../middleware/vehicleOwner.middleware";
import { buildReleventInteractionType, interactionFieldMap, isAccidentRepairRecord, isServiceRecordBlockChainModel, isTroubleShootRepairRecord } from "../../utils/dynamicTypes";

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
        const uploadDir = path.join(__dirname, "../../uploads/vehicles/invoices");
        filePath = await commonFileUploadChecker(file,uploadDir)
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


router.post('/self-add-invoice', vehicleOwnerAuthMiddleware(), async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
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
    mileage: z.string().min(1, "Mileage is required").refine((val) => !isNaN(Number(val)), {
      message: "Mileage must be a number",
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

  const { interaction_id, invoice_date, total_cost, vehicle_id , mileage } = parsedData.data;
  const file = req.files?.invoiceFile as fileUpload.UploadedFile;

  if (!file) {
    res.status(400).json({ message: "Invoice file is required." });
    return
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      vin: vehicle_id,
      ownerId: req.user?.id
    }
  })

  if (!vehicle) {
    res.status(400).json({ message: "Vehicle not found!" });
    return
  }

  let filePath = '';
  let data;

  try {
    data = await commonInteractionCheckerForVehicleOwner(req, interaction_id, vehicle_id);
    if (data.vehicleOwner.id !== req.user?.id) {
      res.status(403).json({ message: "You do not have permission to add invoice to this vehicle." });
      return
    }

    const uploadDir = path.join(__dirname, "../../uploads/vehicles/invoices");
    filePath = await commonFileUploadChecker(file, uploadDir);
  } catch (err) {
    console.log(err)
    res.status(400).json({ message: (err as Error).message });
    return
  }

  file.mv(filePath, async (err: any) => {
    if (err) {
      res.status(500).json({ message: "Error saving file", error: err });
      return
    }

    const result = await analyzeDocument(filePath);
    const hash = getDocumentHash(result.content);

    try {
      await commonHashChecker(result, filePath);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
      return
    }

    const detectedType = await detectInteractionType(result.content);
    
    if (!detectedType || !interactionFieldMap[detectedType]) {
      res.status(400).json({ message: `Unknown or unsupported interaction type: ${detectedType}` });
      return
    }

    const extractedFieldJson = await extractInvoiceFields(detectedType, result.content);

    if (extractedFieldJson === '') {
      res.status(400).json({ message: "Could not extract invoice data using AI." });
      return
    }

    const extracteInvoicedData = await extractInvoiceData(result.content)
    if(extracteInvoicedData === null){
      res.status(400).json({ message: "Error extracting invoice data from the document." });
      return;
    }

    const invoice:InvoiceData = JSON.parse(extracteInvoicedData)

    if (invoice.total !==  +total_cost) {
      await prisma.fileHash.delete({ where: { hash } });
      return res.status(400).json({ message: "Invoice total does not match." });
    }

    if(invoice.current_mileage !== Number(mileage)){
      await prisma.fileHash.delete({ where: { hash } });
      return res.status(400).json({ message: "Invoice mileage does not match." });
    }

    // if (invoice.invoice_date !== invoice_date) {
    //   await prisma.fileHash.delete({ where: { hash } });
    //   return res.status(400).json({ message: "Invoice date does not match." });
    // }

    const invoiceData: ServiceInvoiceBlockChainModel = {
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
      attachments: [
        {
          attachment_id: randomUUID(),
          attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
          file_name: file.name,
          file_cid: filePath,
          uploaded_date: new Date().toISOString(),
        }
      ]
    };

    let record = buildReleventInteractionType(detectedType , extractedFieldJson);

    if(record === undefined){
      await prisma.fileHash.delete({ where: { hash } });
      res.status(400).json({ message: "Certiride was not able to detect the interaction type" });
      return
    }

    const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
    const blockchainResponse = await axiosInstance.get(
      `/query/GetVehicle/${vehicle.vin}/${req.user?.nic + appedix}`
    );

    const interactionData = blockchainResponse.data.data as VehicleBlockChainModel;

    let serviceRecordObject: ServiceRecordBlockChainModel
    let accidentRecordObject: AccidentRepairRecord
    let troubleshootRecordObject: TroubleshootRepairRecord

    if (detectedType === 'service_record') {
      if (isServiceRecordBlockChainModel(record)) {
        serviceRecordObject = record;
        serviceRecordObject.mechanic_id = 'self-add'
        serviceRecordObject.is_on_time = isServiceRecordOnTime(interactionData.interaction , invoiceData.invoice_date , serviceRecordObject.mileage)
        serviceRecordObject.record_id = randomUUID()
        serviceRecordObject.cost = Number(serviceRecordObject.cost)
        serviceRecordObject.service_date = new Date(invoiceData.invoice_date).toISOString()
        // serviceRecordObject.description = "";
        serviceRecordObject.attachments = [
          {
            attachment_id: randomUUID(),
            attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
            file_name: file.name,
            file_cid: filePath,
            uploaded_date: new Date().toISOString(),
          }
        ];

        await axiosInstance.post('/invoke', {
          fn: 'InsertServiceRecord',
          args: [
            data.interaction.interaction_id,
            data.interaction.vehicle_id,
            JSON.stringify(serviceRecordObject),
          ],
          username: data.vehicleOwner.nic + appendix,
        });

      }else if (isAccidentRepairRecord(record)){
        accidentRecordObject = record;
        accidentRecordObject.cost = Number(accidentRecordObject.cost);
        accidentRecordObject.accident_date = new Date(record.accident_date).toISOString();
        accidentRecordObject.record_id = randomUUID();
        accidentRecordObject.attachments = [
          {
            attachment_id: randomUUID(),
            attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
            file_name: file.name,
            file_cid: filePath,
            uploaded_date: new Date().toISOString(),
          }
        ]
        
        await axiosInstance.post('/invoke', {
          fn: 'InsertAccidentRepairReport',
          args: [
            data.interaction.interaction_id,
            data.interaction.vehicle_id,
            JSON.stringify(accidentRecordObject),
          ],
          username: data.vehicleOwner.nic + appendix,
        });
      }else if (isTroubleShootRepairRecord(record)) {
        troubleshootRecordObject = record;
        troubleshootRecordObject.record_id = randomUUID();
        troubleshootRecordObject.mechanic_id = 'self-add';
        troubleshootRecordObject.repair_cost = Number(troubleshootRecordObject.repair_cost);
        troubleshootRecordObject.attachments = [
          {
            attachment_id: randomUUID(),
            attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
            file_name: file.name,
            file_cid: filePath,
            uploaded_date: new Date().toISOString(),
          }
        ]

        await axiosInstance.post('/invoke', {
          fn: 'InsertTroubleshootRepairReport',
          args: [
            data.interaction.interaction_id,
            data.interaction.vehicle_id,
            JSON.stringify(troubleshootRecordObject),
          ],
          username: data.vehicleOwner.nic + appendix,
        });
      }
    }
    
    await prisma.fileHash.delete({ where: { hash } });

    try {
      await axiosInstance.post('/invoke', {
        fn: 'InsertInvoice',
        args: [
          data.interaction.interaction_id,
          data.interaction.vehicle_id,
          JSON.stringify(invoiceData),
        ],
        username: data.vehicleOwner.nic + appendix,
      });

      await axiosInstance.post('/invoke', {
        fn: 'CloseInteraction',
        args: [
          data.interaction.vehicle_id,
          data.interaction.interaction_id,
        ],
        username: data.vehicleOwner.nic + appendix,
      });

      res.status(200).json({
        message: "Invoice added successfully",
        invoiceData,
      });
      return
    } catch (err) {
      fs.unlinkSync(filePath);
      res.status(500).json({ message: "Internal server error. Could not add invoice." });
      return
    }
  });
});


router.post('/add-record-mechanic', mechanicAuthMiddleware(), async (req: AuthenticatedMechanicRequest, res: Response) => {
  if (!req.headers["content-type"]?.includes("multipart/form-data")) {
    res.status(400).json({ message: "Invalid content type. Use multipart/form-data." });
    return 
  }

  const serviceTypeEnum = z.enum(['service_record', 'accident_repair', 'troubleshoot_repair']);

  const newInvoiceSchema = z.object({
    vehicle_id: z.string().min(1, "Vehicle ID is required"),
    interaction_id: z.string().min(1, "Interaction ID is required"),
    invoice_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format",
    }),
    total_cost: z.string().min(1, "Total cost is required").refine((val) => !isNaN(Number(val)), {
      message: "Total cost must be a number",
    }),
    mileage: z.string().min(1, "Mileage is required").refine((val) => !isNaN(Number(val)), {
      message: "Mileage must be a number",
    }),
    description: z.string().min(1, "Description is required"),
    service_type: serviceTypeEnum,
  });

  const parsedData = newInvoiceSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      error: "Validation failed",
      issues: parsedData.error.errors,
    });
    return
  }

  const { interaction_id, invoice_date, total_cost, vehicle_id , mileage, description, service_type } = parsedData.data;
  const file = req.files?.invoiceFile as fileUpload.UploadedFile;

  if (!file) {
    res.status(400).json({ message: "Invoice file is required." });
    return
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      vin: vehicle_id,
    }
  })

  if (!vehicle) {
    res.status(400).json({ message: "Vehicle not found!" });
    return
  }

  const owner = await prisma.vehicleOwner.findUnique({
    where: {
      id: vehicle?.ownerId,
    }
  })

  if(!owner){
    res.status(400).json({ message: "Vehicle owner not found!" });
    return
  }



  let filePath = '';
  let data;

  try {
    data = await commonInteractionChecker(req, interaction_id, vehicle_id);
    const uploadDir = path.join(__dirname, "../../uploads/vehicles/invoices");
    filePath = await commonFileUploadChecker(file, uploadDir);
  } catch (err) {
    console.log(err)
    res.status(400).json({ message: (err as Error).message });
    return
  }

  file.mv(filePath, async (err: any) => {
    if (err) {
      res.status(500).json({ message: "Error saving file", error: err });
      return
    }

    const result = await analyzeDocument(filePath);
    const hash = getDocumentHash(result.content);

    try {
      await commonHashChecker(result, filePath);
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
      return
    }

    // const detectedType = await detectInteractionType(result.content);
    const detectedType = service_type;
    
    if (!detectedType || !interactionFieldMap[detectedType]) {
      res.status(400).json({ message: `Unknown or unsupported interaction type: ${detectedType}` });
      return
    }

    const extractedFieldJson = await extractInvoiceFields(detectedType, result.content);

    if (extractedFieldJson === '') {
      res.status(400).json({ message: "Could not extract invoice data using AI." });
      return
    }

    const extracteInvoicedData = await extractInvoiceData(result.content)
    if(extracteInvoicedData === null){
      res.status(400).json({ message: "Error extracting invoice data from the document." });
      return;
    }

    const invoice:InvoiceData = JSON.parse(extracteInvoicedData)

    if (invoice.total !==  +total_cost) {
      await prisma.fileHash.delete({ where: { hash } });
      return res.status(400).json({ message: "Invoice total does not match." });
    }

    // if(invoice.current_mileage !== Number(mileage)){
    //   await prisma.fileHash.delete({ where: { hash } });
    //   return res.status(400).json({ message: "Invoice mileage does not match." });
    // }

    // if (invoice.invoice_date !== invoice_date) {
    //   await prisma.fileHash.delete({ where: { hash } });
    //   return res.status(400).json({ message: "Invoice date does not match." });
    // }

    const invoiceData: ServiceInvoiceBlockChainModel = {
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
      attachments: [
        {
          attachment_id: randomUUID(),
          attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
          file_name: file.name,
          file_cid: filePath,
          uploaded_date: new Date().toISOString(),
        }
      ]
    };

    let record = buildReleventInteractionType(detectedType , extractedFieldJson);

    if(record === undefined){
      await prisma.fileHash.delete({ where: { hash } });
      res.status(400).json({ message: "Certiride was not able to detect the interaction type" });
      return
    }

    const appedix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';
    const blockchainResponse = await axiosInstance.get(
      `/query/GetVehicle/${vehicle.vin}/${owner?.nic + appedix}`
    );

    const interactionData = blockchainResponse.data.data as VehicleBlockChainModel;

    let serviceRecordObject: ServiceRecordBlockChainModel
    let accidentRecordObject: AccidentRepairRecord
    let troubleshootRecordObject: TroubleshootRepairRecord

    if (detectedType === 'service_record') {
      if (isServiceRecordBlockChainModel(record)) {
        serviceRecordObject = record;
        serviceRecordObject.mechanic_id = req.user?.mechanicId + ''
        serviceRecordObject.is_on_time = isServiceRecordOnTime(interactionData.interaction , invoiceData.invoice_date , serviceRecordObject.mileage)
        serviceRecordObject.record_id = randomUUID()
        serviceRecordObject.cost = Number(serviceRecordObject.cost)
        serviceRecordObject.service_date = new Date(invoiceData.invoice_date).toISOString()
        serviceRecordObject.attachments = [
          {
            attachment_id: randomUUID(),
            attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
            file_name: file.name,
            file_cid: filePath,
            uploaded_date: new Date().toISOString(),
          }
        ];

        await axiosInstance.post('/invoke', {
          fn: 'InsertServiceRecord',
          args: [
            data.interaction.interaction_id,
            data.interaction.vehicle_id,
            JSON.stringify(serviceRecordObject),
          ],
          username: data.vehicleOwner.nic + appendix,
        });

      }else if (isAccidentRepairRecord(record)){
        accidentRecordObject = record;
        accidentRecordObject.cost = Number(accidentRecordObject.cost);
        accidentRecordObject.accident_date = new Date(record.accident_date).toISOString();
        accidentRecordObject.record_id = randomUUID();
        accidentRecordObject.attachments = [
          {
            attachment_id: randomUUID(),
            attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
            file_name: file.name,
            file_cid: filePath,
            uploaded_date: new Date().toISOString(),
          }
        ]
        
        await axiosInstance.post('/invoke', {
          fn: 'InsertAccidentRepairReport',
          args: [
            data.interaction.interaction_id,
            data.interaction.vehicle_id,
            JSON.stringify(accidentRecordObject),
          ],
          username: data.vehicleOwner.nic + appendix,
        });
      }else if (isTroubleShootRepairRecord(record)) {
        troubleshootRecordObject = record;
        troubleshootRecordObject.record_id = randomUUID();
        troubleshootRecordObject.mechanic_id = req.user?.mechanicId + '';
        troubleshootRecordObject.repair_cost = Number(troubleshootRecordObject.repair_cost);
        troubleshootRecordObject.attachments = [
          {
            attachment_id: randomUUID(),
            attachment_name: `Invoice for ${data.interaction.vehicle_id}`,
            file_name: file.name,
            file_cid: filePath,
            uploaded_date: new Date().toISOString(),
          }
        ]

        await axiosInstance.post('/invoke', {
          fn: 'InsertTroubleshootRepairReport',
          args: [
            data.interaction.interaction_id,
            data.interaction.vehicle_id,
            JSON.stringify(troubleshootRecordObject),
          ],
          username: data.vehicleOwner.nic + appendix,
        });
      }
    }
    
    await prisma.fileHash.delete({ where: { hash } });

    try {
      await axiosInstance.post('/invoke', {
        fn: 'InsertInvoice',
        args: [
          data.interaction.interaction_id,
          data.interaction.vehicle_id,
          JSON.stringify(invoiceData),
        ],
        username: data.vehicleOwner.nic + appendix,
      });

      await axiosInstance.post('/invoke', {
        fn: 'CloseInteraction',
        args: [
          data.interaction.vehicle_id,
          data.interaction.interaction_id,
        ],
        username: data.vehicleOwner.nic + appendix,
      });

      res.status(200).json({
        message: "Invoice added successfully",
        invoiceData,
      });
      return
    } catch (err) {
      fs.unlinkSync(filePath);
      res.status(500).json({ message: "Internal server error. Could not add invoice." });
      return
    }
  });
});






export default router;