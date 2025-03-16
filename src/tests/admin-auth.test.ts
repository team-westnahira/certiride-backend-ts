import { execSync } from "child_process";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import prisma from "../config/prisma";
import app from "../server";

// Mock external dependencies
import { addAuditLog } from "../services/auditlog.service";
jest.mock("../services/auditlog.service", () => ({
  addAuditLog: jest.fn(),
}));

import { generateOtp } from "../utils/otpGenerator";
jest.mock("../utils/otpGenerator", () => ({
  generateOtp: jest.fn(() => "123456"),
}));

process.env.JWT_SECRET = "testsecret";
let server: any;

describe("Admin Controller", () => {

  beforeAll(async () => {
    
    jest.setTimeout(30000);
    execSync("npx prisma migrate deploy");
    await prisma.authToken.deleteMany();
    await prisma.admin.deleteMany();

    server = app.listen(0, () => {
      console.log("Test server started");
    });

    await new Promise((resolve) => server.on("listening", resolve));
  });

  afterAll(async () => {
    await prisma.authToken.deleteMany();
    await prisma.admin.deleteMany();
    await prisma.$disconnect();
    await new Promise<void>((resolve, reject) => {
      server.close((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe("POST /api/v1/auth/admin/add-admin", () => {
    it("should register a new admin successfully", async () => {

        const res = await request(app)
        .post("/api/v1/auth/admin/add-admin")
        .send({
          name: "New Admin",
          email: "newadmin@test.com",
          password: "password123",
          role: "Moderator",
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty(
        "message",
        "New admin user registered successfully!"
      );
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toMatchObject({
        name: "New Admin",
        email: "newadmin@test.com",
        role: "Moderator",
        isActive: false,
      });
      expect(addAuditLog).toHaveBeenCalled();
    });

    it("should return validation error if input is invalid", async () => {
      const res = await request(app).post("/api/v1/auth/admin/add-admin").send({
        name: "", // empty name not allowed
        email: "invalid-email",
        password: "short",
        role: "NotARole",
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
      expect(res.body).toHaveProperty("issues");
    });

    it("should return error if email is already registered", async () => {
      // Create an admin so the email exists.
      const hashedPassword = await bcrypt.hash("password123", 10);
      await prisma.admin.create({
        data: {
          name: "Existing Admin",
          email: "existing@test.com",
          password: hashedPassword,
          role: "Admin",
          isActive: false,
          otp: "000000",
        },
      });

      const res = await request(app).post("/api/v1/auth/admin/add-admin").send({
        name: "New Admin",
        email: "existing@test.com",
        password: "password123",
        role: "Moderator",
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error:
          "Email is already registered one of {Admin , Mechanic , Vehicle owner } account type before",
      });
    });

    it("should return 500 if an exception occurs", async () => {
      const originalCreate = prisma.admin.create;
      // @ts-ignore
      prisma.admin.create = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app).post("/api/v1/auth/admin/add-admin").send({
        name: "Another Admin",
        email: "another@test.com",
        password: "password123",
        role: "Moderator",
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error!" });
      prisma.admin.create = originalCreate;
    });
  });

  describe("POST /login", () => {
    let testAdmin: any;
    beforeEach(async () => {
      await prisma.admin.deleteMany();
      const hashedPassword = await bcrypt.hash("password123", 10);
      testAdmin = await prisma.admin.create({
        data: {
          name: "Test Admin",
          email: "testadmin@test.com",
          password: hashedPassword,
          role: "Admin",
          isActive: true,
          otp: "654321",
        },
      });
    });

    it("should return validation error if input is invalid", async () => {
      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "not-an-email",
        password: "",
        deviceInfo: "info",
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("should return 401 if user is not found", async () => {
      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "nonexistent@test.com",
        password: "password123",
        deviceInfo: "info",
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid credentials" });
    });

    it("should return 401 if password is incorrect", async () => {
      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "testadmin@test.com",
        password: "wrongpassword",
        deviceInfo: "info",
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid credentials" });
    });

    it("should return 401 if admin is not activated", async () => {
      await prisma.admin.update({
        where: { email: "testadmin@test.com" },
        data: { isActive: false },
      });

      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "testadmin@test.com",
        password: "password123",
        deviceInfo: "info",
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Admin user is not activated!" });
    });

    it("should return 500 if JWT_SECRET is missing", async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "testadmin@test.com",
        password: "password123",
        deviceInfo: "info",
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error!" });
      process.env.JWT_SECRET = originalSecret;
    });

    it("should login successfully", async () => {
      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "testadmin@test.com",
        password: "password123",
        deviceInfo: "info",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Login successful");
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toEqual({
        id: testAdmin.adminId,
        name: testAdmin.name,
        email: testAdmin.email,
        role: testAdmin.role,
      });
      expect(addAuditLog).toHaveBeenCalled();
    });

    it("should return 500 if an exception occurs during login", async () => {
      const originalCreate = prisma.authToken.create;
      // @ts-ignore
      prisma.authToken.create = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app).post("/api/v1/auth/admin/login").send({
        email: "testadmin@test.com",
        password: "password123",
        deviceInfo: "info",
      });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error!" });
      prisma.authToken.create = originalCreate;
    });
  });

  describe("GET /current-admin", () => {
    let testAdmin: any;
    let token: string;
    beforeEach(async () => {
      await prisma.admin.deleteMany();
      const hashedPassword = await bcrypt.hash("password123", 10);
      testAdmin = await prisma.admin.create({
        data: {
          name: "Moderator Admin",
          email: "moderator@test.com",
          password: hashedPassword,
          role: "Moderator",
          isActive: true,
          otp: "111111",
        },
      });

      token = jwt.sign(
        { id: testAdmin.adminId, email: testAdmin.email, role: testAdmin.role },
        process.env.JWT_SECRET as string,
        { expiresIn: "30d" }
      );

      await prisma.authToken.create({
        data: {
          tokenType: "login-admin",
          userId: testAdmin.adminId,
          userRole: testAdmin.role,
          ipAddress: "127.0.0.1",
          deviceInfo: "test device",
          expirationTime: new Date(),
          tokenValue: token,
        },
      });
    });

    it("should return the current admin without sensitive info", async () => {
      const res = await request(app)
        .get("/api/v1/auth/admin/current-admin")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");

      expect(res.body.user).toMatchObject({
        adminId: testAdmin.adminId,
        name: testAdmin.name,
        email: testAdmin.email,
        role: testAdmin.role,
        isActive: testAdmin.isActive,
      });
      expect(res.body.user).not.toHaveProperty("password");
      expect(res.body.user).not.toHaveProperty("otp");
    });
  });

  describe("POST /block-admin", () => {
    let adminUser: any,
      targetAdmin: any,
      token: string;
    beforeEach(async () => {
      await prisma.admin.deleteMany();

      adminUser = await prisma.admin.create({
        data: {
          name: "Super Admin",
          email: "superadmin@test.com",
          password: await bcrypt.hash("password123", 10),
          role: "Admin",
          isActive: true,
          otp: "222222",
        },
      });
      token = jwt.sign(
        { id: adminUser.adminId, email: adminUser.email, role: adminUser.role },
        process.env.JWT_SECRET as string,
        { expiresIn: "30d" }
      );
      await prisma.authToken.create({
        data: {
          tokenType: "login-admin",
          userId: adminUser.adminId,
          userRole: adminUser.role,
          ipAddress: "127.0.0.1",
          deviceInfo: "test device",
          expirationTime: new Date(),
          tokenValue: token,
        },
      });

      targetAdmin = await prisma.admin.create({
        data: {
          name: "Target Moderator",
          email: "target@test.com",
          password: await bcrypt.hash("password123", 10),
          role: "Moderator",
          isActive: true,
          otp: "333333",
        },
      });
    });

    it("should return validation error if input is invalid", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/block-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "invalid-email",
          state: "notBoolean",
        });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("should not allow blocking yourself", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/block-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "superadmin@test.com",
          state: false,
        });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: "Cannot change the active state of yourself!",
      });
    });

    it("should return error if target user is not found", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/block-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "nonexistent@test.com",
          state: false,
        });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "User not found for this email" });
    });

    it("should not allow deactivation of an Admin account", async () => {
      await prisma.admin.create({
        data: {
          name: "Another Admin",
          email: "another@test.com",
          password: await bcrypt.hash("password123", 10),
          role: "Admin",
          isActive: true,
          otp: "444444",
        },
      });

      const res = await request(app)
        .post("/api/v1/auth/admin/block-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "another@test.com",
          state: false,
        });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Admin account cannot be deactivated" });
    });

    it("should successfully change the active state", async () => {
      const res = await request(app)
        .post("/api/v1/auth/admin/block-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "target@test.com",
          state: false,
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "State changed successfully!");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user).toEqual({
        id: targetAdmin.adminId,
        name: targetAdmin.name,
        email: targetAdmin.email,
        role: targetAdmin.role,
        isActive: false,
      });
    });

    it("should return 500 if an exception occurs", async () => {
      const originalUpdate = prisma.admin.update;
      // Simulate a DB error during update.
      // @ts-ignore
      prisma.admin.update = jest.fn().mockRejectedValue(new Error("DB error"));

      const res = await request(app)
        .post("/api/v1/auth/admin/block-admin")
        .set("Authorization", `Bearer ${token}`)
        .send({
          email: "target@test.com",
          state: false,
        });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error!" });
      prisma.admin.update = originalUpdate;
    });
  });
});
