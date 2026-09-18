import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  annualizeSalary,
  applyClientFilters,
  extractSkills,
  normalizeCompany,
  normalizeEmploymentType,
  normalizeRemoteType,
  normalizeSeniority,
  stripHtml,
  toIsoDate,
} from "../src/core/normalize.ts";
import { compareJobs, dedupeJobs, similarity } from "../src/core/dedup.ts";
import type { NormalizedJob } from "../src/core/types.ts";
import { NO_CAPABILITIES } from "../src/core/types.ts";

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: "test:1",
    source: "test",
    sourceJobId: "1",
    sourceUrl: "https://example.com/1",
    title: "Senior Data Engineer",
    company: { name: "Acme Inc" },
    description: "Buscamos un ingeniero con SQL Server, Python y ETL.",
    location: "Argentina",
    remoteType: "remote",
    skills: ["sql", "python"],
    categories: [],
    retrievedAt: new Date().toISOString(),
    applicationMethod: "external",
    connectorCapabilities: NO_CAPABILITIES,
    ...overrides,
  };
}

describe("normalizacion", () => {
  it("convierte HTML a texto plano legible", () => {
    const html = "<p>Hola<br>mundo</p><ul><li>SQL</li><li>Python</li></ul>&amp; mas";
    const text = stripHtml(html);
    assert.match(text, /Hola/);
    assert.match(text, /- SQL/);
    assert.match(text, /& mas/);
    assert.doesNotMatch(text, /</);
  });

  it("clasifica el tipo de contrato", () => {
    assert.equal(normalizeEmploymentType("Full Time"), "full_time");
    assert.equal(normalizeEmploymentType("Contractor"), "contract");
    assert.equal(normalizeEmploymentType("Freelance"), "freelance");
    assert.equal(normalizeEmploymentType(undefined), "unknown");
  });

  it("detecta seniority en el titulo", () => {
    assert.equal(normalizeSeniority("Senior Data Engineer"), "senior");
    assert.equal(normalizeSeniority("Junior Developer"), "junior");
    assert.equal(normalizeSeniority("Engineering Manager"), "manager");
    assert.equal(normalizeSeniority("Data Engineer"), "unknown");
  });

  it("detecta la modalidad de trabajo", () => {
    assert.equal(normalizeRemoteType("Remote - Worldwide"), "remote");
    assert.equal(normalizeRemoteType("Hybrid - London"), "hybrid");
    assert.equal(normalizeRemoteType("On-site Buenos Aires"), "onsite");
    assert.equal(normalizeRemoteType(""), "unknown");
  });

  it("anualiza salarios de distintos periodos", () => {
    assert.equal(annualizeSalary({ max: 100000, period: "year" }), 100000);
    assert.equal(annualizeSalary({ max: 10000, period: "month" }), 120000);
    assert.equal(annualizeSalary({ max: 50, period: "hour" }), 50 * 40 * 52);
    assert.equal(annualizeSalary(undefined), undefined);
  });

  it("extrae tecnologias aunque terminen una oracion", () => {
    const skills = extractSkills("Experiencia con SQL Server, Python. Tambien Qlik Sense.");
    assert.ok(skills.includes("python"), "deberia detectar python al final de la oracion");
    assert.ok(skills.includes("sql server"));
    assert.ok(skills.includes("qlik sense"));
  });

  it("normaliza nombres de empresa ignorando sufijos societarios", () => {
    assert.equal(normalizeCompany("Acme Inc."), normalizeCompany("ACME LLC"));
  });

  it("interpreta fechas en segundos y en ISO", () => {
    assert.equal(toIsoDate(1700000000)?.slice(0, 4), "2023");
    assert.equal(toIsoDate("2026-01-15T10:00:00Z")?.slice(0, 10), "2026-01-15");
    assert.equal(toIsoDate("texto invalido"), undefined);
  });

  it("aplica filtros locales de keywords y salario", () => {
    const jobs = [
      job({ id: "a", title: "Data Engineer" }),
      job({ id: "b", title: "Sales Representative", description: "ventas", skills: [] }),
      job({ id: "c", title: "Data Engineer", salary: { max: 30000, period: "year" } }),
    ];
    const filtered = applyClientFilters(jobs, {
      keywords: ["data"],
      excludedKeywords: ["ventas"],
      salaryMin: 50000,
    });
    assert.deepEqual(
      filtered.map((item) => item.id),
      ["a"],
    );
  });
});

describe("deduplicacion", () => {
  it("considera identica la misma oferta de la misma fuente", () => {
    const verdict = compareJobs(job(), job({ id: "otro" }));
    assert.equal(verdict.isDuplicate, true);
    assert.equal(verdict.confidence, 1);
  });

  it("detecta la misma oferta publicada en dos fuentes", () => {
    const a = job({ source: "jobicy", sourceJobId: "10", id: "jobicy:10" });
    const b = job({ source: "remotive", sourceJobId: "77", id: "remotive:77" });
    const verdict = compareJobs(a, b);
    assert.equal(verdict.isDuplicate, true);
    assert.ok(verdict.confidence >= 0.82);
  });

  it("no marca como duplicadas ofertas de empresas distintas", () => {
    const a = job({ source: "jobicy", sourceJobId: "10", id: "jobicy:10" });
    const b = job({
      source: "remotive",
      sourceJobId: "77",
      id: "remotive:77",
      company: { name: "Globex Corporation" },
    });
    const verdict = compareJobs(a, b);
    assert.equal(verdict.isDuplicate, false);
  });

  it("colapsa un lote conservando la primera aparicion", () => {
    const result = dedupeJobs([
      job({ id: "jobicy:1", source: "jobicy", sourceJobId: "1" }),
      job({ id: "remotive:2", source: "remotive", sourceJobId: "2" }),
      job({
        id: "himalayas:3",
        source: "himalayas",
        sourceJobId: "3",
        title: "Frontend Developer",
        company: { name: "Otra Empresa" },
        description: "React y TypeScript",
      }),
    ]);
    assert.equal(result.unique.length, 2);
    assert.equal(result.duplicates.length, 1);
    assert.equal(result.unique[0].id, "jobicy:1");
  });

  it("la similitud es simetrica y acotada", () => {
    const a = "sql server python etl";
    const b = "python etl sql server";
    assert.equal(similarity(a, b), similarity(b, a));
    assert.equal(similarity(a, a), 1);
    assert.equal(similarity(a, ""), 0);
  });
});
