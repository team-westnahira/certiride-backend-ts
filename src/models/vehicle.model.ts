import { AttachmentBlockChainModel } from "./attachment.model";
import { VehicleInteractionBlockChainModel } from "./interaction.model";

export type OwnershipTransfer = {
  transfer_id: string;
  vin: string;
  from_owner_cid: string;
  to_owner_cid: string;
  from_owner_id: string;
  to_owner_id: string;
  transfer_date: string;
  transfer_reason: string;
  attachments: AttachmentBlockChainModel[];
  status: "pending" | "approved" | "rejected" | string;
  responded_date: string;
};

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
    attachments: AttachmentBlockChainModel[];
    owner_history: OwnershipTransfer[];
}



