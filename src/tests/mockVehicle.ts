import { VehicleBlockChainModel } from "../models/vehicle.model";
import { VehicleInteractionBlockChainModel } from "../models/interaction.model";

export const mockVehicle: VehicleBlockChainModel = {
    vin: "1HGCM82633A004352",
    manufacturer: "Toyota",
    model: "Corolla",
    year: 2022,
    owner: "owner123",
    interaction: generateMockInteractions(),
    color: "red",
    engine_capacity: "600cc",
    province: "Western Province",
    fuel_type: "Petrol",
    attachments: []
};

function generateMockInteractions(): VehicleInteractionBlockChainModel[] {
  return [
    {
      interaction_id: "int001",
      vehicle_id: "1HGCM82633A004352",
      mechanic_id: "mech001",
      interaction_date: "2021-01-15",
      interaction_type: "service",
      mileage: 4800,
      service_record: {
        record_id: "sr001",
        vin: "1HGCM82633A004352",
        service_date: new Date("2021-01-15"),
        mechanic_id: "mech001",
        is_on_time: true,
        mileage: 4800,
        service_type: "Oil Change",
        description: "Basic oil change and inspection",
        cost: 75,
        attachments: []
      },
      accident_repair_record: null,
      troubleshoot_repair_record: null,
      maintenance_checklist: null,
      diagnostic_report: null,
      invoice: null,
      additional_info: null,
      created_at: new Date("2021-01-15")
    },
    {
      interaction_id: "int002",
      vehicle_id: "1HGCM82633A004352",
      mechanic_id: "mech002",
      interaction_date: "2021-08-20",
      interaction_type: "service",
      mileage: 10300,
      service_record: {
        record_id: "sr002",
        vin: "1HGCM82633A004352",
        service_date: new Date("2021-08-20"),
        mechanic_id: "mech002",
        is_on_time: true,
        mileage: 10300,
        service_type: "Tire Rotation",
        description: "Rotated tires and replaced front pads",
        cost: 150,
        attachments: []
      },
      accident_repair_record: null,
      troubleshoot_repair_record: null,
      maintenance_checklist: null,
      diagnostic_report: null,
      invoice: null,
      additional_info: null,
      created_at: new Date("2021-08-20")
    },
    {
      interaction_id: "int003",
      vehicle_id: "1HGCM82633A004352",
      mechanic_id: "mech003",
      interaction_date: "2022-03-10",
      interaction_type: "service",
      mileage: 15800,
      service_record: {
        record_id: "sr003",
        vin: "1HGCM82633A004352",
        service_date: new Date("2022-03-10"),
        mechanic_id: "mech003",
        is_on_time: true,
        mileage: 15800,
        service_type: "Brake Inspection",
        description: "Full brake inspection",
        cost: 100,
        attachments: []
      },
      accident_repair_record: null,
      troubleshoot_repair_record: null,
      maintenance_checklist: null,
      diagnostic_report: null,
      invoice: null,
      additional_info: null,
      created_at: new Date("2022-03-10")
    },
    {
      interaction_id: "int004",
      vehicle_id: "1HGCM82633A004352",
      mechanic_id: "mech004",
      interaction_date: "2023-01-05",
      mileage: 20900,
      interaction_type: "service",
      service_record: {
        record_id: "sr004",
        vin: "1HGCM82633A004352",
        service_date: new Date("2023-01-05"),
        mechanic_id: "mech004",
        is_on_time: true,
        mileage: 20900,
        service_type: "Full Service",
        description: "Full service and diagnostics",
        cost: 250,
        attachments: []
      },
      accident_repair_record: null,
      troubleshoot_repair_record: null,
      maintenance_checklist: null,
      diagnostic_report: null,
      invoice: null,
      additional_info: null,
      created_at: new Date("2023-01-05")
    },
    {
      interaction_id: "int005",
      vehicle_id: "1HGCM82633A004352",
      mechanic_id: "mech005",
      interaction_date: "2024-02-18",
      mileage: 26500,
      interaction_type: "service",
      service_record: {
        record_id: "sr005",
        vin: "1HGCM82633A004352",
        service_date: new Date("2024-02-18"),
        mechanic_id: "mech005",
        is_on_time: false,
        mileage: 26500,
        service_type: "AC Check",
        description: "Checked and cleaned AC filters",
        cost: 90,
        attachments: []
      },
      accident_repair_record: null,
      troubleshoot_repair_record: null,
      maintenance_checklist: null,
      diagnostic_report: null,
      invoice: null,
      additional_info: null,
      created_at: new Date("2024-02-18")
    }
  ];
}
