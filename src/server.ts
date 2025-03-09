import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, TypeScript Express API!");
});

app.use("/api/v1" , routes);

if (process.env.NODE_ENV !== 'test') {
  app.listen(3000, () => console.log("Server running on http://localhost:3000"));
}

export default app;