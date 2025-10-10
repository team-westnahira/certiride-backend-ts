
export const sampleInvoice = {
  invoice_id: "inv_001",
  invoice_number: "INV-2025-0001",
  invoice_date: "2025-10-01",
  vehicle_id: "VEH-1234",
  mechanic_id: "MECH-5678",
  items: [
    {
      item_id: "item_01",
      description: "Engine oil replacement",
      quantity: 1,
      unit_price: 50,
      total_price: 50,
    },
    {
      item_id: "item_02",
      description: "Brake pad replacement",
      quantity: 4,
      unit_price: 25,
      total_price: 100,
    },
  ],
  sub_total: 150,
  discount: 10,
  tax: 14,
  total: 154,
  payment_status: "PAID",
  remarks: "Routine maintenance service",
  attachments: [
    { file_id: "att_001", file_name: "invoice-scan.pdf", url: "https://example.com/invoice-scan.pdf" },
  ],
};

export const sampleServiceRecord = {
  record_id: "sr_001",
  vin: "1HGCM82633A123456",
  service_date: "2025-09-25",
  mechanic_id: "MECH-5678",
  is_on_time: true,
  mileage: 45200,
  service_type: "Full Service",
  description: "Performed full maintenance check and oil change.",
  cost: 154,
  attachments: [
    { file_id: "att_002", file_name: "report.pdf", url: "https://example.com/report.pdf" },
  ],
};

export const sampleInteraction = {
  interaction_id: "int_001",
  vehicle_id: "VEH-1234",
  mechanic_id: "MECH-5678",
  interaction_date: "2025-09-30",
  interaction_type: "Service",
  status: "Completed",
  mileage: 45200,
  service_record: sampleServiceRecord,
  accident_repair_record: {
    record_id: "ar_001",
    accident_date: "2025-08-10",
    description: "Front bumper replacement due to collision",
    cost: 600,
    attachments: [],
  },
  troubleshoot_repair_record: {
    record_id: "tr_001",
    issue: "Engine overheating",
    solution: "Replaced radiator and coolant",
    cost: 250,
    attachments: [],
  },
  maintenance_checklist: {
    record_id: "mc_001",
    checks: [
      { item: "Oil Level", status: "OK" },
      { item: "Brakes", status: "Replaced" },
      { item: "Tires", status: "OK" },
    ],
  },
  diagnostic_report: {
    report_id: "dr_001",
    summary: "No major issues found",
    error_codes: [],
  },
  invoice: sampleInvoice,
  additional_info: { note: "Customer satisfied" },
  created_at: "2025-10-01T08:00:00Z",
};
