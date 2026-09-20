import { randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { addDays, set } from "date-fns"
import { eq } from "drizzle-orm"
import { db, schema, sql } from "./client.js"
import { provisionDefaults } from "../lib/provision.js"

// Demo account used by the "Try the demo account" button in the web app
export const DEMO = { email: "nadia.putri@student.univ.ac.id", password: "welya123" }

const at = (dayOffset: number, hour = 9, minute = 0) => set(addDays(new Date(), dayOffset), { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 }).toISOString()

async function seed() {
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, DEMO.email))
  if (existing[0]) {
    console.log("Demo user exists — wiping their data for a fresh seed")
    await db.delete(schema.users).where(eq(schema.users.id, existing[0].id))
  }

  const uid = randomUUID()
  await db.insert(schema.users).values({
    id: uid,
    email: DEMO.email,
    name: "Nadia Putri",
    passwordHash: await bcrypt.hash(DEMO.password, 10),
    university: "Universitas Teknologi Nusantara",
    program: "Informatics",
    semester: 5,
    verified: true,
  })
  await provisionDefaults(uid)
  // Google services connect through real OAuth now, so the demo account starts disconnected

  await db.insert(schema.courses).values([
    { id: "c1", userId: uid, code: "IF3210", name: "Database Systems", lecturer: "Dr. Rina Kusuma", room: "Lab 3.02", color: "teal", progress: 62, credits: 3, schedule: [{ day: "Mon", start: "08:00", end: "09:40", room: "Lab 3.02", type: "Lecture" }, { day: "Thu", start: "13:00", end: "14:40", room: "Lab 3.02", type: "Practicum" }] },
    { id: "c2", userId: uid, code: "IF3110", name: "Web Programming", lecturer: "Bapak Andi Wijaya, M.Kom", room: "R. 2.14", color: "sky", progress: 48, credits: 3, schedule: [{ day: "Mon", start: "13:00", end: "14:40", room: "R. 2.14", type: "Lecture" }, { day: "Wed", start: "10:00", end: "11:40", room: "Lab 2.01", type: "Practicum" }] },
    { id: "c3", userId: uid, code: "IF3150", name: "Software Engineering", lecturer: "Ibu Sari Dewi, Ph.D", room: "R. 4.05", color: "violet", progress: 55, credits: 3, schedule: [{ day: "Tue", start: "10:00", end: "12:30", room: "R. 4.05", type: "Lecture" }] },
    { id: "c4", userId: uid, code: "IF3130", name: "Computer Networks", lecturer: "Dr. Bayu Pratama", room: "Lab 1.07", color: "amber", progress: 40, credits: 3, schedule: [{ day: "Wed", start: "13:00", end: "14:40", room: "R. 3.11", type: "Lecture" }, { day: "Fri", start: "08:00", end: "09:40", room: "Lab 1.07", type: "Practicum" }] },
    { id: "c5", userId: uid, code: "IF3151", name: "Human Computer Interaction", lecturer: "Ibu Maya Anggraini, M.Sc", room: "R. 2.08", color: "rose", progress: 70, credits: 2, schedule: [{ day: "Thu", start: "08:00", end: "09:40", room: "R. 2.08", type: "Lecture" }] },
  ])

  await db.insert(schema.workspaces).values([
    { id: "w1", userId: uid, name: "Semester 5", description: "All coursework, practicums and exams for this semester.", color: "teal", icon: "GraduationCap", type: "Academic", members: 1 },
    { id: "w2", userId: uid, name: "HIMATIF Organization", description: "Student association events, proposals and committee work.", color: "violet", icon: "Users", type: "Organization", members: 6 },
    { id: "w3", userId: uid, name: "Thesis Preparation", description: "Topic exploration, literature review and supervisor meetings.", color: "amber", icon: "BookOpen", type: "Research", members: 2 },
    { id: "w4", userId: uid, name: "Freelance – Kopi Senja", description: "Landing page and ordering app for a local coffee shop.", color: "rose", icon: "Briefcase", type: "Project", members: 1 },
  ])

  const manual = { type: "manual", label: "Added manually" }
  await db.insert(schema.tasks).values([
    { id: "t1", userId: uid, title: "Database Practicum Report – Module 4", description: "Write the practicum report covering normalization, indexing experiments and query performance analysis.", courseId: "c1", workspaceId: "w1", deadline: at(0, 23, 59), priority: "high", status: "in-progress", estimatedMinutes: 180, progress: 45, subtasks: [{ id: "s1", title: "Collect experiment results", done: true }, { id: "s2", title: "Organize query timing data", done: true }, { id: "s3", title: "Write analysis section", done: false }, { id: "s4", title: "Add references", done: false }], attachments: ["Module4_Guide.pdf", "query_results.csv"], source: { type: "email", label: "Email from Dr. Rina Kusuma", inboxId: "i4" }, notes: "Use the PostgreSQL EXPLAIN ANALYZE output from the lab session." },
    { id: "t2", userId: uid, title: "Web Programming Assignment 3 – REST API", description: "Build a REST API with authentication and connect it to the React front-end.", courseId: "c2", workspaceId: "w1", deadline: at(1, 23, 59), priority: "high", status: "in-progress", estimatedMinutes: 240, progress: 60, subtasks: [{ id: "s5", title: "Set up Express project", done: true }, { id: "s6", title: "Implement JWT auth", done: true }, { id: "s7", title: "Write product endpoints", done: false }, { id: "s8", title: "Connect front-end", done: false }], attachments: ["Assignment3_Spec.pdf"], source: manual },
    { id: "t3", userId: uid, title: "Read Chapter 7 – Software Architecture", description: "Read and summarize chapter 7 before Tuesday's lecture.", courseId: "c3", workspaceId: "w1", deadline: at(2, 10, 0), priority: "medium", status: "todo", estimatedMinutes: 90, progress: 0, attachments: ["SE_Chapter7.pdf"], source: { type: "document", label: "Extracted from SE_Chapter7.pdf" } },
    { id: "t4", userId: uid, title: "Subnetting Exercise Set B", description: "Complete the 12 subnetting problems and submit via LMS.", courseId: "c4", workspaceId: "w1", deadline: at(-1, 23, 59), priority: "medium", status: "todo", estimatedMinutes: 60, progress: 0, source: { type: "message", label: "WhatsApp – Class group" } },
    { id: "t5", userId: uid, title: "HCI Usability Test Plan", description: "Draft the usability testing plan for the campus app redesign.", courseId: "c5", workspaceId: "w1", deadline: at(4, 17, 0), priority: "medium", status: "todo", estimatedMinutes: 120, progress: 10, subtasks: [{ id: "s9", title: "Define user tasks", done: true }, { id: "s10", title: "Write consent form", done: false }, { id: "s11", title: "Prepare metrics sheet", done: false }], source: { type: "email", label: "Email from Ibu Maya" } },
    { id: "t6", userId: uid, title: "Prepare HIMATIF Tech Talk proposal", description: "Budget, rundown and speaker list for the October tech talk.", workspaceId: "w2", deadline: at(6, 12, 0), priority: "low", status: "todo", estimatedMinutes: 150, progress: 0, attachments: ["TechTalk_Template.docx"], source: { type: "message", label: "Telegram – Committee" } },
    { id: "t7", userId: uid, title: "Read 3 papers on recommender systems", description: "Initial literature scan for thesis topic.", workspaceId: "w3", deadline: at(9, 18, 0), priority: "low", status: "todo", estimatedMinutes: 180, progress: 0, source: manual },
    { id: "t8", userId: uid, title: "Database ER Diagram – Case Study", description: "Design ER diagram for the library case study.", courseId: "c1", workspaceId: "w1", deadline: at(-4, 23, 59), priority: "high", status: "done", estimatedMinutes: 120, progress: 100, attachments: ["ERD_Library.png"], source: { type: "email", label: "Email from Dr. Rina Kusuma" }, completedAt: at(-5, 21, 10) },
    { id: "t9", userId: uid, title: "Web Programming Quiz 2 preparation", description: "Review React hooks, routing and state management.", courseId: "c2", workspaceId: "w1", deadline: at(-3, 8, 0), priority: "medium", status: "done", estimatedMinutes: 90, progress: 100, source: manual, completedAt: at(-3, 7, 30) },
    { id: "t10", userId: uid, title: "Kopi Senja – Landing page hero section", description: "Implement hero section with responsive layout and CTA.", workspaceId: "w4", deadline: at(3, 20, 0), priority: "medium", status: "in-progress", estimatedMinutes: 120, progress: 30, attachments: ["hero-design.fig"], source: manual },
    { id: "t11", userId: uid, title: "Network lab report – Wireshark capture", description: "Analyze the TCP handshake capture and answer the lab questions.", courseId: "c4", workspaceId: "w1", deadline: at(-6, 23, 59), priority: "medium", status: "done", estimatedMinutes: 90, progress: 100, source: { type: "document", label: "Extracted from Lab_Guide.pdf" }, completedAt: at(-6, 22, 0) },
  ])

  await db.insert(schema.events).values([
    { id: "e1", userId: uid, title: "Database Systems", type: "class", start: at(0, 8, 0), end: at(0, 9, 40), courseId: "c1", location: "Lab 3.02" },
    { id: "e2", userId: uid, title: "Web Programming", type: "class", start: at(0, 13, 0), end: at(0, 14, 40), courseId: "c2", location: "R. 2.14" },
    { id: "e3", userId: uid, title: "Work on Database report", type: "work-session", start: at(0, 15, 0), end: at(0, 17, 0), courseId: "c1", taskId: "t1", aiPlanned: true },
    { id: "e4", userId: uid, title: "Database report due", type: "deadline", start: at(0, 23, 59), end: at(0, 23, 59), courseId: "c1", taskId: "t1" },
    { id: "e5", userId: uid, title: "Software Engineering", type: "class", start: at(1, 10, 0), end: at(1, 12, 30), courseId: "c3", location: "R. 4.05" },
    { id: "e6", userId: uid, title: "Web Programming Assignment 3 due", type: "deadline", start: at(1, 23, 59), end: at(1, 23, 59), courseId: "c2", taskId: "t2" },
    { id: "e7", userId: uid, title: "Thesis supervisor meeting", type: "meeting", start: at(2, 14, 0), end: at(2, 15, 0), workspaceId: "w3", location: "R. Dosen 3.10" },
    { id: "e8", userId: uid, title: "Web Programming Practicum", type: "class", start: at(2, 10, 0), end: at(2, 11, 40), courseId: "c2", location: "Lab 2.01" },
    { id: "e9", userId: uid, title: "Computer Networks", type: "class", start: at(2, 13, 0), end: at(2, 14, 40), courseId: "c4", location: "R. 3.11" },
    { id: "e10", userId: uid, title: "Human Computer Interaction", type: "class", start: at(3, 8, 0), end: at(3, 9, 40), courseId: "c5", location: "R. 2.08" },
    { id: "e11", userId: uid, title: "Database Practicum", type: "class", start: at(3, 13, 0), end: at(3, 14, 40), courseId: "c1", location: "Lab 3.02" },
    { id: "e12", userId: uid, title: "HIMATIF committee sync", type: "meeting", start: at(3, 16, 0), end: at(3, 17, 0), workspaceId: "w2", location: "Sekretariat" },
    { id: "e13", userId: uid, title: "Computer Networks Practicum", type: "class", start: at(4, 8, 0), end: at(4, 9, 40), courseId: "c4", location: "Lab 1.07" },
    { id: "e14", userId: uid, title: "HCI test plan due", type: "deadline", start: at(4, 17, 0), end: at(4, 17, 0), courseId: "c5", taskId: "t5" },
    { id: "e15", userId: uid, title: "Reminder: bring lab worksheet", type: "reminder", start: at(3, 7, 30), end: at(3, 7, 30), courseId: "c1" },
    { id: "e16", userId: uid, title: "Database Systems", type: "class", start: at(7, 8, 0), end: at(7, 9, 40), courseId: "c1", location: "Lab 3.02" },
    { id: "e17", userId: uid, title: "Web Programming", type: "class", start: at(7, 13, 0), end: at(7, 14, 40), courseId: "c2", location: "R. 2.14" },
    { id: "e18", userId: uid, title: "Software Engineering", type: "class", start: at(-6, 10, 0), end: at(-6, 12, 30), courseId: "c3", location: "R. 4.05" },
    { id: "e19", userId: uid, title: "Web Programming", type: "class", start: at(-7, 13, 0), end: at(-7, 14, 40), courseId: "c2", location: "R. 2.14" },
  ])

  await db.insert(schema.inboxItems).values([
    { id: "i1", userId: uid, source: "email", sender: "Dr. Rina Kusuma", senderEmail: "rina.kusuma@univ.ac.id", subject: "Perubahan jadwal praktikum Basis Data", receivedAt: at(0, 7, 12), preview: "Praktikum Basis Data minggu depan dipindahkan ke hari Kamis pukul 13.00...", body: "Selamat pagi semua,\n\nPraktikum Basis Data minggu depan dipindahkan ke hari Kamis pukul 13.00 di Lab 3.02. Mohon membawa worksheet Modul 5 yang sudah dicetak.\n\nTerima kasih,\nRina", status: "unprocessed", courseId: "c1", importance: "high", ai: { type: "Schedule Change", confidence: 0.94, fields: [{ label: "Course", value: "Database Systems" }, { label: "Date", value: "Thursday (next week)" }, { label: "Time", value: "13:00" }, { label: "Location", value: "Lab 3.02" }, { label: "Action", value: "Update calendar & add reminder to bring worksheet" }], suggestion: "Update the practicum event to Thursday 13:00 and add a reminder to print the Module 5 worksheet.", primaryAction: "Create Event" } },
    { id: "i2", userId: uid, source: "message", sender: "Kelas IF-3B (WhatsApp)", subject: "Info dari Pak Andi", receivedAt: at(0, 6, 40), preview: "Guys, Pak Andi bilang tugas 3 boleh dikumpul sampai Rabu 23.59 tapi ada pengurangan nilai 10%...", body: "Guys, Pak Andi bilang tugas 3 boleh dikumpul sampai Rabu 23.59 tapi ada pengurangan nilai 10% kalau lewat dari besok. Jangan lupa README di repo!", status: "unprocessed", courseId: "c2", importance: "high", ai: { type: "Deadline Update", confidence: 0.88, fields: [{ label: "Course", value: "Web Programming" }, { label: "Task", value: "Assignment 3 – REST API" }, { label: "Original deadline", value: "Tomorrow 23:59" }, { label: "Grace period", value: "Wednesday 23:59 (-10%)" }, { label: "Extra requirement", value: "README in repository" }], suggestion: 'Keep the original deadline and add a subtask "Write README" to Assignment 3.', primaryAction: "Update Task" } },
    { id: "i3", userId: uid, source: "pdf", sender: "LMS – Software Engineering", subject: "Project_Brief_Sprint2.pdf", receivedAt: at(-1, 15, 20), preview: "Sprint 2 deliverables: user stories, architecture diagram, and a working prototype demo on...", body: "Sprint 2 deliverables:\n1. Refined user stories (min. 12)\n2. Architecture diagram (C4 level 2)\n3. Working prototype demo\n\nDemo day: two weeks from Tuesday, 10:00 in R. 4.05. Each team presents for 10 minutes.", status: "unprocessed", courseId: "c3", importance: "normal", ai: { type: "Assignment", confidence: 0.91, fields: [{ label: "Course", value: "Software Engineering" }, { label: "Deliverables", value: "3 items (stories, diagram, demo)" }, { label: "Deadline", value: "Demo day · 2 weeks · 10:00" }, { label: "Estimated effort", value: "~8 hours" }], suggestion: 'Create a task "Sprint 2 deliverables" with 3 subtasks and a demo-day calendar event.', primaryAction: "Create Task" } },
    { id: "i4", userId: uid, source: "email", sender: "Dr. Rina Kusuma", senderEmail: "rina.kusuma@univ.ac.id", subject: "Laporan praktikum Modul 4", receivedAt: at(-3, 9, 5), preview: "Laporan praktikum dikumpulkan Jumat pukul 23.59 melalui LMS...", body: "Laporan praktikum Modul 4 dikumpulkan Jumat pukul 23.59 melalui LMS. Format PDF, maksimal 10 halaman.", status: "processed", courseId: "c1", importance: "high", resultTaskId: "t1", ai: { type: "Academic Task", confidence: 0.96, fields: [{ label: "Course", value: "Database Systems" }, { label: "Deadline", value: "Friday 23:59" }, { label: "Format", value: "PDF, max 10 pages" }], suggestion: "Task created: Database Practicum Report – Module 4.", primaryAction: "Create Task" } },
    { id: "i5", userId: uid, source: "screenshot", sender: "You (screenshot)", subject: "Screenshot – LMS announcement", receivedAt: at(-1, 20, 45), preview: "UTS Jaringan Komputer dilaksanakan 2 minggu lagi, materi bab 1–5, closed book...", body: "UTS Jaringan Komputer dilaksanakan 2 minggu lagi, materi bab 1–5, closed book. Ruang akan diumumkan menyusul.", status: "unprocessed", courseId: "c4", importance: "normal", ai: { type: "Exam Announcement", confidence: 0.83, fields: [{ label: "Course", value: "Computer Networks" }, { label: "Exam", value: "Midterm (UTS)" }, { label: "Date", value: "In 2 weeks" }, { label: "Scope", value: "Chapters 1–5 · closed book" }], suggestion: "Create a study plan with 5 review sessions spread over the next two weeks.", primaryAction: "Create Task" } },
    { id: "i6", userId: uid, source: "email", sender: "Biro Akademik", senderEmail: "akademik@univ.ac.id", subject: "Pengisian KRS Semester Genap", receivedAt: at(-2, 8, 0), preview: "Pengisian KRS dibuka tanggal 2–9 bulan depan. Pastikan tidak ada tunggakan...", body: "Pengisian KRS dibuka tanggal 2–9 bulan depan. Pastikan tidak ada tunggakan pembayaran sebelum periode dimulai.", status: "unprocessed", importance: "low", ai: { type: "Administrative", confidence: 0.79, fields: [{ label: "Category", value: "Academic administration" }, { label: "Window", value: "2–9 next month" }, { label: "Prerequisite", value: "No outstanding payments" }], suggestion: "Save as a reminder for the KRS window opening.", primaryAction: "Create Reminder" } },
    { id: "i7", userId: uid, source: "document", sender: "Ibu Maya Anggraini", subject: "HCI_Week9_Slides.pdf", receivedAt: at(-4, 11, 30), preview: "Week 9: Usability testing methods – think aloud, SUS questionnaire, task success metrics...", body: "Week 9: Usability testing methods – think aloud, SUS questionnaire, task success metrics. Reading: Nielsen (1994) ch. 6.", status: "processed", courseId: "c5", importance: "low", resultDocumentId: "d3", ai: { type: "Lecture Material", confidence: 0.9, fields: [{ label: "Course", value: "Human Computer Interaction" }, { label: "Topic", value: "Usability testing" }, { label: "Reading", value: "Nielsen (1994) ch. 6" }], suggestion: "Saved to Documents and linked to the course.", primaryAction: "Save as Note" } },
    { id: "i8", userId: uid, source: "manual", sender: "You", subject: "Ingat: tanya Pak Bayu soal tugas subnetting", receivedAt: at(-1, 18, 10), preview: "Tanya apakah exercise set B boleh dikumpul terlambat...", body: "Tanya apakah exercise set B boleh dikumpul terlambat karena sakit minggu lalu.", status: "ignored", courseId: "c4", importance: "low", ai: { type: "Personal Note", confidence: 0.7, fields: [{ label: "Course", value: "Computer Networks" }], suggestion: "Save as a note attached to Subnetting Exercise Set B.", primaryAction: "Save as Note" } },
  ])

  await db.insert(schema.documents).values([
    { id: "d1", userId: uid, title: "Module4_Guide.pdf", type: "pdf", courseId: "c1", workspaceId: "w1", size: "1.2 MB", uploadedAt: at(-3, 9, 10), pages: 14, summary: "Practicum guide covering normalization to 3NF, B-tree indexing and EXPLAIN ANALYZE experiments.", linkedTaskIds: ["t1"], tags: ["practicum", "guide"] },
    { id: "d2", userId: uid, title: "Assignment3_Spec.pdf", type: "pdf", courseId: "c2", workspaceId: "w1", size: "640 KB", uploadedAt: at(-8, 14, 0), pages: 6, summary: "Specification for a REST API with JWT auth, CRUD endpoints, and a React client.", linkedTaskIds: ["t2"], tags: ["assignment"] },
    { id: "d3", userId: uid, title: "HCI_Week9_Slides.pdf", type: "pdf", courseId: "c5", workspaceId: "w1", size: "3.8 MB", uploadedAt: at(-4, 11, 30), pages: 42, summary: "Usability testing methods: think-aloud protocol, SUS questionnaire, task success metrics.", linkedTaskIds: ["t5"], tags: ["lecture"] },
    { id: "d4", userId: uid, title: "SE_Chapter7.pdf", type: "pdf", courseId: "c3", workspaceId: "w1", size: "2.1 MB", uploadedAt: at(-5, 16, 45), pages: 28, summary: "Software architecture styles: layered, event-driven, microservices; quality attributes and trade-offs.", linkedTaskIds: ["t3"], tags: ["reading"] },
    { id: "d5", userId: uid, title: "Lecture notes – Indexing & query plans", type: "note", courseId: "c1", workspaceId: "w1", size: "—", uploadedAt: at(-2, 10, 0), summary: "Personal notes from Monday lecture on B-tree vs hash indexes and reading query plans.", linkedTaskIds: ["t1"], tags: ["notes"], content: "B-tree indexes: ordered, good for range queries. Hash: equality only. EXPLAIN ANALYZE shows actual vs estimated rows — big gaps mean stale statistics (run ANALYZE)." },
    { id: "d6", userId: uid, title: "Screenshot – LMS announcement", type: "image", courseId: "c4", workspaceId: "w1", size: "420 KB", uploadedAt: at(-1, 20, 45), summary: "Midterm announcement for Computer Networks: chapters 1–5, closed book.", tags: ["announcement"] },
    { id: "d7", userId: uid, title: "TechTalk_Template.docx", type: "doc", workspaceId: "w2", size: "88 KB", uploadedAt: at(-6, 13, 20), summary: "Proposal template for HIMATIF events: background, budget table, rundown, committee.", linkedTaskIds: ["t6"], tags: ["template"] },
    { id: "d8", userId: uid, title: "Thesis ideas – recommender systems", type: "note", workspaceId: "w3", size: "—", uploadedAt: at(-9, 21, 0), summary: "Brainstorm: hybrid recommenders for campus library, cold-start problem, evaluation metrics.", linkedTaskIds: ["t7"], tags: ["thesis", "ideas"], content: "Possible angle: hybrid content + collaborative filtering for the campus library catalog. Need baseline datasets. Ask supervisor about access to borrowing logs." },
    { id: "d9", userId: uid, title: "Kopi Senja – hero-design.fig", type: "doc", workspaceId: "w4", size: "—", uploadedAt: at(-2, 19, 0), summary: "Figma link for hero section: warm palette, large product photo, single CTA.", linkedTaskIds: ["t10"], tags: ["design"] },
  ])

  await db.insert(schema.notifications).values([
    { id: "n1", userId: uid, type: "deadline", title: "Database report due tonight", message: "Database Practicum Report – Module 4 is due at 23:59. You're 45% done.", time: at(0, 7, 0), read: false, link: "/tasks?task=t1" },
    { id: "n2", userId: uid, type: "inbox", title: "3 new items processed by Welya", message: "A schedule change, a deadline update and an exam announcement are waiting for your confirmation.", time: at(0, 7, 15), read: false, link: "/inbox" },
    { id: "n3", userId: uid, type: "ai", title: "Free time detected this afternoon", message: "You have 2 free hours from 15:00. Welya suggests working on the Database report.", time: at(0, 6, 30), read: false, link: "/calendar" },
    { id: "n4", userId: uid, type: "class", title: "Database Systems starts in 30 minutes", message: "Lab 3.02 · 08:00–09:40", time: at(0, 7, 30), read: true, link: "/courses/c1" },
    { id: "n5", userId: uid, type: "missed", title: "Missed deadline: Subnetting Exercise Set B", message: "This task was due yesterday. Consider asking Dr. Bayu for an extension.", time: at(0, 0, 5), read: false, link: "/tasks?task=t4" },
    { id: "n6", userId: uid, type: "calendar", title: "Calendar updated", message: "Thesis supervisor meeting added for Wednesday 14:00.", time: at(-1, 16, 20), read: true, link: "/calendar" },
    { id: "n7", userId: uid, type: "deadline", title: "Web Programming Assignment 3 due tomorrow", message: "60% complete · ~1.5 hours of work remaining.", time: at(-1, 9, 0), read: true, link: "/tasks?task=t2" },
    { id: "n8", userId: uid, type: "ai", title: "Weekly review is ready", message: "Last week you completed 3 tasks. Take a look at what's coming.", time: at(-1, 8, 0), read: true, link: "/review" },
  ])

  await db.insert(schema.conversations).values([
    {
      id: "conv1", userId: uid, title: "Today's plan", updatedAt: at(0, 7, 20),
      messages: [
        { id: "m1", role: "user", content: "What do I need to finish today?", time: at(0, 7, 18) },
        { id: "m2", role: "assistant", content: "You have 3 tasks that need attention today. The Database Practicum Report is your highest priority — it's due tonight at 23:59 and you're 45% done. Your Web Programming assignment is due tomorrow, and the Subnetting Exercise is already overdue.", time: at(0, 7, 19), references: [{ type: "task", id: "t1", label: "Database Practicum Report" }, { type: "task", id: "t2", label: "Web Programming Assignment 3" }, { type: "task", id: "t4", label: "Subnetting Exercise Set B" }], actions: [{ id: "a1", label: "Plan my afternoon", kind: "plan" }, { id: "a2", label: "Open Database report", kind: "open-task", targetId: "t1" }] },
      ],
    },
    {
      id: "conv2", userId: uid, title: "Sprint 2 breakdown", updatedAt: at(-1, 15, 40),
      messages: [
        { id: "m3", role: "user", content: "Help me organize the Software Engineering sprint 2 brief.", time: at(-1, 15, 38) },
        { id: "m4", role: "assistant", content: "I read Project_Brief_Sprint2.pdf. There are three deliverables due on demo day in two weeks. I suggest creating one task with three subtasks and reserving two 2-hour work sessions next week.", time: at(-1, 15, 39), references: [{ type: "document", id: "d4", label: "Project_Brief_Sprint2.pdf" }], actions: [{ id: "a3", label: "Create task with subtasks", kind: "create-task" }] },
      ],
    },
  ])

  console.log(`Seeded demo user ${DEMO.email} (password: ${DEMO.password})`)
}

seed()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => sql.end())
