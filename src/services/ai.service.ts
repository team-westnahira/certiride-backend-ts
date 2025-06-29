import client from '../config/openai';
import { UserFileExtractedType } from '../types';

export const extractVehicleCertificateDocumentData = async (data: string) => {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content:
          `Analyze the extracted text from a Sri Lankan vehicle registration certificate and return a structured JSON object with the following fields: vehicle_registration_number (WP ABC-1234), owner_name, chassis_number, engine_number, vehicle_make, vehicle_model, year_of_manufacture, fuel_type (Petrol, Diesel, Electric, Hybrid), date_of_registration (YYYY-MM-DD), vehicle_class, seating_capacity, engine_capacity_cc, previous_owners_count (if available), province, district, authenticity_score (0-1). Extract details from the given text and determine the authenticity score whether this data belongs
        to a real sri lankan vehicle registration certificate
        (only the JSON string. remove unnessesory \`\`\` json characters ).
        ` + data,
      },
    ],
  });
  return completion.choices[0].message.content;
};

export const extractDiagnosticReportData = async (data: string) => {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content:
          `Analyze the extracted text from a vehicle diagnostic report and return a structured JSON object with the following fields: diagnostic_date , time, system_checks : {system_name: string; condition: string; detail: string;}  authenticity_score (0-1). Extract details from the given text and determine the authenticity score whether this data belongs
        to a real vehicle diagnostic report. if system check is fine set condition to normal. otherwise set it to issue. Diagnostic report should include diagnostic report as a text and some other related text. If you think extracted data is not belongs to a real vehicle diagnostic report, give authenticity value a low one (0.3).
        (only the JSON string. remove unnessesory \`\`\` json characters ).
        ` + data,
      },
    ],
  });
  return completion.choices[0].message.content;
};

export const extractInvoiceData = async (data: string) => {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content:
          `
          You are an expert invoice parsing engine. Extract the following fields from a scanned invoice string and return structured JSON object with the following fields:
          invoice_number invoice_date( invoice_date should be in this format - YYYY-MM-DD) items (array of: item_id, description, quantity (round the quantity to nearest integer), unit_cost, total_cost) sub_total discount tax total payment_status remarks current_mileage chassis no and  authenticity_score. Include all fields, even if data is missing. Also include an "authenticity_score" between 0 and 1 based on confidence in data validity (make sure it is a invoice. if it is any other doc, lower the score).  (only the JSON string. remove unnessesory \`\`\` json characters ).
        ` + data,
      },
    ],
  });
  return completion.choices[0].message.content;
};

export const analyzeVehicleDocument = async (data: string) => {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content:
          `
            You are given the extracted text from an uploaded document related to a vehicle. Your task is to:
            1. Identify the document type. Possible types include: "Revenue License", "Emission Certificate", "Insurance Card", "Diagnostic Report", or "Unknown".
            2. Return a structured JSON object with the following format:

            {
              "document_type": "Revenue License" | "Emission Certificate" | "Insurance Card" | "Diagnostic Report" | "Unknown",
              "fields": {
                // Key-value pairs depending on the document type
              },
              "authenticity_score": 0.0 to 1.0 // Estimate how likely this is a genuine, valid document of that type
            }

            Examples of fields to extract based on type:

            - Revenue License: license_number, issued_date, expiry_date, vehicle_number, issuing_authority
            - Emission Certificate: certificate_number, test_date, expiry_date, vehicle_number, test_center, result
            - Insurance Card: policy_number, insurer_name, insured_name, vehicle_number, valid_from, valid_to
            - Diagnostic Report: diagnostic_date, time, system_checks: [{ system_name, condition, detail }]
            - Unknown: leave fields empty {}

            Set "document_type" to "Unknown" and authenticity_score to a low value (e.g. 0.2) if it doesn’t match any known format.

            Return only a valid JSON string. Do not include explanations or markdown formatting.

            Text to analyze:
          ` + data,
      },
    ],
  });

  const obj: UserFileExtractedType = JSON.parse(completion.choices[0].message.content || '') || {};
  return obj;
};
