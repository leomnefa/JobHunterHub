import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseProfileMarkdown, profileCompleteness } from "../src/services/profile.ts";
import { computeHeuristicMatch } from "../src/services/matching.ts";
import { canTransition } from "../src/services/applications.ts";
import { connectorRegistry } from "../src/connectors/registry.ts";
import type { NormalizedJob } from "../src/core/types.ts";
import { NO_CAPABILITIES } from "../src/core/types.ts";

const PROFILE = `# Perfil Profesional

## Datos personales
Nombre: Juan Perez
Ubicacion: Buenos Aires, Argentina
Email: juan@email.com
LinkedIn: https://linkedin.com/in/juanperez

## Perfil
Senior Data Engineer con mas de 20 anos de experiencia en SQL Server, Qlik y Python.

## Experiencia

### Empresa XYZ
2020 - Actualidad
- Senior Data Engineer
- SQL Server, Python, ETL, Qlik Sense

## Skills
- SQL Server
- Python
- ETL

## Educacion
Licenciado en Informatica

## Idiomas
Espanol: Nativo
Ingles: Avanzado

## Preferencias
Trabajo remoto, full time y contract.
Salario esperado: USD 90000 por ano.
`;

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: "test:1",
    source: "test",
    sourceJobId: "1",
    sourceUrl: "https://example.com/1",
    title: "Senior Data Engineer",
    company: { name: "Acme" },
    description: "Buscamos Senior Data Engineer con SQL Server, Python y ETL. Remote worldwide.",
    location: "Worldwide",
    remoteType: "remote",
    worldwide: true,
    employmentType: "full_time",
    seniority: "senior",
    skills: ["sql server", "python", "etl"],
    categories: [],
    retrievedAt: new Date().toISOString(),
    applicationMethod: "external",
    connectorCapabilities: NO_CAPABILITIES,
    ...overrides,
  };
}

describe("perfil en markdown", () => {
  const parsed = parseProfileMarkdown(PROFILE);

  it("extrae los datos de contacto", () => {
    assert.equal(parsed.fullName, "Juan Perez");
    assert.equal(parsed.email, "juan@email.com");
    assert.equal(parsed.location, "Buenos Aires, Argentina");
    assert.equal(parsed.linkedin, "https://linkedin.com/in/juanperez");
  });

  it("detecta experiencia, skills e idiomas", () => {
    assert.equal(parsed.yearsOfExperience, 20);
    assert.equal(parsed.seniority, "senior");
    assert.ok(parsed.skills.includes("sql server"));
    assert.ok(parsed.skills.includes("python"));
    assert.equal(parsed.experiences.length, 1);
    assert.equal(parsed.languages.length, 2);
    assert.equal(parsed.education.length, 1);
  });

  it("lee las preferencias declaradas", () => {
    assert.ok(parsed.preferredEmploymentTypes.includes("full_time"));
    assert.ok(parsed.preferredEmploymentTypes.includes("contract"));
    assert.equal(parsed.remotePreference, "remote");
    assert.equal(parsed.salaryExpectation?.amount, 90000);
    assert.equal(parsed.salaryExpectation?.currency, "USD");
  });

  it("ignora el contenido de los bloques de codigo", () => {
    const withCode = "# Perfil\n\n```ts\ninterface X { name: string }\n```\n\nNombre: Ana Gomez\n";
    assert.equal(parseProfileMarkdown(withCode).fullName, "Ana Gomez");
  });

  it("no inventa datos ausentes", () => {
    const minimal = parseProfileMarkdown("# Perfil\n\nSoy desarrollador.");
    assert.equal(minimal.email, undefined);
    assert.equal(minimal.salaryExpectation, undefined);
    assert.equal(minimal.languages.length, 0);
    assert.ok(profileCompleteness(minimal).missing.length > 0);
  });
});

