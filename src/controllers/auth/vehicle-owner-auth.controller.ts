import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../config/prisma';
import { generateOtp } from '../../utils/otpGenerator';
import { VehicleOwner } from '@prisma/client';
import vehicleOwnerAuthMiddleware from '../../middleware/vehicleOwner.middleware';
import axiosInstance from '../../config/axios';
import { analyzeDocumentInMemory } from '../../services/ocr.service';
import { extractSriLankanNIC } from '../../services/ai.service';

interface AuthenticatedRequest extends Request {
  user?: VehicleOwner;
}

dotenv.config();
const router = express.Router();
const sriLankanNICRegex = /^(?:\d{9}[VX]|\d{12})$/;

router.post('/register', async (req: Request, res: Response) => {
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    res.status(400).json({ message: 'Invalid content type. Use multipart/form-data.' });
    return;
  }

  try {
    const vehicleOwnerRegisterSchema = z.object({
      firstName: z.string().min(1, 'First name is required'),
      lastName: z.string().min(1, 'Last name is required'),
      address: z.string().min(1, 'Address is required'),
      phone: z.string().min(10, 'Phone number must be at least 10 digits'),
      nic: z
        .string()
        .min(10, 'NIC must be at least 10 characters long')
        .max(12, 'NIC must be at most 12 characters long')
        .regex(sriLankanNICRegex, 'Invalid Sri Lankan NIC format'),
      email: z.string().email('Invalid email address'),
      password: z.string().min(6, 'Password must be at least 6 characters long'),
    });

    const parsedData = vehicleOwnerRegisterSchema.safeParse(req.body);

    if (!parsedData.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: parsedData.error.errors,
      });
      return;
    }

    const file = req.files?.nicImage;
    if (!file || Array.isArray(file)) {
      res.status(400).json({ message: 'NIC front image is required.' });
      return;
    }

    const { firstName, lastName, address, phone, nic, email, password } = parsedData.data;

    let existingUser = await prisma.vehicleOwner.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Email is already registered' });
      return;
    }

    existingUser = await prisma.vehicleOwner.findUnique({
      where: { nic },
    });

    if (existingUser) {
      res.status(400).json({ error: 'NIC is already used' });
      return;
    }

    existingUser = await prisma.vehicleOwner.findUnique({
      where: { phone },
    });

    if (existingUser) {
      res.status(400).json({ error: 'Phone is already used' });
      return;
    }

    const extractedText = await analyzeDocumentInMemory(file.data);
    const extractedNIC = await extractSriLankanNIC(extractedText);

    if (!extractedNIC) {
      res.status(400).json({ message: 'Could not extract NIC number from image.' });
      return;
    }

    if (extractedNIC !== nic) {
      res.status(400).json({
        message: 'NIC number does not match the number found in the uploaded image.',
        extractedNIC,
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.vehicleOwner.create({
      data: {
        firstName,
        lastName,
        address,
        phone,
        nic,
        email,
        password: hashedPassword,
        verificationStatus: true,
        otp: generateOtp(),
        dateRegistered: new Date(),
      },
    });

    // call the blockchain service to create a new user wallet
    try {
      const response = await axiosInstance.get('/enrollUser/' + nic);
      console.log(response);
    } catch (err) {
      await prisma.vehicleOwner.delete({
        where: { id: newUser.id },
      });
      res.status(500).json({ message: 'Error creating user wallet in blockchain', error: err });
      return;
    }

    res.status(201).json({
      message: 'New user registered successfully!',
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        address: newUser.address,
        phone: newUser.phone,
        nic: newUser.nic,
        email: newUser.email,
      },
    });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error!' });
    return;
  }
});

// Login Route
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const vehicleOwnerLoginSchema = z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password must be at least 6 characters long'),
      deviceInfo: z.string().max(100, 'Invalid device info'),
    });

    const parsedData = vehicleOwnerLoginSchema.safeParse(req.body);

    if (!parsedData.success) {
      res.status(400).json({
        error: 'Validation failed',
        issues: parsedData.error.errors,
      });
      return;
    }

    const { email, password, deviceInfo } = parsedData.data;

    // Check if user exists
    const user = await prisma.vehicleOwner.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const secretKey = process.env.JWT_SECRET as string;

    if (!secretKey) throw new Error('JWT_SECRET is not defined in environment variables');

    const token = jwt.sign({ id: user.id, email: user.email, role: 'vehicleOwner' }, secretKey, {
      expiresIn: '1h',
    });

    const expiresIn = 1 * 60 * 60 * 1000;
    const expiration = new Date(Date.now() + expiresIn);

    // store it in the database
    await prisma.authToken.create({
      data: {
        tokenType: 'login-vehicleOwner',
        userId: user.id,
        userRole: 'vehicleOwner',
        ipAddress: req.ip || '',
        deviceInfo: deviceInfo,
        expirationTime: expiration,
        tokenValue: token,
      },
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });

    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error!' });
  }
});

router.get(
  '/current-user',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedRequest, res: Response) => {
    let _user = { ...req.user };
    delete _user.password;

    res.status(200).json({
      user: _user,
    });

    return;
  }
);

router.get('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    const savedToken = await prisma.authToken.findUnique({
      where: { tokenValue: token },
    });

    if (!savedToken) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }

    // Remove token from database
    await prisma.authToken.deleteMany({
      where: { tokenValue: token },
    });

    res.json({ message: 'Logout successful' });
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error!' });
  }
});

router.get(
  '/logged-in-devices',
  vehicleOwnerAuthMiddleware(),
  async (req: AuthenticatedRequest, res: Response) => {
    let _user = { ...req.user };

    try {
      let currentDeviceToken = req.header('Authorization');

      if (!currentDeviceToken) {
        res.status(401).json({ error: 'Unauthorized: token not found' });
        return;
      }

      currentDeviceToken = currentDeviceToken.split(' ')[1];

      const activeTokens = await prisma.authToken.findMany({
        where: {
          expirationTime: {
            gt: new Date(),
          },
        },
        orderBy: {
          expirationTime: 'asc',
        },
        take: 50,
      });

      let currentTokenObject;

      for (let i = 0; i < activeTokens.length; i++) {
        if (activeTokens[i].tokenValue === currentDeviceToken) {
          currentTokenObject = activeTokens[i];
          break;
        }
      }

      res.json({
        message: 'Logged in devices',
        devices: activeTokens,
        currentDevice: currentTokenObject,
      });
      return;
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error!' });
    }
  }
);

export default router;
