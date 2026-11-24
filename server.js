const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const client = new MongoClient(process.env.MONGODB_URI ||"mongodb://127.0.0.1:27017");

app.use(express.json());
app.use(express.static("public"));

async function startServer() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    const students = client.db("student_management").collection("students");

    app.get("/api/health", (req, res) => res.json({ ok: true }));

    app.get("/api/students", async (req, res) => {
      try {
        const search = (req.query.search || "").trim();
        const filter = search ? { $or: [
          { fullName: { $regex: search, $options: "i" } },
          { regNumber: { $regex: search, $options: "i" } },
          { program: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ] } : {};
        res.json(await students.find(filter).sort({ createdAt: -1 }).toArray());
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Could not load student records." });
      }
    });

    app.post("/api/students", async (req, res) => {
      try {
        const { fullName, regNumber, program, year, email } = req.body;
        if (![fullName, regNumber, program, year, email].every(v => String(v || "").trim()))
          return res.status(400).json({ error: "Please complete all student fields." });
        const student = {
          fullName: String(fullName).trim(), regNumber: String(regNumber).trim(),
          program: String(program).trim(), year: String(year).trim(),
          email: String(email).trim(), createdAt: new Date(), updatedAt: new Date()
        };
        if (await students.findOne({ regNumber: student.regNumber }))
          return res.status(409).json({ error: "That registration number already exists." });
        const result = await students.insertOne(student);
        res.status(201).json({ message: "Student added successfully.", id: result.insertedId });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Could not save the student." });
      }
    });

    app.put("/api/students/:id", async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid student ID." });
        const { fullName, regNumber, program, year, email } = req.body;
        if (![fullName, regNumber, program, year, email].every(v => String(v || "").trim()))
          return res.status(400).json({ error: "Please complete all student fields." });
        const update = {
          fullName: String(fullName).trim(), regNumber: String(regNumber).trim(),
          program: String(program).trim(), year: String(year).trim(),
          email: String(email).trim(), updatedAt: new Date()
        };
        const id = new ObjectId(req.params.id);
        if (await students.findOne({ regNumber: update.regNumber, _id: { $ne: id } }))
          return res.status(409).json({ error: "Another student already uses that registration number." });
        const result = await students.updateOne({ _id: id }, { $set: update });
        if (!result.matchedCount) return res.status(404).json({ error: "Student not found." });
        res.json({ message: "Student updated successfully." });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Could not update the student." });
      }
    });

    app.delete("/api/students/:id", async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid student ID." });
        const result = await students.deleteOne({ _id: new ObjectId(req.params.id) });
        if (!result.deletedCount) return res.status(404).json({ error: "Student not found." });
        res.json({ message: "Student deleted successfully." });
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Could not delete the student." });
      }
    });

    app.listen(PORT, () => console.log(`Student Management System running at http://localhost:${PORT}`));
  } catch (e) {
    console.error("Could not connect to MongoDB:", e.message);
    process.exit(1);
  }
}
startServer();

process.on("SIGINT", async () => { await client.close(); process.exit(0); });
