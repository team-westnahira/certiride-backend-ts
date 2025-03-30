import axios from 'axios';

const gooseAPI = axios.create({
  baseURL: 'https://api.goose.ai/v1',
  headers: {
    'Authorization': `Bearer ${process.env.GOOSE_AI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export default gooseAPI;