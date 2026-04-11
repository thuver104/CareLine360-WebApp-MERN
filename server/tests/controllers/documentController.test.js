const {
  uploadMyDocument,
  listMyDocuments,
  deleteMyDocument,
  deleteMyDocumentPermanent,
} = require("../../controllers/documentController");

const Document = require("../../models/Document");
const Patient = require("../../models/Patient");
const cloudinary = require("../../config/cloudinary");

jest.mock("../../models/Document");
jest.mock("../../models/Patient");
jest.mock("../../config/cloudinary", () => ({
  uploader: {
    destroy: jest.fn(),
  },
}));

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("documentController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("uploadMyDocument", () => {
    it("should return 400 if req.file.path is missing", async () => {
      const req = {
        user: { userId: "user123" },
        file: {},
        body: {},
      };
      const res = mockRes();

      await uploadMyDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "No document uploaded (req.file.path missing)",
      });
    });

    it("should upload document successfully", async () => {
      const req = {
        user: { userId: "user123" },
        body: { title: "Blood Report", category: "lab" },
        file: {
          path: "https://res.cloudinary.com/demo/raw/upload/report.pdf",
          filename: "docs/report_123",
          public_id: "docs/report_123",
          resource_type: "raw",
          format: "pdf",
          version: 12345,
          originalname: "report.pdf",
          mimetype: "application/pdf",
          size: 54321,
        },
      };
      const res = mockRes();

      Patient.findOne.mockResolvedValue({ _id: "patient123" });

      const createdDoc = {
        _id: "doc123",
        userId: "user123",
        patientId: "patient123",
        title: "Blood Report",
        category: "lab",
        fileName: "report.pdf",
        fileUrl: "https://res.cloudinary.com/demo/raw/upload/report.pdf",
        publicId: "docs/report_123",
        mimeType: "application/pdf",
        fileSize: 54321,
        resourceType: "raw",
        format: "pdf",
        version: 12345,
        toObject: jest.fn().mockReturnValue({
          _id: "doc123",
          title: "Blood Report",
          fileUrl: "https://res.cloudinary.com/demo/raw/upload/report.pdf",
        }),
      };

      Document.create.mockResolvedValue(createdDoc);

      await uploadMyDocument(req, res);

      expect(Patient.findOne).toHaveBeenCalledWith({
        userId: "user123",
        $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }],
      });

      expect(Document.create).toHaveBeenCalledWith({
        userId: "user123",
        patientId: "patient123",
        title: "Blood Report",
        category: "lab",
        fileName: "report.pdf",
        fileUrl: "https://res.cloudinary.com/demo/raw/upload/report.pdf",
        publicId: "docs/report_123",
        mimeType: "application/pdf",
        fileSize: 54321,
        resourceType: "raw",
        format: "pdf",
        version: 12345,
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "Document uploaded",
        document: {
          _id: "doc123",
          title: "Blood Report",
          fileUrl: "https://res.cloudinary.com/demo/raw/upload/report.pdf",
          viewUrl: "https://res.cloudinary.com/demo/raw/upload/report.pdf",
        },
      });
    });

    it("should return 500 if Cloudinary values are missing", async () => {
      const req = {
        user: { userId: "user123" },
        body: { title: "Doc", category: "other" },
        file: {
          path: "",
          filename: "",
          originalname: "doc.pdf",
        },
      };
      const res = mockRes();

      await uploadMyDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 on server error", async () => {
      const req = {
        user: { userId: "user123" },
        body: { title: "Blood Report", category: "lab" },
        file: {
          path: "https://cloudinary.com/file.pdf",
          filename: "docs/1",
          originalname: "file.pdf",
          mimetype: "application/pdf",
          size: 1000,
        },
      };
      const res = mockRes();

      Patient.findOne.mockRejectedValue(new Error("DB failed"));

      await uploadMyDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "DB failed",
      });
    });
  });

  describe("listMyDocuments", () => {
    it("should list all documents for user", async () => {
      const req = {
        user: { userId: "user123" },
        query: {},
      };
      const res = mockRes();

      const docs = [
        {
          toObject: jest.fn().mockReturnValue({
            _id: "d1",
            title: "Report 1",
            fileUrl: "https://file1.pdf",
          }),
          fileUrl: "https://file1.pdf",
        },
        {
          toObject: jest.fn().mockReturnValue({
            _id: "d2",
            title: "Report 2",
            fileUrl: "https://file2.pdf",
          }),
          fileUrl: "https://file2.pdf",
        },
      ];

      const sortMock = jest.fn().mockResolvedValue(docs);
      Document.find.mockReturnValue({ sort: sortMock });

      await listMyDocuments(req, res);

      expect(Document.find).toHaveBeenCalledWith({
        userId: "user123",
        isDeleted: false,
      });

      expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });

      expect(res.json).toHaveBeenCalledWith({
        documents: [
          {
            _id: "d1",
            title: "Report 1",
            fileUrl: "https://file1.pdf",
            viewUrl: "https://file1.pdf",
          },
          {
            _id: "d2",
            title: "Report 2",
            fileUrl: "https://file2.pdf",
            viewUrl: "https://file2.pdf",
          },
        ],
      });
    });

    it("should filter documents by category", async () => {
      const req = {
        user: { userId: "user123" },
        query: { category: "lab" },
      };
      const res = mockRes();

      const sortMock = jest.fn().mockResolvedValue([]);
      Document.find.mockReturnValue({ sort: sortMock });

      await listMyDocuments(req, res);

      expect(Document.find).toHaveBeenCalledWith({
        userId: "user123",
        isDeleted: false,
        category: "lab",
      });
    });

    it("should search documents by title or fileName", async () => {
      const req = {
        user: { userId: "user123" },
        query: { q: "blood" },
      };
      const res = mockRes();

      const sortMock = jest.fn().mockResolvedValue([]);
      Document.find.mockReturnValue({ sort: sortMock });

      await listMyDocuments(req, res);

      expect(Document.find).toHaveBeenCalledWith({
        userId: "user123",
        isDeleted: false,
        $or: [
          { title: { $regex: "blood", $options: "i" } },
          { fileName: { $regex: "blood", $options: "i" } },
        ],
      });
    });

    it("should filter by category and search query together", async () => {
      const req = {
        user: { userId: "user123" },
        query: { category: "scan", q: "chest" },
      };
      const res = mockRes();

      const sortMock = jest.fn().mockResolvedValue([]);
      Document.find.mockReturnValue({ sort: sortMock });

      await listMyDocuments(req, res);

      expect(Document.find).toHaveBeenCalledWith({
        userId: "user123",
        isDeleted: false,
        category: "scan",
        $or: [
          { title: { $regex: "chest", $options: "i" } },
          { fileName: { $regex: "chest", $options: "i" } },
        ],
      });
    });

    it("should return 500 on server error", async () => {
      const req = {
        user: { userId: "user123" },
        query: {},
      };
      const res = mockRes();

      Document.find.mockImplementation(() => {
        throw new Error("DB error");
      });

      await listMyDocuments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Server error",
      });
    });
  });

  describe("deleteMyDocument", () => {
    it("should soft delete document successfully", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "doc123" },
      };
      const res = mockRes();

      Document.findOneAndUpdate.mockResolvedValue({
        _id: "doc123",
        isDeleted: true,
      });

      await deleteMyDocument(req, res);

      expect(Document.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "doc123", userId: "user123", isDeleted: false },
        { $set: { isDeleted: true, deletedAt: expect.any(Date) } },
        { new: true }
      );

      expect(res.json).toHaveBeenCalledWith({
        message: "Document deleted (hidden)",
      });
    });

    it("should return 404 if document not found", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "missing-doc" },
      };
      const res = mockRes();

      Document.findOneAndUpdate.mockResolvedValue(null);

      await deleteMyDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Document not found",
      });
    });

    it("should return 500 on server error", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "doc123" },
      };
      const res = mockRes();

      Document.findOneAndUpdate.mockRejectedValue(new Error("Delete failed"));

      await deleteMyDocument(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Server error",
      });
    });
  });

  describe("deleteMyDocumentPermanent", () => {
    it("should permanently delete raw document successfully", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "doc123" },
      };
      const res = mockRes();

      const saveMock = jest.fn().mockResolvedValue(true);

      Document.findOne.mockResolvedValue({
        _id: "doc123",
        userId: "user123",
        publicId: "docs/report_123",
        resourceType: "raw",
        isDeleted: false,
        save: saveMock,
      });

      cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

      await deleteMyDocumentPermanent(req, res);

      expect(Document.findOne).toHaveBeenCalledWith({
        _id: "doc123",
        userId: "user123",
      });

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        "docs/report_123",
        { resource_type: "raw" }
      );

      expect(saveMock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Document deleted permanently",
      });
    });

    it("should use image resource_type when document is image", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "doc-img" },
      };
      const res = mockRes();

      const saveMock = jest.fn().mockResolvedValue(true);

      Document.findOne.mockResolvedValue({
        _id: "doc-img",
        publicId: "docs/image_1",
        resourceType: "image",
        save: saveMock,
      });

      cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

      await deleteMyDocumentPermanent(req, res);

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        "docs/image_1",
        { resource_type: "image" }
      );
    });

    it("should use video resource_type when document is video", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "doc-video" },
      };
      const res = mockRes();

      const saveMock = jest.fn().mockResolvedValue(true);

      Document.findOne.mockResolvedValue({
        _id: "doc-video",
        publicId: "docs/video_1",
        resourceType: "video",
        save: saveMock,
      });

      cloudinary.uploader.destroy.mockResolvedValue({ result: "ok" });

      await deleteMyDocumentPermanent(req, res);

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
        "docs/video_1",
        { resource_type: "video" }
      );
    });

    it("should return 404 if document not found", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "missing-doc" },
      };
      const res = mockRes();

      Document.findOne.mockResolvedValue(null);

      await deleteMyDocumentPermanent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        message: "Document not found",
      });
    });

    it("should return 500 on permanent delete error", async () => {
      const req = {
        user: { userId: "user123" },
        params: { id: "doc123" },
      };
      const res = mockRes();

      Document.findOne.mockRejectedValue(new Error("Cloudinary failed"));

      await deleteMyDocumentPermanent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: "Cloudinary failed",
      });
    });
  });
});