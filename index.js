const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const sgMail = require("@sendgrid/mail");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ Cloudinary Configuration (uses environment variables)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ SendGrid Configuration (uses environment variable)
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const VERIFIED_SENDER = process.env.VERIFIED_SENDER; 
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// 📦 Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "internship-uploads",
    allowed_formats: ["jpg", "png", "pdf"]
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type"));
  }
});

// 📨 Form Submission Route
app.post("/submit", upload.single("fileupload"), async (req, res) => {
  const userData = req.body;
  const fileInfo = req.file;

  if (!userData.Name || !userData.Email || !userData.CollegeName || !userData.Location) {
    return res.status(400).send("Missing required fields.");
  }

  const fileUrl = fileInfo?.path || "No file uploaded";
  const logEntry = `\n--- New Submission ---\n${JSON.stringify(userData, null, 2)}\nFile URL: ${fileUrl}\n`;

  fs.appendFile("submissions.txt", logEntry, async (err) => {
    if (err) {
      console.error("Error saving submission:", err);
      return res.status(500).send("Failed to save submission.");
    }

    console.log("Submission saved to submissions.txt");

    const emailContent = {
      to: [userData.Email, ADMIN_EMAIL],
      from: VERIFIED_SENDER,
      subject: "Internship Form Submission",
      text: `Thank you for applying!\n\nDetails:\n${JSON.stringify(userData, null, 2)}\n\nFile URL:\n${fileUrl}`
    };

    try {
      await sgMail.sendMultiple(emailContent);
      console.log("Email sent via SendGrid!");
      res.send("Form submitted and emailed successfully!");
    } catch (emailErr) {
      console.error("SendGrid error:", emailErr);
      res.status(500).send("Form submitted, but email failed.");
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
