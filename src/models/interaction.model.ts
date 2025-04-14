import { AttachmentBlockChainModel } from "./attachment.model";

export type VehicleInteractionBlockChainModel = {
    interaction_id: string;
    vehicle_id: string;
    mechanic_id: string;
    interaction_date: string;
    interaction_type: string;
    mileage: number;

    service_record: ServiceRecordBlockChainModel | null;
    accident_repair_record: AccidentRepairRecord | null;
    troubleshoot_repair_record: TroubleshootRepairRecord | null;
    maintenance_checklist: MaintenanceChecklist | null;
    diagnostic_report: DiagnosticReportBlockChainModel | null;
    invoice: any;
    additional_info: string | null;
    created_at: Date;
}

export type ServiceRecordBlockChainModel = {
	record_id: string;
	vin: string;
	service_date: Date;
	mechanic_id: string;
    is_on_time: boolean;
	mileage: number;
	service_type: string;
	description: string;
	cost: number;
	attachments: AttachmentBlockChainModel[]
}

export type TroubleshootRepairRecord = {
    record_id: string;
    vin: string;
    troubleshoot_date: Date;
    repair_date: Date;
    diagnostic_details: string;
    repair_description: string;
    parts_used: string[];
    repair_cost: number;
    mechanic_id: string;
    is_resolved: boolean;
    attachments: AttachmentBlockChainModel[];
    note: string;
};

export type MaintenanceChecklistItem = {
    itemName: string;
    condition: 'adjusted' | 'checked' | 'problem' | 'clean' | 'replace';
    comments: string;
};

export type MaintenanceChecklist = {
    checklist_id: string;
    vehicle_id: string;
    mechanic_id: string;
    date_of_inspection: string;
    vehicle_power_type: string;
    odometer_reading: number;
    next_service_mileage: number;
    items: MaintenanceChecklistItem[];
    service_type: string;
    remarks: string;
    attachments: AttachmentBlockChainModel[];
};


export type AccidentRepairRecord = {
    record_id: string;
    vin: string;
    accident_date: string;
    description: string;
    severity_rating: number;
    repair_details: string;
    cost: number;
    attachments: AttachmentBlockChainModel[];
};


export type DiagnosticSystemCheckBlockChainModel = {
    system_name: string;
    condition: string;
    detail: string;
};

export type DiagnosticReportBlockChainModel = {
    report_id: string;
    vin: string;
    mechanic_id: string;
    diagnostic_date: string;
    observations: string;
    system_checks: DiagnosticSystemCheckBlockChainModel[];
    attachments: AttachmentBlockChainModel[];
};