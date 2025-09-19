const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const connectDB = require("./config/db");
const router = require("./routes");
const webhooks = require("./controller/order/webhook");
const chatbotRoutes = require("./routes/chatbot.routes.js");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.post("/api/webhook", express.raw({ type: "application/json" }), webhooks);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());


app.use("/api", router);
app.use("/api", chatbotRoutes);

const PORT = process.env.PORT || 8080;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("Connect Successfully!");
  });
});
