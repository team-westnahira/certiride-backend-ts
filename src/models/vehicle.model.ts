import { AttachmentBlockChainModel } from "./attachment.model";
import { VehicleInteractionBlockChainModel } from "./interaction.model";

export type VehicleBlockChainModel = {
    vin: string;
    owner: string;
    manufacturer: string;
    model: string;
    year: number;
    color: string;
    engine_capacity: string;
    province: string;
    fuel_type: string;
    interaction: VehicleInteractionBlockChainModel[];
    attachments: AttachmentBlockChainModel[]
    // inspections: string;
}



