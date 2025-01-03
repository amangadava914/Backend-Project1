import { v2 as Cloudinary } from "cloudinary";
import fs from "fs";

Cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

// console.log("Cloudinary Config:", {
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
// });

const uploadOnCloudinary = async (localFilePath) => {
  try {
    // if (!localFilePath) {
    //   console.log("Please provide a valid file path");
    //   return null;
    // }

    if (!localFilePath) {
      // console.log("Please provide a valid file path");
      return null;
    } else {
      const response = await Cloudinary.uploader.upload(localFilePath, {
        resource_type: "auto",
      });
      // Flie has beem uploaded successfully.
      console.log("File is Uploaded on Cloudinary.", response.url);
      fs.unlinkSync(localFilePath);
      return response;
    }
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed.
    return null;
  }
};

export { uploadOnCloudinary };
