const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const fs = require('fs');
const Razorpay = require('razorpay');
const pdfParse = require('pdf-parse');
const mongoose = require('mongoose');
const ClientDocument = require('./models/document_schema');
const CodeTracker = require('./models/codeTracker_schema');
const app = express();
const crypto = require('crypto');
const nodemailer = require("nodemailer");
const upload = multer({ dest: 'uploads/' }); // Destination folder for uploaded files

//allow cross origin
app.use(cors());
app.use(bodyParser.json());
// Load environment variables from .env file
dotenv.config();

// Configuration
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectUri = process.env.REDIRECT_URI;
const scopes = ['https://www.googleapis.com/auth/drive.file'];

//connect to databse
try {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((error) => {
      console.log("Connection to MongoDB failed: ", error.message);
    });
} catch (error) {
  console.log("Error outside promise: ", error.message);
}

// Create an OAuth2 client
const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

// Generate the authentication URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  include_granted_scopes: true,
});

//initialisation
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SENDER_MAIL_ID,
    pass: process.env.SENDER_MAIL_SECRET_KEY,
  },
});

//set mail id and otp to send the email to
const mailOptions = (email,fileName) => {
  console.log("the email is sss", email, fileName, process.env.SENDER_MAIL_ID);
  return {
    from: "vinayvidhehi@gmail.com",
    to: email,
    subject: "Your Print is Ready",
    text: `your print of ${fileName} is printed and ready, you can collect it from the Xerox shop in the main canteen`,
  };
};

// Send email with response
async function sendEmail(email, fileName) {
  try {
    await transporter.sendMail(mailOptions(email, fileName));
    console.log("Email sent successfully");
    return 1;
  } catch (error) {
    console.error("Error sending email:", error);
    return 0;
  }
}

// Define routes
app.get('/auth/google', (req, res) => {
  res.redirect(authUrl);
});

app.get('/get-token', async (req, res) => {
  const code = req.query.code;

  try {
    // Exchange the authorization code for access and refresh tokens
    const { tokens } = oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save the tokens in a file for demonstration purposes
    fs.writeFileSync('tokens.json', JSON.stringify(tokens, null, 2));

    res.json('Authentication successful!');
  } catch (error) {
    console.error('Error authenticating:', error);
    res.status(500).send('Authentication failed.');
  }
});

const razorpay = new Razorpay({
  key_id: 'rzp_test_3vGClpVYMAjO1U',
  key_secret: 'u8daXQC4JCo9Jhpweta5MKp1',
});

app.post('/create-order', async (req, res) => {
  try {
    console.log("body contains", req.body);
    const { amount } = req.body; // Amount should be in the smallest currency unit (e.g., paise for INR)

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: 'receipt#1',
    });

    res.json({
      id: order.id,
      currency: order.currency,
      amount: order.amount,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).send('Server error');
  }
});

app.post('/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, documentId } = req.body;

  const hmac = crypto.createHmac('sha256', 'u8daXQC4JCo9Jhpweta5MKp1');
  hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
  const generated_signature = hmac.digest('hex');

  if (generated_signature === razorpay_signature) {
    const foundDocument = await ClientDocument.findOneAndUpdate(
      { documentId },
      { $set: { status: true } },
      { new: true }
    );

    if (foundDocument) {
      // Payment is verified and document status is updated
      res.json({ key: 1 });
    } else {
      // Document not found
      res.status(404).json({ key: 0, message: "Document not found" });
    }
  } else {
    // Payment verification failed
    res.json({ key: 0 });
  }
});


// Function to refresh the token
async function refreshAccessToken() {
  try {
    const tokens = JSON.parse(fs.readFileSync('tokens.json'));

    oAuth2Client.setCredentials({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
    });

    const { credentials } = await oAuth2Client.refreshAccessToken();

    // Update the tokens.json file with the new access token
    fs.writeFileSync('tokens.json', JSON.stringify(credentials, null, 2));

    // Set the new access token
    oAuth2Client.setCredentials(credentials);
  } catch (error) {
    console.error('Error refreshing access token:', error);
  }
}

// Call the function to refresh access token on server start
refreshAccessToken().then(() => {
  console.log('Access token refreshed');
}).catch(console.error);
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const printDetails = JSON.parse(req.body.printDetails);

  if (file) {
    console.log('File uploaded:', file);
    console.log('Print details:', printDetails);

    const { filename, path: filePath } = file;

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    try {
      const folderId = process.env.FOLDER_ID; // Replace with your folder ID

      const fileMetadata = {
        name: filename,
        parents: [folderId],
      };

      const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(filePath),
      };

      const response = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
      });

      const fileData = fs.readFileSync(filePath);
      const pdfData = await pdfParse(fileData);

      let statusCode = await CodeTracker.findOne();

      if (!statusCode) {
        statusCode = new CodeTracker({ currentCode: 1 });
        await statusCode.save();
      } else {
        statusCode.currentCode += 1;
        await statusCode.save();
      }

      const newPrintObject = new ClientDocument({
        fileName: file.originalname,
        documentId: response.data.id,
        color: printDetails.colorMode,
        sidesPerPage: printDetails.pagesPerSheet,
        numberOfCopies: printDetails.numberOfCopies,
        paperType: printDetails.paperType,
        paperSize: printDetails.paperSize,
        softBinding: printDetails.softBinding,
        statusCode: statusCode.currentCode,
        clientEmail: printDetails.clientEmail,
        uniqueCode:statusCode.currentCode,
      });

      await newPrintObject.save();
      fs.unlinkSync(filePath);

      res.json({
        message: `File uploaded successfully. Google Drive file ID: ${response.data.id}, Pages: ${pdfData.numpages}`,
        pages: pdfData.numpages,
        documentId:response.data.id,
        code: statusCode.currentCode,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).send('Error uploading file.');
    }
  } else {
    res.status(400).send('No file uploaded.');
  }
});

app.get("/get-documents", async(req, res) => {
  const fetchedDocuments = await ClientDocument.find({status:true});

  res.json({message:"here are the documents to be printed..,", documents:fetchedDocuments, key:1});
});

// Function to delete file from Google Drive
async function deleteFileFromDrive(fileId) {
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  try {
    await drive.files.delete({
      fileId: fileId,
    });
    console.log('File deleted successfully');
  } catch (error) {
    console.error('Error deleting file:', error.message);
  }
}
app.post("/delete-document", async (req, res) => {
  const { documentId } = req.body;

  const foundDocument = await ClientDocument.findOneAndDelete({ documentId });

  if (foundDocument != null) {
    try {
      await deleteFileFromDrive(documentId);  // Delete the file from Google Drive
      await sendEmail(foundDocument.clientEmail, foundDocument.fileName);
      res.json({ message: "Everything happened smoothly, you can carry on", key: 1 });
    } catch (error) {
      res.status(500).json({ message: "Error deleting document", error: error.message });
    }
  } else {
    res.status(404).json({ message: "Document not found" });
  }
});
// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
