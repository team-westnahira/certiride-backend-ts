import express, { Request, Response } from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import handlebars from "handlebars";
import {sampleInteraction} from '../mock/sample'
import moment from "moment";
import axiosInstance from "../config/axios";
import { AuthenticatedVehicleOwnerRequest } from "../types";
import vehicleOwnerAuthMiddleware from "../middleware/vehicleOwner.middleware";
import { VehicleBlockChainModel } from "../models/vehicle.model";
import { VehicleInteractionBlockChainModel } from "../models/interaction.model";

const router = express.Router();
const appendix = process.env.ENV ? (process.env.ENV === 'dev' ? '_test' : '') : '';


router.get("/service-certificate",  vehicleOwnerAuthMiddleware(), async (req: AuthenticatedVehicleOwnerRequest, res: Response) => {
  try {

    const interactionId = req.query.interaction_id as string
    const vin = req.query.vin as string


    const blockchainResponse = await axiosInstance.get(`/query/GetVehicle/${vin}/${req.user?.nic + appendix}`);
    const fullDetails = blockchainResponse.data.data as VehicleBlockChainModel;
    let interactionData: VehicleInteractionBlockChainModel | null = null;

    for(let i = 0; i < fullDetails.interaction.length; i++){
      if(fullDetails.interaction[i].interaction_id === interactionId){
        interactionData = fullDetails.interaction[i]
      }
    }

    if(!interactionData){
      res.status(400).send("Interaction not found!");
      return
    }

    const templatePath = path.join(__dirname, "../" , "templates", "pdf" ,"service-record-certificate.hbs");
    const templateSource = fs.readFileSync(templatePath, "utf8");

    const template = handlebars.compile(templateSource);
    const html = template({ interaction: interactionData , genTime: moment(new Date()).format("YYYY-MM-DD HH:mm:ss") });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.evaluateHandle('document.fonts.ready');
  
    const imageBuffer = await page.screenshot({
      type: "png",
      fullPage: true,
    });
    await browser.close();

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      "inline; filename=certificate.png"
    );
    res.send(imageBuffer);

    return
  } catch (error) {
    console.error("Error generating certificate:", error);
    res.status(500).send("Error generating certificate");
    return
  }
});

export default router