import express from "express";
import employeeList from "../api/employee-list.js";
import compliance from "../api/compliance.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.all("/api/employee-list", (req, res) => employeeList(req, res));
app.all("/api/compliance", (req, res) => compliance(req, res));

app.get("/health", (req, res) => res.status(200).send("ok"));

app.use((req, res) => res.status(404).json({ success: false, error: "Not found" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`fabindia-asm API listening on ${PORT}`);
});