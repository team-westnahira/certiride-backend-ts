import client from '../config/openai'

export const extractVehicleCertificateDocumentData = async (data:string) => {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Analyze the extracted text from a Sri Lankan vehicle registration certificate and return a structured JSON object with the following fields: vehicle_registration_number (WP ABC-1234), owner_name, chassis_number, engine_number, vehicle_make, vehicle_model, year_of_manufacture, fuel_type (Petrol, Diesel, Electric, Hybrid), date_of_registration (YYYY-MM-DD), vehicle_class, seating_capacity, engine_capacity_cc, previous_owners_count (if available), province, district, authenticity_score (0-1). Extract details from the given text and determine the authenticity score whether this data belongs
        to a real sri lankan vehicle registration certificate
        (only the JSON string. remove unnessesory \`\`\` json characters ).
        ` + data,
      },
    ],
  });
  return completion.choices[0].message.content
}


export const extractDiagnosticReportData =  async (data:string) => {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Analyze the extracted text from a vehicle diagnostic report and return a structured JSON object with the following fields: diagnostic_date , time, system_checks : {system_name: string; condition: string; detail: string;}  authenticity_score (0-1). Extract details from the given text and determine the authenticity score whether this data belongs
        to a real vehicle diagnostic report. if system check is fine set condition to normal. otherwise set it to issue. Diagnostic report should include diagnostic report as a text and some other related text. If you think extracted data is not belongs to a real vehicle diagnostic report, give authenticity value a low one (0.3).
        (only the JSON string. remove unnessesory \`\`\` json characters ).
        ` + data,
      },
    ],
  });
  return completion.choices[0].message.content
}