import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../models/uploadOnCloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // res.status(200).json({
  //   message: "User Registered Successfully",
  // });
  // Resgister user algorithm
  // 1. Get the user data from the request body or Frontend
  // 2. Check Validation - Not Empty
  // 3. Check if the user already exists - username, email (basis on)
  // 4. check for images, check for avatar
  // 5. upload them (images, avatar) to cloudinary, avatar
  // 6. create user object - create entry in DB
  // 7. remove password and refresh token field from response
  // 8. Check for user creation
  // 9. return response

  // 1. Get the user data from the request body or Frontend
  const { username, email, fullName, password } = req.body; // this provide only raw data not a file data or url data
  // console.log(req.body);
  console.log("User: " + username);
  console.log("Email: " + email);
  // for taking file data we use multer as a middleware to take file data in betwwen any processing
  // check user.routes.js file where we write a code to take avatar and coverimage data using multer as a middleware

  // 2. Check Validation - Not Empty
  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // 3. Check if the user already exists - username, email (basis on)
  const existedUser = User.findOne({ $or: [{ username }, { email }] });
  // console.log(existedUser);
  if (existedUser) {
    throw new ApiError(409, "Username or Email is already exists");
  }

  // 4. check for images, check for avatar
  const avatarLocalPath = req.field?.avatar[0]?.path;
  // console.log(req.field);
  const coverImageLocalPath = req.field?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  // 5. upload them (images, avatar) to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar || !coverImage) {
    throw new ApiError(500, "Failed to upload image on Cloudinary");
  }

  // 6. create user object - create entry in DB
  const user = await User.create({
    fullName,
    username: username.toLowerCase(),
    email,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  // 7. remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // 8. Check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // 9. return response
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        createdUser,
        "User created or registered successfully"
      )
    );
});

export { registerUser };
