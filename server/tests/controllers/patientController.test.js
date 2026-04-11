const {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  removeAvatar,
  deactivateMyAccount,
  reactivateAccount,
} = require("../../controllers/patientController");

const Patient = require("../../models/Patient");
const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const profileStrength = require("../../services/profileStrength");

jest.mock("../../models/Patient");
jest.mock("../../models/User");
jest.mock("bcryptjs");
jest.mock("../../services/profileStrength");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("patientController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // GET PROFILE
  // =========================
  describe("getMyProfile", () => {
    it("should return 404 if patient not found", async () => {
      const req = { user: { userId: "u1" } };
      const res = mockRes();

      Patient.findOne.mockResolvedValue(null);

      await getMyProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Profile not found",
      });
    });

    it("should return 404 if user not found", async () => {
      const req = { user: { userId: "u1" } };
      const res = mockRes();

      Patient.findOne.mockResolvedValue({ fullName: "Test" });
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await getMyProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return profile successfully", async () => {
      const req = { user: { userId: "u1" } };
      const res = mockRes();

      const patientMock = {
        fullName: "Test User",
        patientId: "PAT-001",
        avatarUrl: "img.png",
        profileStrength: 50,
        save: jest.fn(),
      };

      Patient.findOne.mockResolvedValue(patientMock);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          email: "test@gmail.com",
          isVerified: true,
          role: "patient",
        }),
      });

      profileStrength.calcPatientProfileStrength.mockReturnValue({
        score: 80,
      });

      await getMyProfile(req, res);

      expect(res.json).toHaveBeenCalled();
    });
  });

  // =========================
  // UPDATE PROFILE
  // =========================
  describe("updateMyProfile", () => {
    it("should return 400 for invalid fullName", async () => {
      const req = {
        user: { userId: "u1" },
        body: { fullName: "ab" },
      };
      const res = mockRes();

      await updateMyProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid DOB", async () => {
      const req = {
        user: { userId: "u1" },
        body: { dob: "invalid-date" },
      };
      const res = mockRes();

      await updateMyProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should update profile successfully", async () => {
      const req = {
        user: { userId: "u1" },
        body: { fullName: "Valid Name" },
      };
      const res = mockRes();

      Patient.findOneAndUpdate.mockResolvedValue({
        fullName: "Valid Name",
      });

      await updateMyProfile(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: "Profile updated successfully",
        patient: { fullName: "Valid Name" },
      });
    });

    it("should return 404 if profile not found", async () => {
      const req = {
        user: { userId: "u1" },
        body: { fullName: "Valid Name" },
      };
      const res = mockRes();

      Patient.findOneAndUpdate.mockResolvedValue(null);

      await updateMyProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // =========================
  // UPLOAD AVATAR
  // =========================
  describe("uploadAvatar", () => {
    it("should return 400 if no file uploaded", async () => {
      const req = {
        user: { userId: "u1" },
        file: null,
      };
      const res = mockRes();

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should upload avatar successfully", async () => {
      const req = {
        user: { userId: "u1" },
        file: { path: "image-url" },
      };
      const res = mockRes();

      Patient.findOneAndUpdate.mockResolvedValue({});

      await uploadAvatar(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: "Avatar updated",
        avatarUrl: "image-url",
      });
    });

    it("should return 404 if patient not found", async () => {
      const req = {
        user: { userId: "u1" },
        file: { path: "image-url" },
      };
      const res = mockRes();

      Patient.findOneAndUpdate.mockResolvedValue(null);

      await uploadAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // =========================
  // REMOVE AVATAR
  // =========================
  describe("removeAvatar", () => {
    it("should remove avatar successfully", async () => {
      const req = { user: { userId: "u1" } };
      const res = mockRes();

      Patient.findOneAndUpdate.mockResolvedValue({});

      await removeAvatar(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: "Avatar removed",
        avatarUrl: null,
      });
    });

    it("should return 404 if profile not found", async () => {
      const req = { user: { userId: "u1" } };
      const res = mockRes();

      Patient.findOneAndUpdate.mockResolvedValue(null);

      await removeAvatar(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // =========================
  // DEACTIVATE ACCOUNT
  // =========================
  describe("deactivateMyAccount", () => {
    it("should deactivate account successfully", async () => {
      const req = { user: { userId: "u1" } };
      const res = mockRes();

      User.findByIdAndUpdate.mockResolvedValue({});
      Patient.findOneAndUpdate.mockResolvedValue({});

      await deactivateMyAccount(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: "Account deactivated successfully",
      });
    });

    it("should return 404 if user not found", async () => {
      const req = { user: { userId: "u1" } };
      const res = mockRes();

      User.findByIdAndUpdate.mockResolvedValue(null);

      await deactivateMyAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // =========================
  // REACTIVATE ACCOUNT
  // =========================
  describe("reactivateAccount", () => {
    it("should return 400 if missing credentials", async () => {
      const req = { body: {} };
      const res = mockRes();

      await reactivateAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 if user not found", async () => {
      const req = {
        body: { identifier: "test@gmail.com", password: "123" },
      };
      const res = mockRes();

      User.findOne.mockResolvedValue(null);

      await reactivateAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should return 401 if password incorrect", async () => {
      const req = {
        body: { identifier: "test@gmail.com", password: "123" },
      };
      const res = mockRes();

      User.findOne.mockResolvedValue({
        passwordHash: "hash",
      });

      bcrypt.compare.mockResolvedValue(false);

      await reactivateAccount(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should reactivate account successfully", async () => {
      const req = {
        body: { identifier: "test@gmail.com", password: "123" },
      };
      const res = mockRes();

      const saveMock = jest.fn();

      User.findOne.mockResolvedValue({
        _id: "u1",
        passwordHash: "hash",
        save: saveMock,
      });

      bcrypt.compare.mockResolvedValue(true);
      Patient.findOneAndUpdate.mockResolvedValue({});

      await reactivateAccount(req, res);

      expect(saveMock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Account reactivated successfully",
      });
    });
  });
});