const {
  register,
  login,
  refresh,
  logout,
  sendVerifyEmailOtp,
  confirmVerifyEmailOtp,
  forgotPassword,
  resetPassword,
} = require("../../controllers/authController");

const authService = require("../../services/authService");
const { validationResult } = require("express-validator");

jest.mock("../../services/authService");
jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("authController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should return 400 when validation fails", async () => {
      const req = { body: {} };
      const res = mockRes();

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Invalid input" }],
      });

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Invalid input" }],
      });
    });

    it("should call registerUser and return response", async () => {
      const req = {
        body: {
          identifier: "test@gmail.com",
          password: "Password123",
          fullName: "Test User",
          role: "patient",
        },
      };
      const res = mockRes();

      validationResult.mockReturnValue({
        isEmpty: () => true,
      });

      authService.registerUser.mockResolvedValue({
        status: 201,
        data: { message: "Registered successfully" },
      });

      await register(req, res);

      expect(authService.registerUser).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Registered successfully",
      });
    });
  });

  describe("login", () => {
    it("should return 400 when validation fails", async () => {
      const req = { body: {} };
      const res = mockRes();

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Identifier required" }],
      });

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        errors: [{ msg: "Identifier required" }],
      });
    });

    it("should call loginUser and return response", async () => {
      const req = {
        body: { identifier: "test@gmail.com", password: "Password123" },
      };
      const res = mockRes();

      validationResult.mockReturnValue({
        isEmpty: () => true,
      });

      authService.loginUser.mockResolvedValue({
        status: 200,
        data: { message: "Login success" },
      });

      await login(req, res);

      expect(authService.loginUser).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Login success" });
    });
  });

  describe("refresh", () => {
    it("should call refreshAccessToken and return response", async () => {
      const req = { body: { refreshToken: "abc123" } };
      const res = mockRes();

      authService.refreshAccessToken.mockResolvedValue({
        status: 200,
        data: { accessToken: "new-token" },
      });

      await refresh(req, res);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ accessToken: "new-token" });
    });
  });

  describe("logout", () => {
    it("should call logoutUser with req.user.userId", async () => {
      const req = { user: { userId: "u123" } };
      const res = mockRes();

      authService.logoutUser.mockResolvedValue({
        status: 200,
        data: { message: "Logged out" },
      });

      await logout(req, res);

      expect(authService.logoutUser).toHaveBeenCalledWith({ userId: "u123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Logged out" });
    });
  });

  describe("sendVerifyEmailOtp", () => {
    it("should call sendEmailVerificationOtp", async () => {
      const req = { body: { identifier: "test@gmail.com" } };
      const res = mockRes();

      authService.sendEmailVerificationOtp.mockResolvedValue({
        status: 200,
        data: { message: "Verification OTP sent to email" },
      });

      await sendVerifyEmailOtp(req, res);

      expect(authService.sendEmailVerificationOtp).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("confirmVerifyEmailOtp", () => {
    it("should call verifyEmailOtp", async () => {
      const req = { body: { identifier: "test@gmail.com", otp: "123456" } };
      const res = mockRes();

      authService.verifyEmailOtp.mockResolvedValue({
        status: 200,
        data: { message: "Email verified successfully" },
      });

      await confirmVerifyEmailOtp(req, res);

      expect(authService.verifyEmailOtp).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("forgotPassword", () => {
    it("should call sendPasswordResetOtp", async () => {
      const req = { body: { identifier: "test@gmail.com" } };
      const res = mockRes();

      authService.sendPasswordResetOtp.mockResolvedValue({
        status: 200,
        data: { message: "Password reset OTP sent to email" },
      });

      await forgotPassword(req, res);

      expect(authService.sendPasswordResetOtp).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("resetPassword", () => {
    it("should call resetPasswordWithOtp", async () => {
      const req = {
        body: {
          identifier: "test@gmail.com",
          otp: "123456",
          newPassword: "NewPass123",
        },
      };
      const res = mockRes();

      authService.resetPasswordWithOtp.mockResolvedValue({
        status: 200,
        data: { message: "Password reset successful. Please login again." },
      });

      await resetPassword(req, res);

      expect(authService.resetPasswordWithOtp).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});