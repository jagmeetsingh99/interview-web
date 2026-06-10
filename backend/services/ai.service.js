const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY
})

const interviewReportSchema = z.object({
    matchScore: z.number(),
    title: z.string(),
    technicalQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })),
    behavioralQuestions: z.array(z.object({
        question: z.string(),
        intention: z.string(),
        answer: z.string()
    })),
    skillGaps: z.array(z.object({
        skill: z.string(),
        severity: z.enum(["low", "medium", "high"])
    })),
    preparationPlan: z.array(z.object({
        day: z.coerce.number(),
        focus: z.string(),
        tasks: z.array(z.string())
    })),
})

function extractText(response) {
    if (typeof response.text === "string") return response.text
    if (typeof response.text === "function") return response.text()
    const candidate = response?.candidates?.[0]
    const parts = candidate?.content?.parts
    if (parts && parts.length > 0) return parts[0].text
    throw new Error("Could not extract text from AI response: " + JSON.stringify(response).slice(0, 300))
}

function safeParseJson(text) {
    if (!text || typeof text !== "string") {
        throw new Error("Empty or invalid response from AI model")
    }
    const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim()
    try {
        return JSON.parse(cleaned)
    } catch (err) {
        throw new Error(`Failed to parse AI response as JSON.\nRaw: ${text.slice(0, 300)}`)
    }
}

async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 1000 } = {}) {
    let lastError
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err
            const is503 = err.message?.includes("503") ||
                          err.message?.includes("UNAVAILABLE") ||
                          err.message?.includes("high demand")
            if (!is503 || attempt === maxAttempts) throw err
            const waitMs = baseDelayMs * Math.pow(2, attempt - 1)
            console.warn(`⚠️ Gemini 503 on attempt ${attempt}/${maxAttempts}. Retrying in ${waitMs}ms...`)
            await new Promise(res => setTimeout(res, waitMs))
        }
    }
    throw lastError
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    if (!resume || !jobDescription) {
        throw new Error("Resume and job description are required")
    }

    const response = await withRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                role: "user",
                parts: [{
                    text: `Resume: ${resume}\nSelf Description: ${selfDescription || "Not provided"}\nJob Description: ${jobDescription}`
                }]
            }],
            config: {
                responseMimeType: "application/json",
                systemInstruction: `You are an expert technical interviewer and career coach.
Analyze the candidate's resume and job description, then return a JSON object with these exact fields:
- title: job title from the job description
- matchScore: number 0-100
- technicalQuestions: array of { question, intention, answer }
- behavioralQuestions: array of { question, intention, answer }
- skillGaps: array of { skill, severity } where severity is "low" | "medium" | "high"
- preparationPlan: array of { day, focus, tasks } where tasks is an array of strings, day must be an integer number not a string
Return only valid JSON. No markdown, no explanation.`
            }
        })
    )

    const text = extractText(response)
    const parsed = safeParseJson(text)
    const result = interviewReportSchema.safeParse(parsed)
    if (!result.success) {
        throw new Error(`AI response failed schema validation: ${JSON.stringify(result.error.issues, null, 2)}`)
    }
    return result.data
}

async function generatePdfFromHtml(htmlContent) {
    let browser
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ||
                "/opt/render/.cache/puppeteer/chrome/linux-148.0.7778.167/chrome-linux64/chrome",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage"
            ]
        })
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" }
        })
        return pdfBuffer
    } catch (err) {
        throw new Error(`PDF generation failed: ${err.message}`)
    } finally {
        if (browser) await browser.close()
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    if (!resume || !jobDescription) {
        throw new Error("Resume and job description are required")
    }

    const response = await withRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{
                role: "user",
                parts: [{
                    text: `Resume: ${resume}\nSelf Description: ${selfDescription || "Not provided"}\nJob Description: ${jobDescription}`
                }]
            }],
            config: {
                responseMimeType: "application/json",
                systemInstruction: `You are an elite resume designer and career coach specializing in tech industry resumes.

Generate a complete, beautifully designed HTML resume tailored to the job description.
Return ONLY a valid JSON object: { "html": "complete self-contained HTML document" }

DESIGN REQUIREMENTS — follow exactly:
- Use a two-column layout: narrow left sidebar (30%) with dark background (#1a1a2e), wide right main area (70%) with white background
- Left sidebar contains: name, contact info, skills, education — use white text on dark background
- Right main area contains: summary, experience, projects, achievements
- Accent color: #e94560 (use for headings, borders, skill tags, section dividers)
- Name in large bold font (2rem) at top of sidebar in white
- Job title below name in accent color
- Section headings in right panel: uppercase, small font-size, accent color, with a colored bottom border
- Skill tags: small rounded pills with accent background in sidebar
- Use Google Fonts: import Inter from Google Fonts in the <head>
- Clean whitespace, generous padding, professional spacing

CONTENT REQUIREMENTS:
- Include a strong 2-3 sentence professional Summary tailored to the job description
- Keep ALL experience bullet points — do not shorten or remove any
- Keep ALL project details with full descriptions and tech stacks
- Do NOT add a Declaration section
- Highlight skills and keywords from the job description
- Content must sound natural and human-written, not AI-generated
- Make bullet points strong and achievement-focused with metrics where possible

TECHNICAL REQUIREMENTS:
- Complete self-contained HTML with all CSS inline in a <style> tag in <head>
- No external CSS files, no JavaScript
- printBackground friendly — all colors must render in PDF
- ATS-friendly: use semantic tags (h1, h2, h3, ul, li, p, section)
- Optimized for A4 page size, fits 1-2 pages when printed
- No markdown, no explanation — return only the JSON object`
            }
        })
    )

    const text = extractText(response)
    const parsed = safeParseJson(text)
    const resumeSchema = z.object({ html: z.string() })
    const result = resumeSchema.safeParse(parsed)
    if (!result.success) {
        throw new Error(`AI response missing or invalid 'html' field: ${result.error.message}`)
    }

    return await generatePdfFromHtml(result.data.html)
}

module.exports = { generateInterviewReport, generateResumePdf }