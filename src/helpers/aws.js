const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { Readable } = require("stream");

// Initialize the S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION, // Ensure this is set in your environment variables
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Ensure this is set in your environment variables
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Ensure this is set in your environment variables
  },
});

// Function to fetch a file from an S3 bucket
const fetchFileFromS3 = async (bucketName, key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    console.log(`[Terracotta] → [AWS] Fetched file from S3: ${bucketName}/${key}`);

    // Convert the response body to a Buffer
    const stream = response.Body;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error fetching file from S3:", error);
    throw error;
  }
};

module.exports = {
  fetchFileFromS3,
};