describe("motor de matching", () => {
  const profile = parseProfileMarkdown(PROFILE);

  it("da alta compatibilidad a una oferta alineada", () => {
    const match = computeHeuristicMatch(job(), profile, { remotePreference: "remote" });
    assert.ok(match.compatibilityScore >= 80, `score fue ${match.compatibilityScore}`);
    assert.equal(match.recommendation, "apply");
    assert.ok(match.matchedSkills.length >= 3);
  });

  it("penaliza una oferta presencial fuera de los paises permitidos", () => {
    const match = computeHeuristicMatch(
      job({ remoteType: "onsite", worldwide: false, location: "Berlin, Germany" }),
      profile,
      { remotePreference: "remote", countriesAllowed: ["Argentina"] },
    );
    assert.ok(match.compatibilityScore < 80);
    assert.ok(match.risks.some((risk) => /presencial/i.test(risk)));
  });

  it("marca riesgo de autorizacion laboral", () => {
    const match = computeHeuristicMatch(
      job({ description: "Must be authorized to work in the United States. US citizen required." }),
      profile,
    );
    assert.ok(match.risks.some((risk) => /autorizacion/i.test(risk)));
  });

  it("detecta las skills faltantes sin inventar coincidencias", () => {
    const match = computeHeuristicMatch(
      job({ skills: ["kafka", "spark", "aws"] }),
      profile,
    );
    assert.deepEqual(match.matchedSkills, []);
    assert.equal(match.missingSkills.length, 3);
    assert.ok(match.compatibilityScore < 70);
  });

  it("el analisis siempre explica el desglose", () => {
    const match = computeHeuristicMatch(job(), profile);
    assert.match(match.aiAnalysis, /Desglose/);
    assert.equal(match.analyzedBy, "heuristic");
  });
});

describe("maquina de estados de postulaciones", () => {
  it("permite el camino feliz", () => {
    assert.ok(canTransition("DISCOVERED", "MATCHED"));
    assert.ok(canTransition("MATCHED", "READY_TO_APPLY"));
    assert.ok(canTransition("READY_TO_APPLY", "APPLYING"));
    assert.ok(canTransition("APPLYING", "SUBMITTED"));
    assert.ok(canTransition("SUBMITTED", "INTERVIEW"));
    assert.ok(canTransition("INTERVIEW", "OFFER"));
    assert.ok(canTransition("OFFER", "HIRED"));
  });

  it("rechaza saltos invalidos", () => {
    assert.equal(canTransition("DISCOVERED", "SUBMITTED"), false);
    assert.equal(canTransition("HIRED", "APPLYING"), false);
    assert.equal(canTransition("WITHDRAWN", "SUBMITTED"), false);
  });

  it("permite reintentar una postulacion fallida", () => {
    assert.ok(canTransition("FAILED", "READY_TO_APPLY"));
    assert.ok(canTransition("REQUIRES_USER_ACTION", "SUBMITTED"));
  });
});

describe("registro de connectors", () => {
  it("registra las fuentes previstas sin duplicados", () => {
    const ids = connectorRegistry.ids();
    assert.equal(new Set(ids).size, ids.length);
    for (const expected of [
      "himalayas",
      "jobicy",
      "remotive",
      "remoteok",
      "adzuna",
      "greenhouse",
      "lever",
      "ashby",
      "smartrecruiters",
      "workable",
      "workday",
      "recruitee",
      "bamboohr",
      "personio",
      "teamtailor",
      "breezy",
      "upwork",
      "freelancer",
      "jobgether",
      "pinpoint",
    ]) {
      assert.ok(ids.includes(expected), `falta el connector ${expected}`);
    }
  });

  it("cada connector declara capacidades y limites coherentes", () => {
    for (const connector of connectorRegistry.list()) {
      const capabilities = connector.getCapabilities();
      assert.equal(typeof capabilities.search, "boolean", connector.id);
      assert.ok(connector.rateLimit.requestsPerMinute > 0, connector.id);
      assert.ok(
        connector.rateLimit.requestsPerHour >= connector.rateLimit.requestsPerMinute,
        connector.id,
      );
      // Si declara que puede postular, tiene que implementar el envio.
      if (capabilities.apply) {
        assert.equal(typeof connector.submitApplication, "function", connector.id);
      }
      // Lo mismo para el resto de las capacidades: ninguna se declara sin el
      // metodo que la cumple.
      if (capabilities.applicationForm) {
        assert.equal(typeof connector.getApplicationForm, "function", connector.id);
      }
      if (capabilities.applicationStatus) {
        assert.equal(typeof connector.getApplicationStatus, "function", connector.id);
      }
      if (capabilities.jobDetails) {
        assert.equal(typeof connector.getJob, "function", connector.id);
      }
      // Las fuentes que exigen credenciales no pueden darse por configuradas.
      if (connector.settingsSchema.some((field) => field.required)) {
        assert.equal(connector.isConfigured({}), false, connector.id);
      }
    }
  });

  it("las fuentes publicas no requieren configuracion", () => {
    for (const id of ["himalayas", "jobicy", "remotive", "remoteok"]) {
      assert.equal(connectorRegistry.require(id).isConfigured({}), true, id);
    }
  });
});
