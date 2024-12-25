// console.dir(req.ip);

import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// Router import
import userRouter from "./routes/user.routes.js";

// Router Declaration
app.use("/api/v1/users", userRouter);

//https://localhost:8000/api/v1/users/register
//https://localhost:8000/api/v1/users/login

export { app };
