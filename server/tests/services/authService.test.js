const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const Patient = require("../../models/Patient");
const Counter = require("../../models/Counter");
const Otp = require("../../models/Otp");
const emailService = require("../../services/emailService");
const otpUtils = require("../../utils/otp");
const tokenUtils = require("../../utils/tokens");

const {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  sendEmailVerificationOtp,
  verifyEmailOtp,
  sendPasswordResetOtp,
  resetPasswordWithOtp,
} = require("../../services/authService");

jest.mock("bcryptjs");
jest.mock("../../models/User");
jest.mock("../../models/Patient");
jest.mock("../../models/Counter");
jest.mock("../../models/Otp");
jest.mock("../../services/emailService");
jest.mock("../../utils/otp");
jest.mock("../../utils/tokens");

describe("authService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("registerUser", () => {
    it("should reject invalid role", async () => {
      const result = await registerUser({
        identifier: "test@gmail.com",
        password: "Password123",
        fullName: "Test",
        role: "admin",
      });

      expect(result.status).toBe(400);
      expect(result.data.message).toBe("Only patient or doctor can self-register");
    });

    it("should reject if user already exists", async () => {
      User.findOne.mockResolvedValue({ _id: "u1" });

      const result = await registerUser({
        identifier: "test@gmail.com",
        password: "Password123",
        fullName: "Test",
        role: "patient",
      });

      expect(result.status).toBe(409);
      expect(result.data.message).toBe("User already exists");
    });

    it("should register doctor successfully", async () => {
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed-password");
      User.create.mockResolvedValue({
        _id: "doc1",
        role: "doctor",
        email: "doctor@gmail.com",
        phone: undefined,
        status: "PENDING",
      });

      const result = await registerUser({
        identifier: "doctor@gmail.com",
        password: "Password123",
        fullName: "Doctor A",
        role: "doctor",
      });

      expect(result.status).toBe(201);
      expect(result.data.message).toBe("Doctor registered successfully. Awaiting admin approval.");
    });

    it("should register patient successfully", async () => {
      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed-password");

      const saveMock = jest.fn().mockResolvedValue(true);

      User.create.mockResolvedValue({
        _id: "pat1",
        role: "patient",
        email: "patient@gmail.com",
        phone: undefined,
        fullName: "Patient A",
        isVerified: false,
        save: saveMock,
      });

      Counter.findOneAndUpdate.mockResolvedValue({ seq: 1 });
      Patient.create.mockResolvedValue(true);
      tokenUtils.signAccessToken.mockReturnValue("access-token");
      tokenUtils.signRefreshToken.mockReturnValue("refresh-token");

      const result = await registerUser({
        identifier: "patient@gmail.com",
        password: "Password123",
        fullName: "Patient A",
        role: "patient",
      });

      expect(result.status).toBe(201);
      expect(result.data.message).toBe("Registered successfully");
      expect(result.data.patientId).toBe("PAT-000001");
    });
  });

  describe("loginUser", () => {
    it("should return 401 if user not found", async () => {
      User.findOne.mockResolvedValue(null);

      const result = await loginUser({
        identifier: "missing@gmail.com",
        password: "Password123",
      });

      expect(result.status).toBe(401);
      expect(result.data.message).toBe("Invalid credentials");
    });

    it("should return 403 if account is deactivated", async () => {
      User.findOne.mockResolvedValue({
        isActive: false,
      });

      const result = await loginUser({
        identifier: "test@gmail.com",
        password: "Password123",
      });

      expect(result.status).toBe(403);
      expect(result.data.message).toBe("Account is deactivated");
    });

    it("should return 401 if password is wrong", async () => {
      User.findOne.mockResolvedValue({
        isActive: true,
        passwordHash: "hash",
      });
      bcrypt.compare.mockResolvedValue(false);

      const result = await loginUser({
        identifier: "test@gmail.com",
        password: "wrongpass",
      });

      expect(result.status).toBe(401);
      expect(result.data.message).toBe("Invalid credentials");
    });

    it("should block non-active doctor", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        isActive: true,
        passwordHash: "hash",
        status: "PENDING",
        role: "doctor",
      });
      bcrypt.compare.mockResolvedValue(true);

      const result = await loginUser({
        identifier: "doctor@gmail.com",
        password: "Password123",
      });

      expect(result.status).toBe(403);
      expect(result.data.message).toBe("Doctor account not approved yet");
    });

    it("should login successfully", async () => {
      const saveMock = jest.fn().mockResolvedValue(true);

      User.findOne.mockResolvedValue({
        _id: "u1",
        isActive: true,
        passwordHash: "hash",
        status: "ACTIVE",
        role: "patient",
        email: "test@gmail.com",
        phone: null,
        fullName: "Test User",
        isVerified: true,
        save: saveMock,
      });

      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue("hashed-refresh");
      tokenUtils.signAccessToken.mockReturnValue("access-token");
      tokenUtils.signRefreshToken.mockReturnValue("refresh-token");

      const result = await loginUser({
        identifier: "test@gmail.com",
        password: "Password123",
      });

      expect(result.status).toBe(200);
      expect(result.data.message).toBe("Login success");
      expect(result.data.accessToken).toBe("access-token");
      expect(result.data.refreshToken).toBe("refresh-token");
    });
  });

  describe("refreshAccessToken", () => {
    it("should return new access token when refresh token is valid", async () => {
      tokenUtils.verifyRefreshToken.mockReturnValue({ userId: "u1" });

      User.findById.mockResolvedValue({
        _id: "u1",
        isActive: true,
        role: "patient",
        refreshTokenHash: "stored-hash",
      });

      bcrypt.compare.mockResolvedValue(true);
      tokenUtils.signAccessToken.mockReturnValue("new-access-token");

      const result = await refreshAccessToken({ refreshToken: "valid-refresh-token" });

      expect(result.status).toBe(200);
      expect(result.data.accessToken).toBe("new-access-token");
    });

    it("should return 401 if refresh token invalid", async () => {
      tokenUtils.verifyRefreshToken.mockImplementation(() => {
        throw new Error("invalid");
      });

      const result = await refreshAccessToken({ refreshToken: "bad-token" });

      expect(result.status).toBe(401);
      expect(result.data.message).toBe("Refresh token expired/invalid");
    });
  });

  describe("logoutUser", () => {
    it("should clear refresh token hash", async () => {
      User.findByIdAndUpdate.mockResolvedValue(true);

      const result = await logoutUser({ userId: "u1" });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith("u1", {
        $unset: { refreshTokenHash: 1 },
      });
      expect(result.status).toBe(200);
      expect(result.data.message).toBe("Logged out");
    });
  });

  describe("sendEmailVerificationOtp", () => {
    it("should return 404 if user not found", async () => {
      User.findOne.mockResolvedValue(null);

      const result = await sendEmailVerificationOtp({ identifier: "missing@gmail.com" });

      expect(result.status).toBe(404);
      expect(result.data.message).toBe("User not found");
    });

    it("should return already verified if user verified", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "test@gmail.com",
        isVerified: true,
      });

      const result = await sendEmailVerificationOtp({ identifier: "test@gmail.com" });

      expect(result.status).toBe(200);
      expect(result.data.message).toBe("Email already verified");
    });

    it("should send verification OTP", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "test@gmail.com",
        isVerified: false,
      });

      Otp.deleteMany.mockResolvedValue(true);
      otpUtils.generateOtp.mockReturnValue("123456");
      otpUtils.hashOtp.mockReturnValue("hashed-otp");
      Otp.create.mockResolvedValue(true);
      emailService.sendEmail.mockResolvedValue(true);

      const result = await sendEmailVerificationOtp({ identifier: "test@gmail.com" });

      expect(result.status).toBe(200);
      expect(result.data.message).toBe("Verification OTP sent to email");
      expect(emailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe("verifyEmailOtp", () => {
    it("should return 404 if user not found", async () => {
      User.findOne.mockResolvedValue(null);

      const result = await verifyEmailOtp({
        identifier: "test@gmail.com",
        otp: "123456",
      });

      expect(result.status).toBe(404);
      expect(result.data.message).toBe("User not found");
    });

    it("should return 400 if OTP record missing", async () => {
      User.findOne.mockResolvedValue({ _id: "u1" });
      Otp.findOne.mockResolvedValue(null);

      const result = await verifyEmailOtp({
        identifier: "test@gmail.com",
        otp: "123456",
      });

      expect(result.status).toBe(400);
      expect(result.data.message).toBe("OTP not found or expired");
    });

    it("should verify email successfully", async () => {
      const saveUserMock = jest.fn().mockResolvedValue(true);

      User.findOne.mockResolvedValue({
        _id: "u1",
        save: saveUserMock,
      });

      Otp.findOne.mockResolvedValue({
        _id: "otp1",
        expiresAt: new Date(Date.now() + 60000),
        attemptsLeft: 5,
        otpHash: "hashed-otp",
      });

      otpUtils.hashOtp.mockReturnValue("hashed-otp");
      Otp.deleteOne.mockResolvedValue(true);

      const result = await verifyEmailOtp({
        identifier: "test@gmail.com",
        otp: "123456",
      });

      expect(result.status).toBe(200);
      expect(result.data.message).toBe("Email verified successfully");
    });

    it("should return invalid OTP", async () => {
      const saveOtpMock = jest.fn().mockResolvedValue(true);

      User.findOne.mockResolvedValue({ _id: "u1" });
      Otp.findOne.mockResolvedValue({
        _id: "otp1",
        expiresAt: new Date(Date.now() + 60000),
        attemptsLeft: 5,
        otpHash: "hashed-correct",
        save: saveOtpMock,
      });

      otpUtils.hashOtp.mockReturnValue("hashed-wrong");

      const result = await verifyEmailOtp({
        identifier: "test@gmail.com",
        otp: "000000",
      });

      expect(result.status).toBe(400);
      expect(result.data.message).toBe("Invalid OTP");
    });
  });

  describe("sendPasswordResetOtp", () => {
    it("should send password reset OTP", async () => {
      User.findOne.mockResolvedValue({
        _id: "u1",
        email: "test@gmail.com",
      });

      Otp.deleteMany.mockResolvedValue(true);
      otpUtils.generateOtp.mockReturnValue("123456");
      otpUtils.hashOtp.mockReturnValue("hashed-otp");
      Otp.create.mockResolvedValue(true);
      emailService.sendEmail.mockResolvedValue(true);

      const result = await sendPasswordResetOtp({
        identifier: "test@gmail.com",
      });

      expect(result.status).toBe(200);
      expect(result.data.message).toBe("Password reset OTP sent to email");
    });
  });

  describe("resetPasswordWithOtp", () => {
    it("should reset password successfully", async () => {
      const saveUserMock = jest.fn().mockResolvedValue(true);

      User.findOne.mockResolvedValue({
        _id: "u1",
        save: saveUserMock,
      });

      Otp.findOne.mockResolvedValue({
        _id: "otp1",
        expiresAt: new Date(Date.now() + 60000),
        attemptsLeft: 5,
        otpHash: "hashed-otp",
      });

      otpUtils.hashOtp.mockReturnValue("hashed-otp");
      bcrypt.hash.mockResolvedValue("new-hashed-password");
      Otp.deleteOne.mockResolvedValue(true);

      const result = await resetPasswordWithOtp({
        identifier: "test@gmail.com",
        otp: "123456",
        newPassword: "NewPassword123",
      });

      expect(result.status).toBe(200);
      expect(result.data.message).toBe("Password reset successful. Please login again.");
    });

    it("should return invalid OTP for wrong code", async () => {
      const saveOtpMock = jest.fn().mockResolvedValue(true);

      User.findOne.mockResolvedValue({ _id: "u1" });
      Otp.findOne.mockResolvedValue({
        _id: "otp1",
        expiresAt: new Date(Date.now() + 60000),
        attemptsLeft: 5,
        otpHash: "correct-hash",
        save: saveOtpMock,
      });

      otpUtils.hashOtp.mockReturnValue("wrong-hash");

      const result = await resetPasswordWithOtp({
        identifier: "test@gmail.com",
        otp: "999999",
        newPassword: "NewPassword123",
      });

      expect(result.status).toBe(400);
      expect(result.data.message).toBe("Invalid OTP");
    });
  });
});