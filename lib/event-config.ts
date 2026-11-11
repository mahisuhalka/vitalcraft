export type TrackKey = "hardware" | "software" | "open";

export type Challenge = {
  id: string;
  title: string;
  track: Exclude<TrackKey, "open">;
  summary: string;
  users: string;
  scope: string;
  marker: string;
};

export const eventConfig = {
  name: "VitalCraft",
  organizer: "IEEE EMBS – BMSIT&M",
  tagline: "Craft ideas. Engineer impact.",
  format: "24-hour Hardware & Software Hackathon",
  date: "To be announced",
  venue: "To be announced",
  prizes: "To be announced",
  registrationDeadline: "To be announced",
  teamSize: { min: 2, max: 4, status: "Proposed — subject to organizer confirmation" },
  finaleSchedule: [
    { time: "HOUR 00", title: "Doors open & team check-in", note: "Get settled, meet the build space, and get ready." },
    { time: "HOUR 01", title: "Kickoff & challenge briefing", note: "Align on the challenge and map your first steps." },
    { time: "HOUR 03", title: "Build sprint begins", note: "Move from idea to a working first slice." },
    { time: "HOUR 08", title: "Mentor check-in", note: "A proposed progress checkpoint for teams." },
    { time: "HOUR 16", title: "Prototype checkpoint", note: "Focus the scope and prepare a clear demo." },
    { time: "HOUR 22", title: "Demos & presentations", note: "Show what you built and what you learned." },
    { time: "HOUR 24", title: "Finale concludes", note: "The 24-hour build window closes." },
  ],
  challenges: [
    {
      id: "inclusive-wayfinding", title: "Wayfinding for everyone", track: "software",
      summary: "Explore how digital tools might make unfamiliar spaces easier to navigate.",
      users: "Visitors navigating a large or unfamiliar campus or public building.",
      scope: "A clickable prototype or lightweight web experience for one clearly defined route.", marker: "01",
    },
    {
      id: "everyday-sensing", title: "Make the invisible visible", track: "hardware",
      summary: "Prototype a responsible way to sense and communicate an everyday environmental condition.",
      users: "People who need a simple, timely signal about their surroundings.",
      scope: "A sensor-led proof of concept with a clear signal, display, or alert.", marker: "02",
    },
    {
      id: "accessible-routines", title: "More accessible routines", track: "software",
      summary: "Design a digital experience that helps people adapt a repeated task to their needs.",
      users: "People who want more flexible ways to organize a daily routine.",
      scope: "A small app flow that demonstrates one useful, configurable routine.", marker: "03",
    },
  ] satisfies Challenge[],
  faq: [
    { question: "What is the difference between the tracks?", answer: "Hardware explores embedded systems, IoT, sensors, assistive devices, and physical prototypes. Software explores web and mobile applications, AI and data tools, accessibility solutions, and useful platforms. These are illustrative directions, not restrictions, and projects do not have to be biomedical." },
    { question: "How will registration and screening work?", answer: "The proposed journey is team registration, idea and pitch-deck submission, screening, shortlisting, and finalist confirmation for the 24-hour Grand Finale. This is a proposed operational design; details and deadlines will be announced." },
    { question: "Can we choose a challenge or bring our own idea?", answer: "Yes. You can start with one of the illustrative problem statements or choose Open Innovation and propose your own problem. Sample challenges are subject to organizer confirmation." },
    { question: "What should go in the pitch deck?", answer: "A suggested outline is: team and track, problem and users, proposed solution, architecture, components or stack, impact, and your 24-hour MVP and demo plan. The official requirements will be announced." },
    { question: "Does registering guarantee selection?", answer: "No. Registration does not guarantee selection. The proposed screening process and selection details are subject to organizer confirmation." },
    { question: "When and where is the event?", answer: "The event date, venue, registration deadlines, and prizes are to be announced. Updates will appear on this event page once confirmed." },
  ],
} as const;
