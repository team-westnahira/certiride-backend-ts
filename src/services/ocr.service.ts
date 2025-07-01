import axios from 'axios';
import fs from 'fs';

const endpoint = 'https://certiride-ocr-form-reader.cognitiveservices.azure.com/';
const apiKey = process.env.Document_Intelligence_API_KEY || '';

const analyzeDocument = async (filePath: string) => {
  const modelId = 'prebuilt-receipt';
  const url = `${endpoint}/formrecognizer/documentModels/${modelId}:analyze?api-version=2023-07-31`;

  const fileBuffer = fs.readFileSync(filePath);

  try {
    const response = await axios.post(url, fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });

    const operationLocation = response.headers['operation-location'];
    let results;

    do {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      results = await axios.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      });
    } while (results.data.status === 'running');

    if (results.data.status === 'succeeded') {
      return results.data.analyzeResult;
    } else {
      return undefined;
    }
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    return undefined;
  }
};

export const analyzeDocumentInMemory = async (fileBuffer: Buffer) => {
  const modelId = 'prebuilt-receipt';
  const url = `${endpoint}/formrecognizer/documentModels/${modelId}:analyze?api-version=2023-07-31`;

  try {
    const response = await axios.post(url, fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    });

    const operationLocation = response.headers['operation-location'];
    if (!operationLocation) throw new Error('No operation-location returned');

    let results;

    // Poll for results
    do {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      results = await axios.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
        },
      });
    } while (results.data.status === 'running' || results.data.status === 'notStarted');

    if (results.data.status === 'succeeded') {
      return results.data.analyzeResult;
    } else {
      console.error('Analysis failed:', results.data);
      return undefined;
    }
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
    return undefined;
  }
};

export default analyzeDocument;
