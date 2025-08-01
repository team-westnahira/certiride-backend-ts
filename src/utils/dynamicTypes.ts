import { AccidentRepairRecord, ServiceRecordBlockChainModel, TroubleshootRepairRecord } from "../models/interaction.model";

export const interactionFieldMap: Record<string, string[]> = {
  service_record: [
    'record_id',
    'vin',
    'service_date',
    'mechanic_id',
    'is_on_time',
    'mileage',
    'service_type',
    'description',
    'cost',
    'attachments'
  ],
  accident_repair_record: [
    'record_id',
    'vin',
    'accident_date',
    'description',
    'severity_rating',
    'repair_details',
    'cost',
    'attachments'
  ],
  troubleshoot_repair_record: [
    'record_id',
    'vin',
    'troubleshoot_date',
    'repair_date',
    'diagnostic_details',
    'repair_description',
    'parts_used',
    'repair_cost',
    'mechanic_id',
    'is_resolved',
    'attachments',
    'note'
  ],
  maintenance_checklist: [
    'checklist_id',
    'vehicle_id',
    'mechanic_id',
    'date_of_inspection',
    'vehicle_power_type',
    'odometer_reading',
    'next_service_mileage',
    'items',
    'service_type',
    'remarks',
    'attachments'
  ],
  diagnostic_report: [
    'report_id',
    'vin',
    'mechanic_id',
    'diagnostic_date',
    'observations',
    'system_checks',
    'attachments'
  ],
  invoice: [
    'invoice_id',
    'invoice_number',
    'invoice_date',
    'vehicle_id',
    'mechanic_id',
    'items',
    'sub_total',
    'discount',
    'tax',
    'total',
    'payment_status',
    'remarks',
    'attachments'
  ]
};




export const buildReleventInteractionType = (detectedType:string , extractedFieldJson:string) => {
    
    if(detectedType === 'service_record'){
        return JSON.parse(extractedFieldJson) as ServiceRecordBlockChainModel
    }else if (detectedType === 'accident_repair_record'){
        return JSON.parse(extractedFieldJson) as AccidentRepairRecord
    }else if(detectedType === 'troubleshoot_repair_record'){
        return JSON.parse(extractedFieldJson) as TroubleshootRepairRecord
    }else{
        return undefined
    }
    
}


export const isServiceRecordBlockChainModel = (record: any): record is ServiceRecordBlockChainModel => {
  return (
    record &&
    typeof record === 'object' &&
    'service_date' in record &&
    'mechanic_id' in record &&
    'is_on_time' in record &&
    'mileage' in record &&
    'service_type' in record
  );
}

