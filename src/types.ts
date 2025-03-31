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