import bcrypt from "bcryptjs";
import { execSync } from "child_process";
import jwt from "jsonwebtoken";
import request from "supertest";
import prisma from "../config/prisma";
import app from "../server";

process.env.JWT_SECRET = "testsecret";

describe("Mechanic Authentication Routes", () => {
    let testUser: any;
    let authToken: string;
    let server: any;

    beforeAll(async () => {
        jest.setTimeout(30000);

        process.env.DATABASE_URL = "file:./test.db?mode=memory";
        await execSync('npx prisma migrate deploy');

        await prisma.authToken.deleteMany();
        await prisma.mechanic.deleteMany();

        jest.clearAllMocks();

        testUser = await prisma.mechanic.create({
            data: {
                name: "John Doe",
                address: "123 Main St",
                phone: "1234567890",
                nic: "987654321V",
                cid: "MECH456",
                email: "testmechanic@example.com",
                password: await bcrypt.hash("password123", 10),
                specialization: "Engine Repair",
                verificationStatus: true,
                dateRegistered: new Date(),
            },
        });

        authToken = jwt.sign(
            { id: testUser.mechanicId, email: testUser.email, role: "mechanic" },
            process.env.JWT_SECRET as string,
            { expiresIn: "1h" }
        );

        await prisma.authToken.create({
            data: {
                tokenType: "login-mechanic",
                userId: testUser.mechanicId,
                userRole: "mechanic",
                ipAddress: "127.0.0.1",
                deviceInfo: "Test Device",
                expirationTime: new Date(),
                tokenValue: authToken,
            },
        });

        server = app.listen(0, () => {
            console.log("Server started for tests");
        });

        await new Promise(resolve => {
            server.on('listening', resolve);
        });
    }, 30000);

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close(async () => {
                console.log("Server closed after tests");
                try {
                    await prisma.authToken.deleteMany();
                    await prisma.mechanic.deleteMany();
                    await prisma.$disconnect();
                    resolve();
                } catch (err) {
                    console.error(err);
                    reject(err);
                }
            });
        });
    });

    test("Should register a new mechanic", async () => {
        const response = await request(app)
            .post("/api/v1/auth/mechanic/register")
            .send({
                name: "Alice Smith",
                address: "456 Test Ave",
                phone: "9876543210",
                nic: "123456789V",
                cid: "MECH567",
                email: "alice@example.com",
                password: "securepass",
                specialization: "Brake Systems",
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("message", "New user registered successfully!");
    });

    test("Should not register with an existing email", async () => {
        const response = await request(app)
            .post("/api/v1/auth/mechanic/register")
            .send({
                name: "John Doe",
                address: "789 Test Rd",
                phone: "9999999999",
                nic: "123123123V",
                cid: "MECH123",
                email: "testmechanic@example.com",
                password: "password123",
                specialization: "Tire Repair",
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Email is already registered");
    });

    test("Should login with correct credentials", async () => {
        const response = await request(app)
            .post("/api/v1/auth/mechanic/login")
            .send({
                email: "alice@example.com",
                password: "securepass",
                deviceInfo: "Test Device",
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("token");
        expect(response.body).toHaveProperty("user");
    });

    test("Should not login with incorrect password", async () => {
        const response = await request(app)
            .post("/api/v1/auth/mechanic/login")
            .send({
                email: "testmechanic@example.com",
                password: "wrongpassword",
                deviceInfo: "Test Device",
            });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("Invalid credentials");
    });

    test("Should fetch the current user", async () => {
        await prisma.authToken.deleteMany();

        const loginResponse = await request(app)
            .post("/api/v1/auth/mechanic/login")
            .send({
                email: "alice@example.com",
                password: "securepass",
                deviceInfo: "Test Device",
            });
    
        expect(loginResponse.status).toBe(200);
        
        const token = loginResponse.body.token;
    
        const response = await request(app)
            .get("/api/v1/auth/mechanic/current-user")
            .set("Authorization", `Bearer ${token}`);
    
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("user");
        expect(response.body.user).toHaveProperty("email", "alice@example.com");
    });

    test("Should log out the mechanic", async () => {
        await prisma.authToken.deleteMany();

        const loginResponse = await request(app)
            .post("/api/v1/auth/mechanic/login")
            .send({
                email: "alice@example.com",
                password: "securepass",
                deviceInfo: "Test Device",
            });
    
        expect(loginResponse.status).toBe(200);
        
        const token = loginResponse.body.token;

        const response = await request(app)
            .get("/api/v1/auth/mechanic/logout")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("message", "Logout successful");
    });
});
