// const pdfParse = require("pdf-parse")
const pdfParse = require("pdf-parse/lib/pdf-parse.js")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interview.model")

async function generateInterViewReportController(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume file is required." })
        }
        const { selfDescription, jobDescription } = req.body
        if (!selfDescription || !jobDescription) {
            return res.status(400).json({ message: "selfDescription and jobDescription are required." })
        }

        console.log("=== PARSING PDF ===")
        const resumeContent = await pdfParse(req.file.buffer)
        console.log("=== PDF PARSED ===", resumeContent.text.slice(0, 100))

        console.log("=== CALLING AI ===")
        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription,
            jobDescription
        })
        console.log("=== AI DONE ===")

        console.log("=== SAVING TO DB ===")
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })
        console.log("=== DB SAVED ===")

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (err) {
        console.error("=== CONTROLLER ERROR ===")
        console.error("Message:", err.message)
        console.error("Stack:", err.stack)
        res.status(500).json({ message: "Internal server error.", error: err.message })
    }
}

async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params
        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })
        if (!interviewReport) {
            return res.status(404).json({ message: "Interview report not found." })
        }
        res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        })
    } catch (err) {
        console.error("getInterviewReportByIdController:", err.message)
        res.status(500).json({ message: "Internal server error.", error: err.message })
    }
}

async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

        res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        })
    } catch (err) {
        console.error("getAllInterviewReportsController:", err.message)
        res.status(500).json({ message: "Internal server error.", error: err.message })
    }
}

async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params
        const interviewReport = await interviewReportModel.findById(interviewReportId)
        if (!interviewReport) {
            return res.status(404).json({ message: "Interview report not found." })
        }

        const { resume, jobDescription, selfDescription } = interviewReport
        const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })
        res.send(pdfBuffer)
    } catch (err) {
        console.error("generateResumePdfController:", err.message)
        res.status(500).json({ message: "Internal server error.", error: err.message })
    }
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController
}