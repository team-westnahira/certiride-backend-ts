import { Admin, Mechanic, VehicleOwner } from "@prisma/client";
import express, { Request } from "express";

export type VehicleRegistrationData = {
    vehicle_registration_number: string;
    owner_name: string;
    chassis_number: string;
    engine_number: string;
    vehicle_make: string;
    vehicle_model: string;
    year_of_manufacture: number;
    fuel_type: "Petrol" | "Diesel" | "Electric" | "Hybrid";
    date_of_registration: string;
    vehicle_class: string;
    seating_capacity: number;
    engine_capacity_cc: number;
    previous_owners_count?: number;
    province?: string;
    district?: string;
    authenticity_score: number;
};

export type DiagnosticReportData = {
    diagnostic_date: string;
    time: string;
    system_checks: { system_name: string; condition: string; detail: string }[];
    authenticity_score: number;
};


export type InvoiceData = {
    invoice_number: string;
    invoice_date: string;
    items: {
        item_id: string;
        description: string;
        quantity: number;
        unit_cost: number;
        total_cost: number;
    }[];
    sub_total: number;
    discount: number;
    tax: number;
    total: number;
    payment_status: string;
    remarks: string;
    authenticity_score: number;
    current_mileage: number;
    chassis_no: string;
}


export interface AuthenticatedMechanicRequest extends Request {
    user?: Mechanic
}

export interface AuthenticatedAdminRequest extends Request {
    user?: Admin
}

export interface AuthenticatedVehicleOwnerRequest extends Request {
    user?: VehicleOwner
}