import request from 'supertest';
import app from '../server'; // your Express app
import prisma from '../config/prisma';
import fs from 'fs';
import path from 'path';

jest.mock('../services/ai.service', () => ({
  extractVehicleCertificateDocumentData: jest.fn().mockResolvedValue(
    JSON.stringify({
      authenticity_score: 0.95,
      chassis_number: '1234567890VIN'
    })
  )
}));

jest.mock('../services/ocr.service', () => ({
  default: jest.fn().mockResolvedValue({ content: 'mocked content' })
}));

jest.mock('../config/axios', () => ({
  default: {
    post: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({ data: { data: { blockchain: true } } })
  }
}));

const testUserToken = 'mockedToken';
const mockUser = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  nic: '123456789V'
};

jest.mock('../middleware/vehicleOwner.middleware', () => () => (req: { user: { id: number; firstName: string; lastName: string; nic: string; }; }, res: any, next: () => void) => {
  req.user = mockUser;
  next();
});

describe('Vehicle Controller', () => {
  describe('POST /add-new-vehicle', () => {
    it('should return 400 if no file is uploaded', async () => {
      const res = await request(app)
        .post('/vehicle/add-new-vehicle')
        .set('Content-Type', 'multipart/form-data')
        .field('vin', '1234567890VIN')
        .field('manufacture', 'Toyota')
        .field('model', 'Corolla')
        .field('year', '2020')
        .field('color', 'Blue')
        .field('engineCapacity', '1500')
        .field('province', 'Central')
        .field('fuelType', 'Petrol')
        .field('initialMilage', '10000');

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Vehicle Certification File is required');
    });

    it('should return 201 when a valid vehicle is added', async () => {
      const res = await request(app)
        .post('/vehicle/add-new-vehicle')
        .set('Content-Type', 'multipart/form-data')
        .field('vin', '1234567890VIN')
        .field('manufacture', 'Toyota')
        .field('model', 'Corolla')
        .field('year', '2020')
        .field('color', 'Blue')
        .field('engineCapacity', '1500')
        .field('province', 'Central')
        .field('fuelType', 'Petrol')
        .field('initialMilage', '10000')
        .attach('registrationCertificate', path.join(__dirname, 'mockImage.jpg'));

      expect(res.status).toBe(201);
      expect(res.body.vehicle).toHaveProperty('vin');
    });
  });

  describe('GET /get-user-vehicles', () => {
    it('should return vehicles of the user', async () => {
      const res = await request(app)
        .get('/vehicle/get-user-vehicles');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('vehicles');
    });
  });

  describe('GET /get-vehicle-full-data', () => {
    it('should return vehicle data', async () => {
      const res = await request(app)
        .get('/vehicle/get-vehicle-full-data')
        .query({ vin: '1234567890VIN' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('vehicleOverviewData');
      expect(res.body).toHaveProperty('fullDetails');
    });
  });

  describe('GET /generate-certificate', () => {
    it('should generate PDF certificate for vehicle', async () => {
      const res = await request(app)
        .get('/vehicle/generate-certificate')
        .query({ vin: '1234567890VIN' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });
  });
});
