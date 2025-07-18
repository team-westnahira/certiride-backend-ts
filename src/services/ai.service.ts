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


export const extractVehicleCertificateDetailedData = async (data: string): Promise<{
  vin: string;
  manufacture: string;
  model: string;
  year: string;
  color: string;
  engineCapacity: string;
  province: string;
  fuelType: string;
}> => {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content:
          `
          You are an expert data extractor. Your task is to analyze a block of text obtained using OCR from a Sri Lankan Vehicle Registration Certificate and extract specific details. The input text may have inconsistent formatting or OCR artifacts, but you must still do your best to extract the correct values.
          Your goal is to extract the following fields:
          "vin": Vehicle Identification Number. Usually a combination of letters and numbers (e.g., LA350S-0001197).
          "manufacture": The manufacturer of the vehicle (e.g., Toyota, Nissan, Suzuki).
          "model": The model name of the vehicle (e.g., Alto, Vitz, Axio).
          "year": Year of manufacture or registration (e.g., 2015).
          "color": The registered color of the vehicle (e.g., White, Red, Silver).
          "engineCapacity": The engine capacity in cc (e.g., 658cc, 1500cc). Return just the number (e.g., 658).
          "province": The issuing province (e.g., Western, Central, Southern).
          "fuelType": Type of fuel used (e.g., Petrol, Diesel, Electric, Hybrid).
          
          Instructions:
          Output only a valid JSON string with those exact fields.
          If a field is missing or unreadable, return an empty string ("") for that field.
          Clean up OCR errors (e.g., extra spaces, broken words) as best as possible.
          Do not include any additional commentary or explanation — only the JSON.
          ` + data,
      },
    ],
  });
  if (!completion.choices || completion.choices.length === 0) {
    throw new Error('No completion choices returned from OpenAI API');
  }
  return JSON.parse(completion.choices[0].message.content || '') as {
    vin: string;
    manufacture: string;
    model: string;
    year: string;
    color: string;
    engineCapacity: string;
    province: string;
    fuelType: string;
  };
}




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
          invoice_number invoice_date( invoice_date should be in this format - YYYY-MM-DD) items (array of: item_id, description, quantity (round the quantity to nearest integer),
          unit_cost, total_cost) sub_total discount tax total payment_status remarks current_mileage chassis no and  authenticity_score.
          Include all fields, even if data is missing.
          also include notes field where it says small description about what has been done in the invoice. (e.g. "Oil change and filter replacement, tire rotation, brake inspection")
          Also include an "authenticity_score" between 0 and 1 based on confidence in data validity (make sure it is a invoice. if it is any other doc, lower the score). 
          (only the JSON string. remove unnessesory \`\`\` json characters ).
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
            1. Identify the document type. Possible types include: "Revenue License", "Emission Certificate", "Insurance Card", "Diagnostic Report", or "Unknown" (There maybe aother formats... but all of those other formats should fall into Unknown format).
            3. If you find any other documents. categorized it as a unknown document.
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
            Make sure to analyze the given text and correctly identify the type. If you have any difficulty in identifiying it. Just return the type Unknown
            Return only a valid JSON string. Do not include explanations or markdown formatting.

            only categorize the file if type is present in the ocr text

            Text to analyze:
          ` + data,
      },
    ],
  });

  const obj: UserFileExtractedType = JSON.parse(completion.choices[0].message.content || '') || {};
  return obj;
};

export const extractSriLankanNIC = async (text: string) => {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: `
Given the following OCR-extracted text from the front side of a Sri Lankan National Identity Card (NIC), extract only the NIC number.

A valid NIC number is:
- New format: exactly 12 digits (e.g., 200024300415)
- Old format: exactly 9 digits followed by either 'V' or 'X' (e.g., 902341234V)

Return only the NIC number, with no extra words or symbols or extra white spaces. If no valid NIC is found, return: null

Text:
${text}
        `.trim(),
      },
    ],
  });

  return completion.choices[0].message.content?.trim();
};
