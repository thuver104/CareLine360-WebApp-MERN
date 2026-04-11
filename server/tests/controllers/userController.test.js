const { getUsers, getUserById } = require("../../controllers/userController");
const User = require("../../models/User");

jest.mock("../../models/User");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("userController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUsers", () => {
    it("should return all users", async () => {
      const req = { query: {} };
      const res = mockRes();
      const next = jest.fn();

      const sortMock = jest.fn().mockResolvedValue([
        { _id: "1", email: "a@gmail.com", role: "patient" },
      ]);
      const selectMock = jest.fn(() => ({ sort: sortMock }));

      User.find.mockReturnValue({ select: selectMock });

      await getUsers(req, res, next);

      expect(User.find).toHaveBeenCalledWith({});
      expect(selectMock).toHaveBeenCalledWith("-passwordHash");
      expect(sortMock).toHaveBeenCalledWith("email");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ _id: "1", email: "a@gmail.com", role: "patient" }],
      });
    });

    it("should filter users by role", async () => {
      const req = { query: { role: "doctor" } };
      const res = mockRes();
      const next = jest.fn();

      const sortMock = jest.fn().mockResolvedValue([
        { _id: "2", email: "doctor@gmail.com", role: "doctor" },
      ]);
      const selectMock = jest.fn(() => ({ sort: sortMock }));

      User.find.mockReturnValue({ select: selectMock });

      await getUsers(req, res, next);

      expect(User.find).toHaveBeenCalledWith({ role: "doctor" });
      expect(res.json).toHaveBeenCalled();
    });

    it("should call next on error", async () => {
      const req = { query: {} };
      const res = mockRes();
      const next = jest.fn();

      User.find.mockImplementation(() => {
        throw new Error("DB error");
      });

      await getUsers(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("getUserById", () => {
    it("should return user by id", async () => {
      const req = { params: { id: "123" } };
      const res = mockRes();
      const next = jest.fn();

      const selectMock = jest.fn().mockResolvedValue({
        _id: "123",
        email: "user@gmail.com",
      });

      User.findById.mockReturnValue({ select: selectMock });

      await getUserById(req, res, next);

      expect(User.findById).toHaveBeenCalledWith("123");
      expect(selectMock).toHaveBeenCalledWith("-passwordHash");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { _id: "123", email: "user@gmail.com" },
      });
    });

    it("should return 404 if user not found", async () => {
      const req = { params: { id: "123" } };
      const res = mockRes();
      const next = jest.fn();

      const selectMock = jest.fn().mockResolvedValue(null);
      User.findById.mockReturnValue({ select: selectMock });

      await getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "User not found",
      });
    });

    it("should call next on error", async () => {
      const req = { params: { id: "123" } };
      const res = mockRes();
      const next = jest.fn();

      User.findById.mockImplementation(() => {
        throw new Error("DB error");
      });

      await getUserById(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});