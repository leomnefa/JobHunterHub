import type { ConnectorSettings, JobConnector } from "../core/types.ts";
import { createContext } from "./base.ts";
import { adzunaConnector } from "./adzuna.ts";
import { ashbyConnector } from "./ashby.ts";
import { bambooHrConnector } from "./bamboohr.ts";
import { breezyConnector } from "./breezy.ts";
import { freelancerConnector } from "./freelancer.ts";
import { greenhouseConnector } from "./greenhouse.ts";
import { himalayasConnector } from "./himalayas.ts";
import { jobicyConnector } from "./jobicy.ts";
import { leverConnector } from "./lever.ts";
import { personioConnector } from "./personio.ts";
import { PENDING_CONNECTORS } from "./pending.ts";
import { recruiteeConnector } from "./recruitee.ts";
import { remoteOkConnector } from "./remoteok.ts";
import { remotiveConnector } from "./remotive.ts";
import { smartRecruitersConnector } from "./smartrecruiters.ts";
import { teamtailorConnector } from "./teamtailor.ts";
import { upworkConnector } from "./upwork.ts";
import { workableConnector } from "./workable.ts";
import { workdayConnector } from "./workday.ts";

/**
 * Registro de connectors.
 *
 * Agregar una plataforma nueva = crear su archivo, implementar JobConnector y
 * registrarlo aca. El nucleo (busqueda, matching, postulacion, sync) no cambia.
 */
export class ConnectorRegistry {
  private readonly connectors = new Map<string, JobConnector>();

  register(connector: JobConnector): this {
    if (this.connectors.has(connector.id)) {
      throw new Error(`Connector duplicado: ${connector.id}`);
    }
    this.connectors.set(connector.id, connector);
    return this;
  }

  get(id: string): JobConnector | undefined {
    return this.connectors.get(id);
  }

  require(id: string): JobConnector {
    const connector = this.connectors.get(id);
    if (!connector) throw new Error(`Connector no registrado: ${id}`);
    return connector;
  }

  list(): JobConnector[] {
    return [...this.connectors.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  ids(): string[] {
    return [...this.connectors.keys()];
  }

  /** Construye el contexto de ejecucion aislado para un connector. */
  context(
    id: string,
    settings: ConnectorSettings,
    logger?: (message: string, data?: unknown) => void,
  ) {
    const connector = this.require(id);
    return createContext(connector.id, settings, connector.rateLimit, logger);
  }
}

export const connectorRegistry = new ConnectorRegistry();

// --- Fase 2: job boards y agregadores con API publica ---
connectorRegistry.register(himalayasConnector);
connectorRegistry.register(jobicyConnector);
connectorRegistry.register(remotiveConnector);
connectorRegistry.register(remoteOkConnector);
connectorRegistry.register(adzunaConnector);

// --- Fase 3: ATS con API de lectura y (segun credenciales) de postulacion ---
connectorRegistry.register(greenhouseConnector);
connectorRegistry.register(leverConnector);
connectorRegistry.register(ashbyConnector);
connectorRegistry.register(smartRecruitersConnector);

// --- Fase 4: resto de ATS ---
connectorRegistry.register(workableConnector);
connectorRegistry.register(workdayConnector);
connectorRegistry.register(recruiteeConnector);
connectorRegistry.register(bambooHrConnector);
connectorRegistry.register(personioConnector);
connectorRegistry.register(teamtailorConnector);
connectorRegistry.register(breezyConnector);

// --- Fase 5: marketplaces freelance ---
connectorRegistry.register(upworkConnector);
connectorRegistry.register(freelancerConnector);

// --- Declarados, pendientes de verificacion oficial ---
for (const connector of PENDING_CONNECTORS) connectorRegistry.register(connector);
