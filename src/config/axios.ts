import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://13.126.53.29:3333',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }
});

export default axiosInstance;