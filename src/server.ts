import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes";
import fileUpload from "express-fileupload";


dotenv.config({ path: "./.env" });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(fileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());

app.get("/", async (req, res) => {
  res.send("Hello, TypeScript Express API!");
});

app.use("/api/v1" , routes);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log("Server running on http://localhost:" + PORT));
}

export default app;
