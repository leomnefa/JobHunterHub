import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { answerApplicationForm } from "../src/services/documents.ts";
import { parseProfileMarkdown } from "../src/services/profile.ts";
import type { ApplicationForm, NormalizedJob } from "../src/core/types.ts";
import { NO_CAPABILITIES } from "../src/core/types.ts";

const PROFILE = `# Perfil

## Datos personales
Nombre: Juan Perez
Ubicacion: Buenos Aires, Argentina
Email: juan@email.com
Telefono: +54 11 5555 5555
LinkedIn: https://linkedin.com/in/juanperez

## Perfil
Senior Data Engineer con mas de 20 anos de experiencia.

## Idiomas
Ingles: Avanzado
`;

const JOB: NormalizedJob = {
  id: "test:1",
  source: "test",
  sourceJobId: "1",
  sourceUrl: "https://example.com/1",
  title: "Data Engineer",
  company: { name: "Acme" },
  description: "Descripcion de la oferta.",
  remoteType: "remote",
  skills: [],
  categories: [],
  retrievedAt: new Date().toISOString(),
  applicationMethod: "external",
  connectorCapabilities: NO_CAPABILITIES,
};

const FORM: ApplicationForm = {
  jobId: "1",
  source: "test",
  authoritative: true,
  fields: [
    { id: "full_name", label: "Nombre completo", type: "text", required: true },
    { id: "first_name", label: "First name", type: "text", required: true },
    { id: "last_name", label: "Last name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "phone", label: "Telefono", type: "phone", required: false },
    { id: "linkedin", label: "LinkedIn", type: "url", required: false },
    { id: "years", label: "Years of experience", type: "number", required: true },
    { id: "english", label: "English level", type: "text", required: true },
    { id: "cv", label: "Resume", type: "file", required: true },
    { id: "why", label: "Why do you want to work here?", type: "textarea", required: false },
    { id: "visa", label: "Do you require visa sponsorship?", type: "text", required: true },
  ],
};

describe("respuestas del formulario de postulacion", () => {
  const profile = parseProfileMarkdown(PROFILE);

  it("completa los campos que surgen del perfil", async () => {
    const answers = await answerApplicationForm(FORM, profile, PROFILE, JOB, []);
    const byId = Object.fromEntries(answers.map((answer) => [answer.fieldId, answer]));

    assert.equal(byId.full_name.answer, "Juan Perez");
    assert.equal(byId.first_name.answer, "Juan");
    assert.equal(byId.last_name.answer, "Perez");
    assert.equal(byId.email.answer, "juan@email.com");
    assert.equal(byId.phone.answer, "+54 11 5555 5555");
    assert.equal(byId.linkedin.answer, "https://linkedin.com/in/juanperez");
    assert.equal(byId.years.answer, "20");
    assert.equal(byId.english.answer, "Avanzado");
    for (const id of ["full_name", "email", "years"]) {
      assert.equal(byId[id].source, "profile");
      assert.equal(byId[id].needsReview, false);
    }
  });

  it("no inventa respuestas: lo desconocido queda en UNKNOWN para revision", async () => {
    const answers = await answerApplicationForm(FORM, profile, PROFILE, JOB, []);
    const visa = answers.find((answer) => answer.fieldId === "visa");

    assert.equal(visa?.answer, "UNKNOWN");
    assert.equal(visa?.source, "unknown");
    assert.equal(visa?.needsReview, true);
    assert.equal(visa?.confidence, 0);
  });

  it("reutiliza las respuestas guardadas por el usuario", async () => {
    const answers = await answerApplicationForm(FORM, profile, PROFILE, JOB, [
      {
        question: "Do you require visa sponsorship?",
        answer: "Si, trabajo como contractor desde Argentina.",
      },
    ]);
    const visa = answers.find((answer) => answer.fieldId === "visa");

    assert.equal(visa?.source, "stored");
    assert.match(visa?.answer ?? "", /contractor/);
    assert.equal(visa?.needsReview, false);
  });

  it("ignora los campos de archivo: el CV se adjunta aparte", async () => {
    const answers = await answerApplicationForm(FORM, profile, PROFILE, JOB, []);
    assert.equal(
      answers.find((answer) => answer.fieldId === "cv"),
      undefined,
    );
  });
});
