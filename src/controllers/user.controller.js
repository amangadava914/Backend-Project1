import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const genertaeAccessandRefereshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateAccessToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating Acces and Referesh tokens"
    );
  }
};

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
  const { fullName, email, username, password } = req.body; // this provide only raw data not a file data or url data
  // console.log(req.body);
  console.log("User: " + username);
  console.log("Email: " + email);
  // for taking file data we use multer as a middleware to take file data in betwwen any processing
  // check user.routes.js file where we write a code to take avatar and coverimage data using multer as a middleware

  // 2. Check Validation - Not Empty
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // 3. Check if the user already exists - username, email (basis on)
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  // console.log(existedUser);
  if (existedUser) {
    throw new ApiError(409, "Username or Email is already exists");
  }
  console.log(req.files);

  // 4. check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // console.log(req.field);
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  // 5. upload them (images, avatar) to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
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

const loginUser = asyncHandler(async (req, res) => {
  /*
  Todo's for login ( dnt know if its good )
- take input from the user from the login page.
- save it in a variable
- apply check ( as per js series form handling part ) if the username == username && password == password . Then perform some action.
- call mongodb to check the db if there is any user with the same username ( email in case ) is present or not , if not throw err . And redirect to register (dnt know how, will plan if situation arise)
-  if username/email present. Then get its _id and store it in variable 
- retreive username and pass from that variable to check if both are same or not. If no then err
- if yes then redirect it to the page we want.

/*
Login Algorithm
1. Take data from the user or client (req.body).
2. Check the validation of the data (empty or not).
3. Check the data ((username || email ) && password) that are exist or not in the database.
4. If the user is exist logged in (give access) or if user is not exist give the error msg.
5. Assign the access token (if user exist).
6. Give the Success response.
  */

  // 1. Take data from the user or client (req.body).
  const { username, email, password } = req.body;
  // console.log(email);

  if (!username && !email) {
    throw new ApiError(400, "Username or Email is required");
  }

  // Alternative way to check if username or email is empty
  // if (!(username || email)) {
  //   throw new ApiError(400, "Password is required");
  // }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  // 5. Assign the access token (if user exist).
  const { accessToken, refreshToken } = await genertaeAccessandRefereshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // give the token to the User as a cookie (Modifiedable only on the server side bcuz of httpOnly and secure).
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(400, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(404, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await genertaeAccessandRefereshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access Token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isOldPasswordCorrect = await User.isPasswordCorrect(oldPassword);
  if (!isOldPasswordCorrect) {
    throw new ApiError(400, "Invalid Old Password");
  }

  user.password = newPassword;
  if (!(newPassword === confirmPassword)) {
    throw new ApiError(400, "New Password and Confirm Password does not match");
  }
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!(fullName || email)) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User details updated successfully"));
});

// Aggeregation Pipeline
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on Avatar file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar Image is Updated Successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImagelocalPath = req.file?.path;
  if (!coverImagelocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImagelocalPath);
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading Cover Image file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image is Updated Successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subcriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        channelSubscribedToCount: { $size: "$subscribedTo" },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        subscribersCount: 1,
        channelSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        createdAt: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel not found");
  }
  // console.log(channel);

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "Channel Profile Fetched Successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch History Fetched Successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
