import type {
  CourseCatalogSource,
  CourseTerm,
  Pathway,
} from "../src/validators";

export type CourseSeed = {
  slug: string;
  title: string;
  courseNumbers: string[];
  department: string;
  pathway?: Pathway | null;
  catalogSource: CourseCatalogSource;
  term: CourseTerm;
  gradeText: string;
  minGrade: number | null;
  maxGrade: number | null;
  prerequisitesText?: string | null;
  summary: string;
  majorTopics?: string | null;
  essentialSkills?: string | null;
  studentWorkload?: string | null;
  teacherWorkload?: string | null;
};

function catalogCourse(
  input: Omit<CourseSeed, "catalogSource"> & {
    catalogSource?: CourseSeed["catalogSource"];
  },
): CourseSeed {
  return {
    catalogSource: "COURSE_CATALOG",
    ...input,
  };
}

function mergedApCourse(input: Omit<CourseSeed, "catalogSource">): CourseSeed {
  return {
    catalogSource: "MERGED",
    ...input,
  };
}

export const COURSE_SEEDS: CourseSeed[] = [
  catalogCourse({
    slug: "element-six-medicine-arts-meaning",
    title:
      "Element Six: An Interdisciplinary Exploration in Medicine, Arts & Meaning",
    courseNumbers: ["23.0670001", "23.0670002", "25.4360001", "25.4360002"],
    department: "Dual Enrollment",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Lit/Comp I and II credit with 90 or above, teacher recommendation, and Health Science pathway completion of Intro to Healthcare and Essentials of Healthcare.",
    summary:
      "An interdisciplinary IA dual course that pairs multicultural literature with patient-care fundamentals through clinical simulation, medical humanities, and original writing.",
    majorTopics:
      "Narrative medicine, provider and patient perspectives in art, memoir and poetry analysis, field interviews, high-fidelity simulation lab training, phlebotomy, EKGs, vital signs, wound care, clinical judgment.",
  }),

  catalogCourse({
    slug: "foundations-of-engineering-and-technology",
    title: "Foundations of Engineering & Technology",
    courseNumbers: ["21.4250001", "21.4250002"],
    department: "Engineering",
    pathway: "ENGINEERING",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "None.",
    summary:
      "The engineering foundation course introduces students to design thinking, fabrication, robotics, CAD, and technical communication through GT Block-aligned projects.",
    majorTopics:
      "Decision matrices, Gantt charts, Excel data, CAD, 3D printing, DC circuits, robotics, programming in C, measuring and dimensioning, tool safety, heat transfer, free body diagrams, presentation skills.",
  }),
  catalogCourse({
    slug: "engineering-concepts",
    title: "Engineering Concepts",
    courseNumbers: ["21.4710001", "21.4710002"],
    department: "Engineering",
    pathway: "ENGINEERING",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Foundations of Engineering & Technology.",
    summary:
      "Students extend their engineering foundation with advanced CAD, fabrication, electronics, robotics, and mechatronics-oriented problem solving.",
    majorTopics:
      "Advanced CAD, assemblies, tolerances, DC circuits, waves, soldering, data analysis, power tools, laser engravers, C++, robotics, mechanical advantage, simple machines, OSHA certification.",
  }),
  catalogCourse({
    slug: "engineering-applications",
    title: "Engineering Applications",
    courseNumbers: ["21.4720001", "21.4720002"],
    department: "Engineering",
    pathway: "ENGINEERING",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText:
      "Foundations of Engineering & Technology and Engineering Concepts.",
    summary:
      "The third engineering pathway course applies CAD, fabrication, robotics, pneumatics, and machining to production-grade prototypes and pathway exam preparation.",
    majorTopics:
      "GD&T, rendering, parametric modeling, pneumatics, CNC, milling, plasma cutting, TIG welding, compound machines, C++, SolidWorks certification preparation.",
  }),
  catalogCourse({
    slug: "research-design-and-project-management",
    title: "Research, Design, and Project Management",
    courseNumbers: ["21.4610001", "21.4610002"],
    department: "Engineering",
    pathway: "ENGINEERING",
    term: "YEAR",
    gradeText: "12",
    minGrade: 12,
    maxGrade: 12,
    prerequisitesText: "Engineering Applications.",
    summary:
      "Engineering seniors study project management, architectural modeling, applied research, and advanced communication through capstone design work.",
    majorTopics:
      "Revit, rendering, VR compatibility, beam deflection, truss analysis, heat transfer, surveying, site preparation, water runoff calculations, Revit certification preparation.",
  }),

  catalogCourse({
    slug: "introduction-to-software-technology",
    title: "Introduction to Software Technology",
    courseNumbers: ["11.4460001", "11.4460002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "None.",
    summary:
      "IA’s GT Block software foundation introduces programming, software development, app creation, and user interface thinking through project-based work.",
    majorTopics:
      "Programming languages, software development, app creation, user interfacing applications, hands-on project work.",
  }),
  mergedApCourse({
    slug: "ap-computer-science-principles",
    title: "AP Computer Science Principles",
    courseNumbers: ["11.0190001", "11.0190002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "10-11",
    minGrade: 10,
    maxGrade: 11,
    prerequisitesText:
      "Introduction to Software Technology / GT Block Introduction to Digital Technology.",
    summary:
      "An introductory AP computer science course focused on computational thinking, programming, data analysis, creativity, and the social impact of computing.",
    majorTopics:
      "Programming, algorithms, data analysis, computational artifacts, collaboration, computing systems, the impact of computing, portfolio project work.",
    essentialSkills:
      "Written communication, logical problem solving, following detailed project rubrics, and self-direction on a long-term portfolio project.",
    studentWorkload: "1.5 hours per week",
    teacherWorkload: "1-2 hours per week",
  }),
  mergedApCourse({
    slug: "ap-cybersecurity",
    title: "AP Cybersecurity",
    courseNumbers: ["11.4811011", "11.4811012"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Advanced Cybersecurity or test-in.",
    summary:
      "A yearlong AP Career Kickstart course introducing cybersecurity through hands-on, authentic scenarios and foundational skills for protecting systems, data, and organizations.",
    majorTopics:
      "Introduction to security, social engineering, physical-space security, network security, device security, application and data security, risk analysis and mitigation, attack detection, collaboration.",
    essentialSkills:
      "Analyze risk, implement protective controls, detect attacks, investigate problems, communicate cybersecurity concepts, assess impacts, and collaborate to enact solutions.",
  }),
  catalogCourse({
    slug: "foundations-of-artificial-intelligence",
    title: "Foundations of Artificial Intelligence",
    courseNumbers: ["11.4430001", "11.4430002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText:
      "GT Block IT teacher recommendation and Advanced Algebra Honors with 88 unweighted or above, or Geometry Honors with 88 unweighted or above. AP Computer Science Principles may serve as a corequisite.",
    summary:
      "The introductory AI pathway course prepares students to understand common AI applications and use programming, data science, and mathematical reasoning to solve real-world problems.",
    majorTopics:
      "Artificial intelligence in society and work, programming, data science, mathematical reasoning, creative problem solving, ethical reasoning, real-world AI applications.",
  }),
  catalogCourse({
    slug: "artificial-intelligence-concepts",
    title: "Artificial Intelligence Concepts",
    courseNumbers: ["11.4440001", "11.4440002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText: "Foundations of Artificial Intelligence.",
    summary:
      "Students deepen their AI foundation with more advanced machine learning concepts, data science workflows, and ethical problem framing.",
    majorTopics:
      "Machine learning concepts, programming with data, real-world AI applications, benefits and risks of AI, ethical design of AI solutions.",
  }),
  catalogCourse({
    slug: "artificial-intelligence-applications",
    title: "Artificial Intelligence Applications",
    courseNumbers: ["11.4450001", "11.4450002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "12",
    minGrade: 12,
    maxGrade: 12,
    prerequisitesText: "Artificial Intelligence Concepts.",
    summary:
      "AI seniors design and apply functional machine-learning solutions with professional software development tools and processes.",
    majorTopics:
      "Machine learning implementation, neural networks, embedded computing integrations, software development workflows, real-world AI solution design.",
  }),
  mergedApCourse({
    slug: "ap-computer-science-a",
    title: "AP Computer Science A",
    courseNumbers: ["11.0160011", "11.0160012"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Introduction to Digital Technology, AP Computer Science Principles, and teacher recommendation.",
    summary:
      "A college-level Java programming course covering problem solving, object-oriented design, data structures, algorithms, and the ethical and social dimensions of computing.",
    majorTopics:
      "Java, object-oriented programming, imperative programming, data structures, algorithms, program design, ethical and social aspects of computing.",
    essentialSkills:
      "Strong programming skills from AP Computer Science Principles, logical program development, rigorous testing, code tracing, creative problem solving, and perseverance.",
    studentWorkload: "2.25 hours per week",
    teacherWorkload: "2 hours per week",
  }),
  catalogCourse({
    slug: "introduction-to-cybersecurity",
    title: "Introduction to Cybersecurity",
    courseNumbers: ["11.4810001", "11.4810002", "11.4480001", "11.4480002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "10-11",
    minGrade: 10,
    maxGrade: 11,
    prerequisitesText: "Introduction to Software Technology / GT Block.",
    summary:
      "IA’s cybersecurity introduction blends cybersecurity concepts with embedded hardware foundations, IT support, networks, and applied digital safety practices.",
    majorTopics:
      "Threats to network security, user training, security ethics, trust, hardware foundations, IT support, networks, device security, best-practice management.",
  }),
  catalogCourse({
    slug: "game-design-animation-and-simulation",
    title: "Game Design: Animation and Simulation",
    courseNumbers: ["11.4290001", "11.4290002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "AP Computer Science Principles.",
    summary:
      "Students study game genres, player experience, animation, and systems design through iterative, project-based game creation.",
    majorTopics:
      "Game genres, play modes, player psychology, level design, storytelling, animation, mechanics, game loops, hands-on game projects.",
  }),
  catalogCourse({
    slug: "embedded-computing",
    title: "Embedded Computing",
    courseNumbers: ["11.4270001", "11.4270002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "AP Computer Science Principles.",
    summary:
      "An Internet of Things pathway course focused on programming physical hardware, interpreting sensor data, and designing practical embedded systems.",
    majorTopics:
      "Sensors, hardware-software interaction, Internet of Things applications, programming for devices, human-centered embedded design.",
  }),
  catalogCourse({
    slug: "advanced-cybersecurity",
    title: "Advanced Cybersecurity",
    courseNumbers: ["11.4820001", "11.4820002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Introduction to Cybersecurity.",
    summary:
      "Students extend foundational cybersecurity knowledge into malware, cryptography, wireless systems, organizational security, and contemporary defensive practice.",
    majorTopics:
      "Malware threats, cryptography, organizational security, wireless technologies, contemporary cybersecurity methods and innovations.",
  }),
  catalogCourse({
    slug: "programming-games-apps-and-society",
    title: "Programming, Games, Apps, and Society",
    courseNumbers: ["11.4720001", "11.4720002"],
    department: "Information Technology",
    pathway: "INFORMATION_TECHNOLOGY",
    term: "YEAR",
    gradeText: "12",
    minGrade: 12,
    maxGrade: 12,
    prerequisitesText:
      "Completion of AP Computer Science A, Game Design, or Embedded Computing, plus teacher recommendation, in grade 12.",
    summary:
      "A senior IT elective focused on designing and developing games and software products with attention to product lifecycles, usability, and software ethics.",
    majorTopics:
      "Application and game development lifecycles, UI and UX, programming constructs tied to real-world input, privacy, legality, and software security.",
  }),

  catalogCourse({
    slug: "intro-to-healthcare-science",
    title: "Intro to Healthcare Science",
    courseNumbers: ["25.5210001", "25.5210002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "None.",
    summary:
      "The foundational health-science course introduces healthcare careers, employability, communication, wellness, clinical competencies, and basic patient-care thinking.",
    majorTopics:
      "Human growth and development, patient and family interaction, wellness and preventive care, legal and ethical responsibilities, basic healthcare skills, microbiology, basic life support, first aid.",
  }),
  catalogCourse({
    slug: "essentials-of-healthcare",
    title: "Essentials of Healthcare",
    courseNumbers: ["25.4400001", "25.4400002", "26.0730001", "26.0730002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText: "Introduction to Healthcare Science.",
    summary:
      "A second health-science pathway course combining essentials of healthcare with anatomy and physiology to connect disease processes, procedures, and clinical reasoning.",
    majorTopics:
      "Body systems, diseases and disorders, prevention, diagnosis and treatment, medical terminology, pathophysiology, procedure-skill connections.",
  }),
  catalogCourse({
    slug: "emergency-medical-responder",
    title: "Emergency Medical Responder",
    courseNumbers: ["25.4500001", "25.4500002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Introduction to Healthcare Science.",
    summary:
      "The EMR pathway course prepares students to provide initial stabilizing care and assist emergency medical services personnel.",
    majorTopics:
      "Medical terminology, anatomy and physiology, responder safety, incident command, blood-borne pathogens, physical assessment, trauma care, CPR, AED, airway management, shock, EMS operations.",
  }),
  catalogCourse({
    slug: "allied-health-and-medicine",
    title: "Allied Health and Medicine",
    courseNumbers: ["25.4370001", "25.4370002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Intro to Healthcare and Essentials of Healthcare.",
    summary:
      "A multi-skill health pathway course that gives students broad clinical exposure and preparation toward medical assistant competencies.",
    majorTopics:
      "Medical terminology, PPE, lab values, vitals, procedures, phlebotomy, pharmacology, microbiology, EKGs, disease processes, patient-centered clinical practice.",
  }),
  catalogCourse({
    slug: "surgical-technician-i",
    title: "Surgical Technician I",
    courseNumbers: ["25.4470001", "25.4470002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Intro to Healthcare and Essentials of Healthcare.",
    summary:
      "Students learn perioperative safety, infection control, instrumentation, and case management within the surgical technician pathway.",
    majorTopics:
      "Surgical technology orientation, legal concepts, risk management, patient safety, biomedical science, disease transmission prevention, pharmacology, anesthesia, instrumentation, wound closure, diagnostic procedures, surgical specialties.",
  }),
  catalogCourse({
    slug: "pharmacy-operations-and-fundamentals",
    title: "Pharmacy Operations and Fundamentals",
    courseNumbers: ["25.45300001", "25.45300002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Intro to Healthcare and Essentials of Healthcare.",
    summary:
      "An introduction to pharmacy technology, dosage calculation, medication handling, and simulated medication preparation across clinical and community settings.",
    majorTopics:
      "Pharmacy settings, natural and synthetic drugs, regulations and standards, medical and pharmaceutical terminology, prescriptions, dosage forms, IV setup, compounding techniques.",
  }),
  catalogCourse({
    slug: "essentials-of-biotechnology",
    title: "Essentials of Biotechnology",
    courseNumbers: ["25.5700001", "25.5700002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText: "Introduction to Healthcare Science.",
    summary:
      "The biotechnology pathway introduction surveys bioscience careers, lab fundamentals, ethics, and regulatory context.",
    majorTopics:
      "Lab safety, solutions and dilutions, micropipetting, spectrophotometry, DNA and protein synthesis, immune response, PCR, restriction enzymes, gel electrophoresis, CRISPR assays, germ theory.",
  }),
  catalogCourse({
    slug: "applications-of-biotechnology",
    title: "Applications of Biotechnology",
    courseNumbers: ["25.5690001", "25.5690002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText:
      "Introduction to Healthcare Science and Essentials of Biotechnology.",
    summary:
      "Students extend biotechnology foundations into laboratory applications connected to pharmaceutical, environmental, forensic, and synthetic-biology work.",
    majorTopics:
      "Protein quantification, enzyme reactions, tissue culture, drug discovery, immune response quantification, synthetic biology, gene expression.",
  }),
  catalogCourse({
    slug: "biotechnology-internship-independent-research",
    title: "Biotechnology Internship/Independent Research",
    courseNumbers: ["25.5750001", "25.5750002"],
    department: "Health Science",
    pathway: "HEALTH_SCIENCE",
    term: "YEAR",
    gradeText: "12",
    minGrade: 12,
    maxGrade: 12,
    prerequisitesText:
      "Introduction to Healthcare Science, Essentials of Biotechnology, Applications of Biotechnology, grade of 85 or higher in pathway courses, and successful EOPA completion.",
    summary:
      "A biotechnology capstone built around independent or internship-based research, literature review, experimental design, and formal presentation.",
    majorTopics:
      "Literature review, investigative question design, experimental methods, quantitative analysis, poster presentation, research paper, mentored independent bioscience research.",
  }),
  catalogCourse({
    slug: "biol-2113-anatomy-and-physiology-i",
    title: "BIOL 2113 - Anatomy and Physiology I",
    courseNumbers: [],
    department: "Dual Enrollment",
    pathway: "HEALTH_SCIENCE",
    term: "SEMESTER",
    gradeText: "12",
    minGrade: 12,
    maxGrade: 12,
    prerequisitesText:
      "Corequisite BIOL 2113L and ENGL 1101 or AP Lang score of 3 or higher.",
    summary:
      "A college-level anatomy and physiology lecture course covering body organization and the foundational human body systems.",
    majorTopics:
      "Cell structure and function, tissues, integumentary system, skeletal system, muscular system, nervous system, sensory systems.",
  }),
  catalogCourse({
    slug: "biol-2114-anatomy-and-physiology-ii",
    title: "BIOL 2114 - Anatomy and Physiology II",
    courseNumbers: [],
    department: "Dual Enrollment",
    pathway: "HEALTH_SCIENCE",
    term: "SEMESTER",
    gradeText: "12",
    minGrade: 12,
    maxGrade: 12,
    prerequisitesText: "Corequisite BIOL 2114L.",
    summary:
      "A continuation of anatomy and physiology focused on endocrine, cardiovascular, respiratory, digestive, urinary, and reproductive systems.",
    majorTopics:
      "Endocrine system, cardiovascular system, blood and lymphatic system, immune system, respiratory system, digestive system, urinary system, reproductive system.",
  }),

  mergedApCourse({
    slug: "ap-seminar",
    title: "AP Seminar",
    courseNumbers: ["23.0380001", "23.0380002"],
    department: "Research",
    term: "YEAR",
    gradeText: "10-11",
    minGrade: 10,
    maxGrade: 11,
    prerequisitesText:
      "Successful completion of Lit/Comp II or Lit/Comp II H with required grade threshold, teacher recommendation, application process, and AP Seminar contract expectations.",
    summary:
      "A foundational AP Capstone course where students analyze issues across disciplines, synthesize sources, write essays, and present arguments individually and in teams.",
    majorTopics:
      "Cross-curricular issue analysis, source synthesis, research, writing, presentations, collaboration, argumentation, timed writing, summer reading and writing.",
    essentialSkills:
      "Frequent academic writing, close reading across genres, evidence-based discussion, collaboration, interpersonal communication, and reliability as a research partner.",
    studentWorkload: "3.4 hours per week",
    teacherWorkload: "3-5 hours per week",
  }),
  mergedApCourse({
    slug: "ap-research",
    title: "AP Research",
    courseNumbers: ["23.0370001", "23.0370002"],
    department: "Research",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Score of 3 or higher on AP Seminar with additional invitation, prior research-course performance, proposal, and teacher recommendations depending on grade level.",
    summary:
      "The second AP Capstone course asks students to design and execute a yearlong investigation culminating in a long-form academic paper and oral defense.",
    majorTopics:
      "Research methodology, ethical research practices, information synthesis, process portfolio, 4,000-5,000 word paper, presentation, oral defense.",
    essentialSkills:
      "High reading comprehension, critical thinking, statistical reasoning, experimental design, academic writing, and sustained work with scholarly sources.",
    studentWorkload: "6 hours per week",
    teacherWorkload: "5 hours per week",
  }),
  catalogCourse({
    slug: "ia-research-honors",
    title: "IA Research Honors",
    courseNumbers: ["40.0921041", "40.0921042"],
    department: "Research",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText: "Lit/Comp II or AP Seminar.",
    summary:
      "IA’s honors Pinnacle Project course supports independent research through both scientific-method and design-thinking lenses, with optional subject-area cohorts.",
    majorTopics:
      "Independent research framing, project execution, communication, Pinnacle Project, scientific method, design thinking, mentored subject-area research.",
  }),

  catalogCourse({
    slug: "literature-and-composition-i",
    title: "Literature and Composition I",
    courseNumbers: ["23.0616001", "23.0616002"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "None.",
    summary:
      "A grade 9 ELA survey of literary genres that builds reading, vocabulary, writing, research, speaking, and viewing habits for college readiness.",
    majorTopics:
      "Novel, short story, poetry, drama, nonfiction, vocabulary development, effective reading strategies, writing and research habits, language skills.",
  }),
  catalogCourse({
    slug: "literature-and-composition-i-honors",
    title: "Literature and Composition I Honors",
    courseNumbers: ["23.0616041", "23.0616042"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "Teacher recommendation and placement criteria.",
    summary:
      "An honors version of Lit/Comp I with higher expectations, summer work, and more rigorous reading and writing alongside the grade 9 genre study.",
    majorTopics:
      "Literary genres, advanced reading strategies, research habits, writing, discussion, summer reading and written responses.",
  }),
  catalogCourse({
    slug: "literature-and-composition-ii",
    title: "Literature and Composition II",
    courseNumbers: ["23.0617001", "23.0617002"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText: "Literature and Composition I.",
    summary:
      "A thematic grade 10 ELA course that deepens reading, writing, speaking, and research through universal themes and symbol analysis.",
    majorTopics:
      "Thematic study, universal themes and symbols, literature and informational texts, writing, research, listening, speaking, viewing.",
  }),
  catalogCourse({
    slug: "literature-and-composition-ii-honors",
    title: "Literature and Composition II Honors",
    courseNumbers: ["23.0617041", "23.0617042"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText:
      "Literature and Composition I Honors or teacher recommendation.",
    summary:
      "An honors grade 10 ELA course that prepares students for AP-level rigor while covering the Lit/Comp II thematic curriculum.",
    majorTopics:
      "Theme-based literary analysis, writing, research, AP-style reading and writing preparation.",
  }),
  catalogCourse({
    slug: "11th-american-literature-and-composition",
    title: "11th American Literature and Composition",
    courseNumbers: ["23.0510001", "23.0510002"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText: "Literature and Composition II.",
    summary:
      "A survey of major U.S. literary topics, themes, and movements from pre-colonial writing to the present, paired with research and composition.",
    majorTopics:
      "American literary history, major literary forms, thematic analysis, papers, speeches, presentations, discourse and research.",
  }),
  catalogCourse({
    slug: "11th-american-literature-and-composition-honors",
    title: "11th American Literature and Composition Honors",
    courseNumbers: ["23.3510041", "23.3510042"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText:
      "Literature and Composition II and teacher recommendation.",
    summary:
      "The honors American literature course adds AP-oriented rigor to the standard 11th grade U.S. literature curriculum.",
    majorTopics:
      "American literary history with AP preparation, analytical writing, research, advanced reading expectations.",
  }),
  mergedApCourse({
    slug: "ap-language-and-composition",
    title: "AP Language & Composition",
    courseNumbers: ["23.0530001", "23.0530002"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText:
      "A 92 or above in the current English class, recommendation from the current ELA teacher, and at IA commonly AP Seminar or teacher recommendation.",
    summary:
      "A college-level course in rhetoric, expository and argumentative writing, and analytical reading that also prepares students for the Georgia EOC and AP exam.",
    majorTopics:
      "Expository, analytical, and argumentative writing, rhetoric analysis, American literature, frequent drafting and revision, evidence-based argument.",
    essentialSkills:
      "The ability to read and write critically, willingness to develop arguments through evidence-based research, readiness to write frequently and revise deeply, and openness to feedback.",
    studentWorkload: "4 hours per week",
    teacherWorkload: "3-5 hours per week",
  }),
  catalogCourse({
    slug: "world-literature",
    title: "World Literature",
    courseNumbers: ["23.0670001", "23.0670002"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "World Literature explores diverse voices and global themes through literary and informational texts, writing, and research.",
    majorTopics:
      "Linguistic and cultural diversity, comparison and critique of styles and themes, argumentative and analytical essays, research, oral and written communication.",
  }),
  mergedApCourse({
    slug: "ap-english-literature-and-composition",
    title: "AP English Literature and Composition",
    courseNumbers: ["23.0650001", "23.0650002"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "A 92 or above in the current English class or 85 or above in the previous English course with teacher recommendation, depending on placement path.",
    summary:
      "A college-level study of imaginative literature in which students closely read fiction, poetry, and drama and write sustained literary analysis.",
    majorTopics:
      "Close reading, literary analysis, character, setting, structure, figurative language, symbolism, expository and argumentative essays, discussion.",
    essentialSkills:
      "A passion for reading and discussion, close reading, advanced literary analysis, organized writing, frequent essay practice, and strong time management.",
    studentWorkload: "2 hours per week",
    teacherWorkload: "3-5 hours per week",
  }),
  catalogCourse({
    slug: "dramatic-writing",
    title: "Dramatic Writing",
    courseNumbers: ["52.0920001", "52.0920002", "52.0810011", "52.0810012"],
    department: "English Language Arts",
    term: "YEAR",
    gradeText: "12",
    minGrade: 12,
    maxGrade: 12,
    prerequisitesText:
      "American Literature with 90 or above or American Literature Honors with 85 or above, plus ELA teacher recommendation.",
    summary:
      "A senior course focused on writing for theatrical, film, and television media while studying visual storytelling from a writer’s point of view.",
    majorTopics:
      "Script development, theatrical and film writing, writerly stance, media analysis, standard English conventions, academic and creative collaboration.",
  }),

  catalogCourse({
    slug: "algebra-concepts-and-connections",
    title: "Algebra: Concepts and Connections",
    courseNumbers: ["27.0811001", "27.0811002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "Placement criteria.",
    summary:
      "The first course in IA’s math sequence develops algebraic, geometric, graphical, and statistical reasoning for high school mathematics.",
    majorTopics:
      "Linear functions, irrational numbers, systems of inequalities, distance, midpoint, slope, area, perimeter, nonlinear equations, quadratics, exponentials, statistics.",
  }),
  catalogCourse({
    slug: "algebra-concepts-and-connections-honors",
    title: "Algebra: Concepts and Connections H",
    courseNumbers: [],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "8th grade math and district placement.",
    summary:
      "The honors Algebra C&C track follows Fulton County’s accelerated version of the opening high school algebra course.",
    majorTopics:
      "Accelerated algebraic reasoning, functions, equations, geometry connections, and statistics preparation for advanced math pathways.",
  }),
  catalogCourse({
    slug: "geometry-concepts-and-connections",
    title: "Geometry: Concepts and Connections",
    courseNumbers: ["27.0821001", "27.0821002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "9-10",
    minGrade: 9,
    maxGrade: 10,
    prerequisitesText: "Algebra: Concepts and Connections.",
    summary:
      "The second course in the sequence develops geometric, algebraic, graphical, and probabilistic reasoning.",
    majorTopics:
      "Polynomial expressions, proofs, constructions, rigid motions, similarity, congruence, circles, right triangle trigonometry, measurement, conditional probability.",
  }),
  catalogCourse({
    slug: "geometry-concepts-and-connections-honors",
    title: "Geometry: Concepts and Connections H",
    courseNumbers: ["27.0821041", "27.0821042"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "9-10",
    minGrade: 9,
    maxGrade: 10,
    prerequisitesText: "Algebra C&C or Algebra C&C H.",
    summary:
      "The honors Geometry C&C pathway accelerates and deepens the standard geometry and probability sequence.",
    majorTopics:
      "Accelerated geometry, proof, constructions, transformations, trigonometry, probability, and analytical reasoning.",
  }),
  catalogCourse({
    slug: "advanced-algebra-concepts-and-connections",
    title: "Advanced Algebra: Concepts and Connections",
    courseNumbers: ["27.0831001", "27.0831002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "10-11",
    minGrade: 10,
    maxGrade: 11,
    prerequisitesText: "Geometry: Concepts and Connections.",
    summary:
      "The third course in the math sequence prepares students for college and career pathways through advanced algebra, statistics, and modeling.",
    majorTopics:
      "Data and statistical reasoning, probabilistic reasoning, matrices, linear programming, exponential and logarithmic functions, radicals, rational expressions, trigonometric equations.",
  }),
  catalogCourse({
    slug: "advanced-algebra-concepts-and-connections-honors",
    title: "Advanced Algebra: Concepts and Connections H",
    courseNumbers: ["27.0831041", "27.0831042"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "9-11",
    minGrade: 9,
    maxGrade: 11,
    prerequisitesText: "Algebra C&C H and Geometry C&C H.",
    summary:
      "The honors advanced algebra course accelerates the district’s college-readiness sequence for students on faster math pathways.",
    majorTopics:
      "Advanced functions, statistics, trigonometry, modeling, and pre-calculus readiness.",
  }),
  catalogCourse({
    slug: "enhanced-advanced-algebra-and-ap-precalculus",
    title: "Enhanced Advanced Algebra and AP PreCalculus",
    courseNumbers: ["27.0931001", "27.0931002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "9-11",
    minGrade: 9,
    maxGrade: 11,
    prerequisitesText: "Geometry C&C and teacher recommendation.",
    summary:
      "A blended accelerated course that combines Advanced Algebra and AP Precalculus concepts for students on IA’s fastest math pathway.",
    majorTopics:
      "Advanced algebra, functions, trigonometry, probability, conditional probability, analytical geometry, polynomial expressions, transformations, circles.",
  }),
  catalogCourse({
    slug: "advanced-mathematical-decision-making",
    title: "Advanced Mathematical Decision Making (AMDM)",
    courseNumbers: ["27.0850001", "27.0850002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Advanced Algebra: Concepts and Connections (H).",
    summary:
      "AMDM applies quantitative reasoning, statistics, and modeling to real-world decisions in higher education, finance, and the workplace.",
    majorTopics:
      "Personal finance, probability, data analysis, network models, business and financial modeling, contextual quantitative reasoning.",
  }),
  mergedApCourse({
    slug: "ap-precalculus",
    title: "AP PreCalculus",
    courseNumbers: ["27.0741001", "27.0741002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "Advanced Algebra Honors with 85+ unweighted or Advanced Algebra with 95+.",
    summary:
      "AP Precalculus prepares students for calculus and other higher-level mathematics through deep work with families of functions and advanced representations.",
    majorTopics:
      "Polynomial and rational functions, exponential and logarithmic functions, trigonometric functions, polar and parametric functions, vectors, matrices, conic sections.",
    essentialSkills:
      "Strong Algebra, Geometry, and Advanced Algebra foundations with reliable symbolic reasoning and mathematical critical thinking.",
    studentWorkload: "2.8 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  catalogCourse({
    slug: "pre-calculus",
    title: "Pre-Calculus",
    courseNumbers: ["27.0841001", "27.0841002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Advanced Algebra: Concepts and Connections.",
    summary:
      "Precalculus deepens algebra and trigonometry knowledge while building notational fluency and multiple representations for later calculus work.",
    majorTopics:
      "Piecewise and rational functions, limits and continuity, sequences and series, conic sections, trigonometric functions and identities, polar graphing, parametric equations.",
  }),
  catalogCourse({
    slug: "calculus",
    title: "Calculus",
    courseNumbers: ["27.0780001", "27.0780002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "PreCalculus or Enhanced Advanced Algebra and PreCalculus.",
    summary:
      "A non-AP calculus course covering derivatives, integrals, and applications through multiple representations and realistic contexts.",
    majorTopics:
      "Limits, continuity, derivatives, product and chain rules, optimization, related rates, Riemann sums, definite integrals, Fundamental Theorem of Calculus, u-substitution, separable differential equations.",
  }),
  mergedApCourse({
    slug: "ap-calculus-ab",
    title: "AP Calculus AB",
    courseNumbers: ["27.0720001", "27.0720002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Strong symbolic reasoning with AP PreCalculus at 80+ unweighted or PreCalculus at 90+.",
    summary:
      "A first-semester college calculus course covering functions, limits, continuity, derivatives, integrals, and their applications.",
    majorTopics:
      "Functions and curves, limits, continuity, differential calculus, integral calculus, applications of derivatives and integrals.",
    essentialSkills:
      "Familiarity with linear, polynomial, rational, exponential, logarithmic, trigonometric, inverse, and piecewise-defined functions.",
    studentWorkload: "3.11 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  mergedApCourse({
    slug: "ap-calculus-bc",
    title: "AP Calculus BC",
    courseNumbers: ["27.0730001", "27.0730002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Strong symbolic reasoning with 90+ unweighted in AP PreCalculus.",
    summary:
      "A two-semester college calculus course extending AB topics into parametric, polar, vector, and series-based calculus.",
    majorTopics:
      "Limits and continuity, differential and integral calculus, parametric functions, polar functions, vector functions, series, polynomial approximations.",
    essentialSkills:
      "Strong fluency with advanced functions including parametric and polar forms plus the algebraic discipline needed for fast-paced calculus.",
    studentWorkload: "4.83 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  mergedApCourse({
    slug: "ap-statistics",
    title: "AP Statistics",
    courseNumbers: ["27.0740001", "27.0740002"],
    department: "Mathematics",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "Successful completion of Advanced Algebra with at least 85+.",
    summary:
      "A college-level statistics course centered on data analysis, regression, confidence intervals, hypothesis testing, and statistical communication.",
    majorTopics:
      "Collecting and analyzing data, graphical displays, regression, confidence intervals, hypothesis tests, probability distributions, statistical reasoning.",
    essentialSkills:
      "Reliable Algebra II skills, reading comprehension, and the ability to explain reasoning in depth when working through word problems.",
    studentWorkload: "2.75 hours per week",
    teacherWorkload: "3 hours per week",
  }),

  catalogCourse({
    slug: "biology",
    title: "Biology",
    courseNumbers: ["26.0120001", "26.0120002"],
    department: "Science",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "None.",
    summary:
      "The foundational biology course studies living systems through patterns, processes, inquiry labs, and fieldwork.",
    majorTopics:
      "Interdependence of organisms, matter and energy in living systems, organism behavior, evolution, inquiry-based lab and field investigations.",
  }),
  catalogCourse({
    slug: "biology-honors",
    title: "Biology Honors",
    courseNumbers: ["26.0120041", "26.0120042"],
    department: "Science",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "Placement criteria.",
    summary:
      "An accelerated lab science focused on advanced biological analysis, reading, and research.",
    majorTopics:
      "Cytology, ecology, genetics, evolution, taxonomy, microbiology, botany, zoology, research paper writing, frequent lab work.",
  }),
  mergedApCourse({
    slug: "ap-biology",
    title: "AP Biology",
    courseNumbers: ["26.0140001", "26.0140002"],
    department: "Science",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "Honors Biology at 88+ unweighted, concurrent Honors Chemistry, Advanced Algebra Honors or higher at 90+ unweighted, and teacher recommendation.",
    summary:
      "A college-level biology course centered on inquiry-based investigations into evolution, cellular processes, genetics, information transfer, and ecology.",
    majorTopics:
      "Evolution, cellular processes, energy and communication, genetics, information transfer, ecology, interactions, investigation-based biology.",
    essentialSkills:
      "Independent learning, strong biology interest, explaining processes from text and visuals, statistical analysis, and evidence-based scientific argument.",
    studentWorkload: "6.3 hours per week",
    teacherWorkload: "3-4 hours per week",
  }),
  catalogCourse({
    slug: "earth-systems",
    title: "Earth Systems",
    courseNumbers: ["40.0640001", "40.0640002"],
    department: "Science",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "Earth Systems explores atmosphere, hydrosphere, and geosphere interactions through geology, ecology, climate, and Earth history.",
    majorTopics:
      "Plate tectonics, landform evolution, geologic record, weather, climate, resources, ecology, history of life on Earth.",
  }),
  catalogCourse({
    slug: "honors-chemistry",
    title: "Honors Chemistry",
    courseNumbers: ["40.0510041", "40.0510042"],
    department: "Science",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Biology Honors.",
    summary:
      "An accelerated lab chemistry course for students prepared for abstract reasoning, formal lab work, and algebraic problem solving.",
    majorTopics:
      "Characteristics of science, matter classification, stoichiometry, conservation of matter, atomic theory, periodicity, reaction rates, lab analysis, semester projects.",
  }),
  mergedApCourse({
    slug: "ap-chemistry",
    title: "AP Chemistry",
    courseNumbers: ["40.0530001", "40.0530002"],
    department: "Science",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Successful completion of high school chemistry and Advanced Algebra C&C, with 87+ recommended in Algebra II and Honors Chemistry.",
    summary:
      "A college-level general chemistry course taught through inquiry, lab work, and advanced modeling of chemical systems.",
    majorTopics:
      "Structure of matter, bonding, intermolecular forces, chemical reactions, kinetics, thermodynamics, equilibrium, inquiry-based investigations.",
    essentialSkills:
      "Independent work from multiple sources, strong mathematical problem solving, meeting deadlines, and consistent lab preparation.",
    studentWorkload: "5.2 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  catalogCourse({
    slug: "physics",
    title: "Physics",
    courseNumbers: ["40.0810001", "40.0810002"],
    department: "Science",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Algebra, Geometry, and Trigonometry.",
    summary:
      "IA’s general physics course studies matter, energy, motion, waves, and fields through conceptual and mathematical modeling plus lab work.",
    majorTopics:
      "Velocity, acceleration, forces, energy, momentum, thermodynamics, electricity, magnetism, waves, light, optics, subatomic physics.",
  }),
  catalogCourse({
    slug: "honors-physics",
    title: "Honors Physics",
    courseNumbers: [],
    department: "Science",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "Algebra, Geometry, Trigonometry, and concurrent enrollment in PreCalculus.",
    summary:
      "An accelerated physics course that pushes beyond the standard curriculum with faster pacing and deeper analytical demands.",
    majorTopics:
      "Advanced mechanics, analytical modeling, selected quantum and nuclear topics, AP-aligned problem solving.",
  }),
  mergedApCourse({
    slug: "ap-physics-1",
    title: "AP Physics 1",
    courseNumbers: ["40.0831001", "40.0831002"],
    department: "Science",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "Strong algebraic reasoning, completion of or concurrent AP PreCalculus, 90+ unweighted in Advanced Algebra, and stronger thresholds for students coming from non-AP science.",
    summary:
      "An algebra-based college-level physics course focused on Newtonian mechanics, work and energy, and mechanical waves.",
    majorTopics:
      "Kinematics, dynamics, rotational dynamics, angular momentum, work, energy, power, mechanical waves, sound, conceptual and applied physics.",
    essentialSkills:
      "Strong algebra, geometry, trigonometry, high-quality problem solving, and disciplined self-guided practice outside class.",
    studentWorkload: "5.2 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  mergedApCourse({
    slug: "ap-physics-c-mechanics",
    title: "AP Physics C Mechanics",
    courseNumbers: ["40.0841001", "40.0841002"],
    department: "Science",
    term: "SEMESTER",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Strong algebraic reasoning and completed or concurrent AP Calculus; if concurrent, AP PreCalculus at 95.",
    summary:
      "A calculus-based mechanics course for students pursuing engineering or physical sciences.",
    majorTopics:
      "Kinematics, Newton’s laws, work, energy, power, systems of particles, linear momentum, rotation, oscillations, gravitation, laboratory investigation.",
    essentialSkills:
      "Strong algebra, geometry, trigonometry, basic calculus, robust problem solving, and independent practice.",
    studentWorkload: "4 hours per week",
    teacherWorkload: "5 hours per week",
  }),
  mergedApCourse({
    slug: "ap-physics-c-electricity-and-magnetism",
    title: "AP Physics C Electricity and Magnetism",
    courseNumbers: ["40.0842001", "40.0842002"],
    department: "Science",
    term: "SEMESTER",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Strong algebraic reasoning and completed or concurrent AP Calculus; if concurrent, AP PreCalculus at 95.",
    summary:
      "A calculus-based AP Physics C course focused on electricity, magnetism, fields, change, and conservation.",
    majorTopics:
      "Electric and magnetic fields, force interactions, conservation, calculus-based modeling, hands-on laboratory work.",
    essentialSkills:
      "Strong algebra, geometry, trigonometry, basic calculus, robust problem solving, and independent practice.",
    studentWorkload: "4 hours per week",
    teacherWorkload: "5 hours per week",
  }),
  mergedApCourse({
    slug: "ap-environmental-science",
    title: "AP Environmental Science",
    courseNumbers: ["26.0620001", "26.0620002"],
    department: "Science",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "Honors Biology and either 85+ in Honors Biology or Honors Chemistry, or 80+ in an AP science course.",
    summary:
      "A college-level environmental science course examining natural systems, human impact, and sustainability through mixed instruction and projects.",
    majorTopics:
      "Ecosystems, population, global environmental problems, energy resources, pollution, biodiversity, ecological integrity, environment and society.",
    essentialSkills:
      "Strong reading comprehension, writing, and problem solving in a fast-paced course that mixes lecture, labs, activities, and projects.",
    studentWorkload: "4.5 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  catalogCourse({
    slug: "forensic-science",
    title: "Forensic Science",
    courseNumbers: ["43.4520001", "43.4520002"],
    department: "Science",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "A science elective focused on the principles of forensic investigation, evidence handling, and crime-scene analysis.",
    majorTopics:
      "Evidence identification, collection, and processing, legal responsibilities, crime scene preservation, interviews, interrogations, courtroom use of evidence.",
  }),
  catalogCourse({
    slug: "organic-chemistry-honors",
    title: "Organic Chemistry Honors",
    courseNumbers: ["40.0570041", "40.0570042"],
    department: "Science",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Honors Chemistry.",
    summary:
      "An upper-level chemistry elective focused on organic structure, functional groups, reactions, and lab technique.",
    majorTopics:
      "Functional groups, nomenclature, stereochemistry, resonance, acid-base reactions, substitution and elimination, synthesis, crystallization, distillation, chromatography.",
  }),
  catalogCourse({
    slug: "astronomy",
    title: "Astronomy",
    courseNumbers: ["40.0570001", "40.0570002"],
    department: "Science",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "Astronomy introduces modern astrophysics, the history of the universe, and observational work connected to celestial systems.",
    majorTopics:
      "Origin and history of the universe, Earth and solar-system formation, planets, stars, galaxies, black holes, light properties, observatories, authentic research.",
  }),
  catalogCourse({
    slug: "super-biology",
    title: "Super Biology",
    courseNumbers: [],
    department: "Science",
    term: "YEAR",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText:
      "Invitation-only placement based on accelerated middle-school math and science performance and concurrent enrollment in PreCalculus.",
    summary:
      "An extended-block sequence that combines Honors Biology in fall with AP Biology in spring for accelerated 9th graders.",
    majorTopics:
      "Honors Biology foundations, AP Biology spring sequence, additional Friday meetings, advanced readiness and placement expectations.",
  }),
  catalogCourse({
    slug: "super-chemistry",
    title: "Super Chemistry",
    courseNumbers: [],
    department: "Science",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText: "Teacher recommendation only.",
    summary:
      "An extended-block accelerated chemistry sequence combining Honors Chemistry and AP Chemistry in a single year.",
    majorTopics:
      "Honors Chemistry fall sequence, AP Chemistry spring sequence, additional Friday meetings, advanced readiness expectations.",
  }),
  catalogCourse({
    slug: "super-physics",
    title: "Super Physics",
    courseNumbers: [],
    department: "Science",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText:
      "Teacher recommendation only, with concurrent or completed Calculus and placement assessment.",
    summary:
      "An accelerated physics block sequence intended for highly prepared students moving through advanced AP physics work.",
    majorTopics:
      "Accelerated AP Physics sequence, advanced problem solving, Friday meetings, readiness assessment for placement.",
  }),

  catalogCourse({
    slug: "american-government-civics",
    title: "American Government/Civics",
    courseNumbers: ["45.0570001"],
    department: "Social Studies",
    term: "SEMESTER",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "None.",
    summary:
      "A half-credit civics course focused on the principles, institutions, and citizen responsibilities of the U.S. political system.",
    majorTopics:
      "Foundations of U.S. government, structure of government, parties, citizenship, political behavior, decision making.",
  }),
  catalogCourse({
    slug: "economics",
    title: "Economics",
    courseNumbers: ["45.0610001"],
    department: "Social Studies",
    term: "SEMESTER",
    gradeText: "9",
    minGrade: 9,
    maxGrade: 9,
    prerequisitesText: "None.",
    summary:
      "A half-credit introduction to economic principles spanning microeconomics, macroeconomics, international economics, and personal finance.",
    majorTopics:
      "Fundamental economic concepts, microeconomics, macroeconomics, international economics, personal finance economics.",
  }),
  mergedApCourse({
    slug: "ap-human-geography",
    title: "AP Human Geography",
    courseNumbers: ["45.0520001", "45.0520002"],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "9-12 elective",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText:
      "Recommended 90+ in Georgia Studies, ELA, and 8th grade math with readiness for college-level reading, writing, charts, and geographic theory.",
    summary:
      "A college-level introduction to the patterns and processes that shape human use and understanding of Earth’s surface.",
    majorTopics:
      "Spatial concepts, landscape analysis, socioeconomic organization, environmental consequences, geographic models, source and scale analysis.",
    essentialSkills:
      "Time management, advanced reading comprehension, self-motivation, self-advocacy, grit, data analysis, and source analysis.",
    studentWorkload: "2.5 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  catalogCourse({
    slug: "world-history",
    title: "World History",
    courseNumbers: ["45.0830001", "45.0830002"],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText: "None.",
    summary:
      "World History surveys global civilizations and transformations from prehistory through the modern era.",
    majorTopics:
      "Ancient and classical civilizations, exploration, Enlightenment, revolutions, industrialization, nationalism, imperialism, totalitarianism, world wars, modern world.",
  }),
  mergedApCourse({
    slug: "ap-world-history",
    title: "AP World History",
    courseNumbers: ["45.0811001", "45.0811002"],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
    prerequisitesText:
      "AP-style or on-level government/economics performance and recommendation thresholds per IA AP catalog.",
    summary:
      "A college-level world history course on major global processes, interactions, and comparisons among societies from 1200 CE to the present.",
    majorTopics:
      "Historical developments since 1200 CE, global processes, argumentation, evidence-based historical claims, international frameworks and comparisons.",
    essentialSkills:
      "Advanced critical reading and writing, organization, time management, self-advocacy, and perseverance with demanding independent work.",
    studentWorkload: "3 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  catalogCourse({
    slug: "us-history",
    title: "U.S. History",
    courseNumbers: ["45.0810001", "45.0810002"],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText: "None.",
    summary:
      "A survey of U.S. history from colonization through the contemporary era.",
    majorTopics:
      "Colonial America, revolution, manifest destiny, Civil War, reconstruction, industrialization, progressivism, world wars, Cold War, postwar decades.",
  }),
  mergedApCourse({
    slug: "ap-us-history",
    title: "AP U.S. History",
    courseNumbers: ["45.0811001", "45.0811002"],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
    prerequisitesText: "AP World History or World History.",
    summary:
      "A college-level U.S. history course built around primary sources, independent study, argumentation, and historical interpretation.",
    majorTopics:
      "Colonial America, Revolution, Jacksonian era, Civil War, Reconstruction, Gilded Age, Progressivism, Depression, world wars, Civil Rights, Cold War, modern America.",
    essentialSkills:
      "Advanced critical reading and writing, independent textbook work, and the ability to construct evidence-based historical arguments.",
    studentWorkload: "3 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  mergedApCourse({
    slug: "ap-government-and-politics",
    title: "AP Government and Politics",
    courseNumbers: ["45.0570001", "45.0570002"],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "9 or 12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "A challenging AP course that studies U.S. constitutional principles, institutions, political behavior, and public policy.",
    majorTopics:
      "Political philosophy, constitutional principles, branches of government, parties, interest groups, public policy, argument writing, document analysis.",
    essentialSkills:
      "Advanced critical reading and writing with a strong prior social studies and English foundation.",
    studentWorkload: "3.2 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  mergedApCourse({
    slug: "ap-psychology",
    title: "AP Psychology",
    courseNumbers: ["45.0160001", "45.0160002"],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "80 in AP sophomore or junior social studies and science, or 90 in on-level sophomore or junior social studies and science.",
    summary:
      "A college-level introduction to the systematic and scientific study of behavior and mental processes.",
    majorTopics:
      "Biological bases of behavior, cognition, development, learning, social psychology, personality, mental and physical health, psychological research methods.",
    essentialSkills:
      "Strong critical reading and analytical writing, statistics literacy, and enough biology and chemistry background to understand neural and genetic topics.",
    studentWorkload: "2 hours per week",
    teacherWorkload: "4 hours per week",
  }),
  mergedApCourse({
    slug: "ap-microeconomics",
    title: "AP Microeconomics",
    courseNumbers: ["45.0630001"],
    department: "Social Studies",
    term: "SEMESTER",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Grade of 85 or above in AP U.S. History or 90 or above in on-level U.S. History, plus prior AP social studies performance expectations.",
    summary:
      "A half-credit college-level microeconomics course focused on individual and firm decision making.",
    majorTopics:
      "Scarcity and markets, marginal analysis, production choices, market behavior, market inefficiency, public policy, graph and data analysis.",
    essentialSkills:
      "College-level reading, basic mathematics and graphing, independent learning, and strong time management.",
    studentWorkload: "2-3 hours per week",
    teacherWorkload: "3-5 hours per week",
  }),
  mergedApCourse({
    slug: "ap-macroeconomics",
    title: "AP Macroeconomics",
    courseNumbers: ["45.0620001"],
    department: "Social Studies",
    term: "SEMESTER",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Grade of 85 or above in AP U.S. History or 90 or above in on-level U.S. History, plus prior AP social studies performance expectations.",
    summary:
      "A half-credit college-level macroeconomics course focused on economy-wide systems, outcomes, and graph-based analysis.",
    majorTopics:
      "Economic systems, graphs and charts, macroeconomic indicators, system-level analysis, economic reasoning.",
    essentialSkills:
      "College-level reading, basic mathematics and graphing, independent learning, and strong time management.",
    studentWorkload: "2-3 hours per week",
    teacherWorkload: "3-5 hours per week",
  }),
  mergedApCourse({
    slug: "ap-art-history",
    title: "AP Art History",
    courseNumbers: [],
    department: "Social Studies",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Grade of 85 or above in AP World/U.S. History or 90 or above in on-level World/U.S. History, plus prior AP social studies performance expectations.",
    summary:
      "A college-level survey exploring art across cultures and time through historical, social, political, and technological context.",
    majorTopics:
      "Global art survey, sculpture, painting, architecture, cultural analysis, historical interpretation.",
    essentialSkills:
      "Independent learning, strong time management, and readiness for a two-semester introductory college art-history pace.",
    studentWorkload: "2-3 hours per week",
    teacherWorkload: "2-4 hours per week",
  }),
  catalogCourse({
    slug: "us-history-in-film",
    title: "US History in Film",
    courseNumbers: ["45.0812001"],
    department: "Social Studies",
    term: "SEMESTER",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "None. Must be paired with AP Comparative Government and Politics.",
    summary:
      "A one-semester elective that evaluates films about American history for accuracy, perspective, and historical meaning.",
    majorTopics:
      "Film as historical evidence, historical accuracy, political context of media, comparative essay writing, discussion, multiple perspectives.",
  }),
  catalogCourse({
    slug: "ap-comparative-government-and-politics",
    title: "AP Comparative Government and Politics",
    courseNumbers: ["45.0530001"],
    department: "Social Studies",
    term: "SEMESTER",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "None. Must be paired with US History in Film.",
    summary:
      "A comparative politics course examining institutions, political behavior, and regimes across six case-study countries.",
    majorTopics:
      "Major political concepts, comparative institutions, political processes, country comparisons, data analysis, political science arguments, China, Iran, Mexico, Nigeria, Russia, United Kingdom.",
  }),

  catalogCourse({
    slug: "directed-study",
    title: "Directed Study",
    courseNumbers: ["70.2320000"],
    department: "TAG",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Approval of the TAG teacher.",
    summary:
      "A gifted-directed independent study course built around a teacher-student curriculum contract in an academic area.",
    majorTopics:
      "Goal setting, independent learning objectives, customized academic study plan.",
  }),
  catalogCourse({
    slug: "gifted-internship",
    title: "Gifted Internship I, II, III, IV",
    courseNumbers: ["70.2210000", "70.2220000", "70.2230000", "70.2240000"],
    department: "TAG",
    term: "YEAR",
    gradeText: "Preference to 12th grade",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "TAG approval based on academic record, attendance, discipline, schedule flexibility, teacher recommendation, and application.",
    summary:
      "A TAG internship sequence that places students with professionals in possible career fields for authentic off-campus experience.",
    majorTopics:
      "Career exploration, professional experience, leaving campus for one or two periods daily, reflective goal development.",
  }),

  catalogCourse({
    slug: "fvs-health",
    title: "FVS Health",
    courseNumbers: ["17.3110001"],
    department: "Physical Education",
    term: "SEMESTER",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "A health course exploring mental, physical, and social well-being along with safety, prevention, and community-health topics.",
    majorTopics:
      "Safety, nutrition, mental health, substance-abuse prevention, disease prevention, environmental health, family life education, consumer and community health.",
  }),
  catalogCourse({
    slug: "fvs-personal-fitness",
    title: "FVS Personal Fitness",
    courseNumbers: ["36.3510001"],
    department: "Physical Education",
    term: "SEMESTER",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "A personal fitness course focused on lifetime fitness planning, self-assessment, and healthy training habits.",
    majorTopics:
      "Strength, endurance, flexibility, body composition, cardiovascular fitness, nutrition, weight control, stress management, consumer information.",
  }),

  catalogCourse({
    slug: "beginning-music-technology",
    title: "Beginning Music Technology",
    courseNumbers: ["53.0221001", "53.0221002"],
    department: "Electives",
    term: "YEAR",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "An introductory music-production course that teaches students to create musical projects with current recording and composition tools.",
    majorTopics:
      "Digital audio workstations, MIDI, keyboard technique, composition, songwriting, music for visual media, sound design, editing, mixing, music theory.",
  }),
  catalogCourse({
    slug: "intermediate-music-technology",
    title: "Intermediate Music Technology",
    courseNumbers: ["53.0222001"],
    department: "Electives",
    term: "YEAR",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "Beginning Music Technology.",
    summary:
      "A project-based continuation of music technology with more advanced production, artist development, and large recording projects.",
    majorTopics:
      "Recording techniques, synthesizers, MIDI, plugins, advanced effects, music theory, artist development, social media management, album and EP production.",
  }),
  catalogCourse({
    slug: "yearbook",
    title: "Yearbook",
    courseNumbers: ["23.0320003", "23.0320004"],
    department: "Electives",
    term: "YEAR",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "Application only.",
    summary:
      "A publishing elective where students build the yearbook while learning design, writing, editing, photography, and production deadlines.",
    majorTopics:
      "Graphic design, copywriting, editing, photography, reporting, presentations, design principles, marketing, teamwork, time management.",
  }),
  catalogCourse({
    slug: "audio-visual-film-and-technology-i",
    title: "Audio Visual Film & Technology I",
    courseNumbers: ["10.5181001", "10.5181002"],
    department: "Electives",
    term: "YEAR",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "None.",
    summary:
      "A foundational content-creation course focused on digital storytelling, filming, recording, editing, and publishing.",
    majorTopics:
      "Digital storytelling, composition, camera equipment, script writing, production teams, thumbnails, lighting, video and audio recording, editing, podcasting.",
  }),
  catalogCourse({
    slug: "journalism-i",
    title: "Journalism I",
    courseNumbers: ["23.032000"],
    department: "Electives",
    term: "YEAR",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "Audio Visual Film and Technology I.",
    summary:
      "Students produce IATV by interviewing subjects, telling stories, and creating deadline-driven journalistic video content.",
    majorTopics:
      "Interviewing, student television production, podcasts, film festivals, lighting and audio production, digital media contests.",
  }),
  catalogCourse({
    slug: "journalism-ii",
    title: "Journalism II",
    courseNumbers: ["23.0330001"],
    department: "Electives",
    term: "YEAR",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
    prerequisitesText: "Application only.",
    summary:
      "An advanced journalism and media-production leadership course for students shaping IATV and capstone content projects.",
    majorTopics:
      "Editorial leadership, special assignments, student television competition, film contests, capstone content creation.",
  }),
  catalogCourse({
    slug: "work-based-learning",
    title: "Work-Based Learning",
    courseNumbers: [],
    department: "Electives",
    term: "YEAR",
    gradeText: "12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText:
      "Meet WBL requirements, be at least 16, and have a defined career pathway.",
    summary:
      "A career-related education placement course connecting pathway study to authentic work experience.",
    majorTopics:
      "Job placement tied to pathway curriculum, career decision making, professional experience, work-based extension of pathway learning.",
  }),
  catalogCourse({
    slug: "peer-facilitation",
    title: "Peer Facilitation",
    courseNumbers: ["35.0410001", "35.0410002"],
    department: "Electives",
    term: "YEAR",
    gradeText: "11-12",
    minGrade: 11,
    maxGrade: 12,
    prerequisitesText: "Contract signed with assigned staff member.",
    summary:
      "Peer Facilitation places students in support roles within classrooms where they assist teachers and work with varied groups of learners.",
    majorTopics:
      "Classroom support, communication with students and adults, professional responsibility.",
  }),
  catalogCourse({
    slug: "beacon-writing-staff",
    title: "Beacon Writing Staff",
    courseNumbers: ["23.0320007", "23.0320008"],
    department: "Electives",
    term: "YEAR",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Application only.",
    summary:
      "Students plan, write, design, and publish work for the IA Beacon while developing media and communication skills.",
    majorTopics:
      "Graphic design, copywriting, editing, photography, reporting, interviewing, presentations, publication workflow.",
  }),
  catalogCourse({
    slug: "intro-to-art",
    title: "Intro to Art",
    courseNumbers: ["50.0211001"],
    department: "Electives",
    term: "SEMESTER",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "None. Must be paired with Design Fundamentals.",
    summary:
      "An entry-level visual arts course that builds the common foundation for studio art at IA.",
    majorTopics:
      "Art as communication, drawing, sculpture, ceramics, design, aesthetics, careers, art criticism, art history, long-term project habits.",
  }),
  catalogCourse({
    slug: "design-fundamentals",
    title: "Design Fundamentals",
    courseNumbers: ["50.0212001"],
    department: "Electives",
    term: "SEMESTER",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Intro to Art. Must be paired with Intro to Art.",
    summary:
      "Design Fundamentals strengthens level-one visual art skills while focusing on the elements and principles of design.",
    majorTopics:
      "Art history, art criticism, aesthetic judgment, two- and three-dimensional media, design elements, principles of design.",
  }),
  catalogCourse({
    slug: "draw-paint-i",
    title: "Draw Paint I",
    courseNumbers: ["50.0313001"],
    department: "Electives",
    term: "SEMESTER",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText: "Intro to Art. Must be paired with Draw Paint II.",
    summary:
      "The first drawing and painting course teaches observational drawing and prepares students for more advanced painting work.",
    majorTopics:
      "Contour, value, gesture, perspective, color, pencil, charcoal, conte, oil pastels, art history, criticism, aesthetics.",
  }),
  catalogCourse({
    slug: "draw-paint-ii",
    title: "Draw Paint II",
    courseNumbers: ["50.0314001"],
    department: "Electives",
    term: "SEMESTER",
    gradeText: "10-12",
    minGrade: 10,
    maxGrade: 12,
    prerequisitesText:
      "Intro to Art and Draw Paint I. Must be paired with Draw Paint I.",
    summary:
      "The second drawing and painting course expands composition, painting technique, and critical analysis while helping students develop personal style.",
    majorTopics:
      "Painting technique, composition, advanced drawing media, historical style study, critique, aesthetics, studio production.",
  }),
];
